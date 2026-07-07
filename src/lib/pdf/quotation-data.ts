import { Prisma, RoughEstimateCategory, InitialCostBillingMode } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { primaryProductCode } from "@/lib/utils/product-code"
import {
  computePriceBreakdownFromTotals,
  resolveUnitPriceJpy,
  resolveInitialCostPresentedJpy,
} from "@/lib/rough-estimate/calc"

/**
 * QE-1R 見積書 PDF（道A・2セクション＋総合計）用に RoughEstimate を正規化した型。
 * ★原価（autoCostTotalJpy・subtotalJpy）・利益率（marginRate）・材料/工賃明細は型に一切載せない
 *   （§5-4・型レベルで漏れ防止）。導出（率掛け）は data 層内部でのみ使い、出力は提示額だけ。
 */

/** 製品セクションの1行（1見積＝1行）。 */
export type QuotationPdfProductRow = {
  estimateNumber: string
  /** 品名（productName（productCode）＋title 併記）。 */
  productLabel: string
  /** 数量＝提示MOQ。 */
  quantity: number
  /** 客提示の1枚単価（手打ち ?? 自動参考・整数円）。 */
  unitPriceJpy: number
  /** INCLUDED（初期費用込）表記を付けるか。 */
  includedBadge: boolean
  /** 金額＝unitPriceJpy × quantity（電卓一致）。 */
  amountJpy: number
  notes: string | null
}

/** 初期費用セクションの1行（SEPARATE の見積の INITIAL_COST 行のみ）。 */
export type QuotationPdfInitialCostRow = {
  /** 項目名（itemName（productName 付記）＝どの製品か明示）。 */
  label: string
  amountJpy: number
}

/** 備考行（notes が非 null の見積のみ）。 */
export type QuotationPdfNoteRow = {
  productLabel: string
  notes: string
}

export type QuotationPdfData = {
  issuedAt: Date
  clientName: string
  productRows: QuotationPdfProductRow[]
  productTotalJpy: number
  initialCostRows: QuotationPdfInitialCostRow[]
  initialCostTotalJpy: number
  /** 小計（税抜）＝製品合計＋初期費用合計（旧 grandTotalJpy）。 */
  subtotalExTaxJpy: number
  /** 消費税＝小計（税抜）×TAX_RATE を円未満切り捨て。 */
  taxJpy: number
  /** 御見積金額（税込）＝小計（税抜）＋消費税。 */
  totalIncTaxJpy: number
  /** INCLUDED を含むか（脚注の出し分け）。 */
  hasIncluded: boolean
  notesRows: QuotationPdfNoteRow[]
}

export type QuotationPdfError = {
  error: "MIXED_CLIENT" | "NOT_FOUND" | "EMPTY" | "MOQ_REQUIRED" | "UNIT_UNRESOLVED"
  /** MOQ_REQUIRED / UNIT_UNRESOLVED のとき対象 RE 番号。 */
  estimateNumbers?: string[]
}

/**
 * 消費税率（表示層の定数・保存しない・スキーマ変更なし）。軽減税率は対象外。
 * 税率変更時はここ1箇所。消費税は円未満切り捨て（Math.floor・一般慣行／単価の切上とは別）。
 */
const TAX_RATE = 0.1

/** Decimal|number|null → number|null。 */
function dec(v: Prisma.Decimal | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === "number" ? v : "toNumber" in v ? v.toNumber() : Number(v)
  return Number.isFinite(n) ? n : null
}

/** 品名ラベル（productName（productCode）＋title 併記）。 */
async function resolveProductLabel(
  productId: string,
  companyId: string,
  title: string | null,
): Promise<string> {
  const product = await prisma.product.findFirst({
    where: { id: productId, companyId },
    select: { productName: true, productCode: true, clientProductCode: true },
  })
  const base = product
    ? `${product.productName}（${primaryProductCode(product)}）`
    : "（品番不明）"
  return title ? `${base} ${title}` : base
}

export async function getQuotationPdfData(
  ids: string[],
  companyId: string,
): Promise<QuotationPdfData | QuotationPdfError> {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return { error: "EMPTY" }

  const estimates = await prisma.roughEstimate.findMany({
    where: { id: { in: uniqueIds }, companyId, deletedAt: null },
  })
  if (estimates.length < uniqueIds.length) return { error: "NOT_FOUND" }

  // productId → Product 一括引き（宛先解決の基点）。
  const productIds = [...new Set(estimates.map((e) => e.productId))]
  const products = await prisma.product.findMany({
    where: { companyId, id: { in: productIds } },
    select: { id: true, clientId: true },
  })
  const clientIdByProduct = new Map(products.map((p) => [p.id, p.clientId]))

  // product 欠損 → 宛先不定 → NOT_FOUND。
  const clientIds = new Set<string>()
  for (const e of estimates) {
    const clientId = clientIdByProduct.get(e.productId)
    if (!clientId) return { error: "NOT_FOUND" }
    clientIds.add(clientId)
  }
  if (clientIds.size > 1) return { error: "MIXED_CLIENT" }

  // MOQ_REQUIRED: presentedMoq が null/0 の RE が1件でもあれば弾く（製品行＝単価×MOQ が不成立）。
  const moqMissing = estimates
    .filter((e) => e.presentedMoq == null || e.presentedMoq <= 0)
    .map((e) => e.estimateNumber)
  if (moqMissing.length > 0) {
    return { error: "MOQ_REQUIRED", estimateNumbers: moqMissing }
  }

  const clientId = [...clientIds][0]
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId },
    select: { companyName: true },
  })
  const clientName = client?.companyName ?? "—"

  const estimateById = new Map(estimates.map((e) => [e.id, e]))
  const productRows: QuotationPdfProductRow[] = []
  const initialCostRows: QuotationPdfInitialCostRow[] = []
  const notesRows: QuotationPdfNoteRow[] = []
  const unitUnresolved: string[] = []
  let hasIncluded = false

  // ids の並び順を尊重。
  for (const id of uniqueIds) {
    const e = estimateById.get(id)
    if (!e) continue

    const moq = e.presentedMoq as number // MOQ_REQUIRED で > 0 を担保済み。
    const autoCost = dec(e.autoCostTotalJpy)
    const autoPrice = dec(e.autoPriceTotalJpy)
    const margin = dec(e.marginRate)
    const manualUnit = dec(e.finalUnitPriceManualJpy)
    const productLabel = await resolveProductLabel(e.productId, companyId, e.title)

    // 1枚単価解決（手打ち ?? 自動参考）。自動側は autoCost/autoPrice が要る。
    const breakdown =
      autoCost != null && autoPrice != null
        ? computePriceBreakdownFromTotals(
            autoCost,
            autoPrice,
            margin,
            e.initialCostBillingMode,
            moq,
          )
        : null
    const resolved = resolveUnitPriceJpy(
      manualUnit,
      breakdown?.perUnit ?? null,
      e.initialCostBillingMode,
    )
    if (resolved == null) {
      // 手打ちも自動も出せない（合計未保存かつ手打ちなし）。対象として弾く。
      unitUnresolved.push(e.estimateNumber)
      continue
    }
    if (resolved.includedBadge) hasIncluded = true

    productRows.push({
      estimateNumber: e.estimateNumber,
      productLabel,
      quantity: moq,
      unitPriceJpy: resolved.valueJpy,
      includedBadge: resolved.includedBadge,
      amountJpy: resolved.valueJpy * moq,
      notes: e.notes,
    })

    if (e.notes) notesRows.push({ productLabel, notes: e.notes })

    // 初期費用行: SEPARATE の RE の INITIAL_COST 行のみ（INCLUDED は単価に配賦済み＝出さない）。
    if (e.initialCostBillingMode === InitialCostBillingMode.SEPARATE) {
      const items = await prisma.roughEstimateItem.findMany({
        where: {
          roughEstimateId: e.id,
          itemCategory: RoughEstimateCategory.INITIAL_COST,
        },
        orderBy: { itemOrder: "asc" },
      })
      for (const it of items) {
        const amount = resolveInitialCostPresentedJpy(
          dec(it.presentedPriceManualJpy),
          dec(it.subtotalJpy),
          margin,
        )
        if (amount == null) continue
        initialCostRows.push({
          label: `${it.itemName}（${productLabel}）`,
          amountJpy: amount,
        })
      }
    }
  }

  if (unitUnresolved.length > 0) {
    return { error: "UNIT_UNRESOLVED", estimateNumbers: unitUnresolved }
  }

  const productTotalJpy = productRows.reduce((a, r) => a + r.amountJpy, 0)
  const initialCostTotalJpy = initialCostRows.reduce((a, r) => a + r.amountJpy, 0)
  const subtotalExTaxJpy = productTotalJpy + initialCostTotalJpy
  const taxJpy = Math.floor(subtotalExTaxJpy * TAX_RATE) // 消費税＝円未満切り捨て。
  const totalIncTaxJpy = subtotalExTaxJpy + taxJpy

  return {
    issuedAt: new Date(),
    clientName,
    productRows,
    productTotalJpy,
    initialCostRows,
    initialCostTotalJpy,
    subtotalExTaxJpy,
    taxJpy,
    totalIncTaxJpy,
    hasIncluded,
    notesRows,
  }
}
