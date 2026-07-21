import { Prisma, InitialCostBillingMode } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { primaryProductCode } from "@/lib/utils/product-code"

/**
 * B-085 量産見積 見積書 PDF（QE-1R 道A 同型・2セクション＋総合計）用に
 * ProductionEstimate を正規化した型。
 *
 * ★原価（autoUnitCostJpy・subtotalJpy）・利益率（marginRate）・材料/工賃明細は型に一切載せない
 *   （spec §4・型レベルで漏れ防止）。header 取得も cost/margin 列を select しない。
 * ★spec §3: 総合計＝製品合計＋別枠合計（消費税は付けない。QE-1R PDF は税を出すが本 spec は
 *   税表記に言及なし＝spec 準拠で税レイヤーなし）。
 * ★丸め: 客提示の1枚単価は整数円＝円未満切り上げ（Math.ceil・QE-1R 道A の ceilYen 慣行を流用）。
 *   金額＝表示された整数円単価 × 数量（電卓一致）。別枠は presentedPriceManualJpy（整数円）そのもの。
 */

/** 製品セクションの1行（1 PE＝1行）。 */
export type PeQuotationProductRow = {
  estimateNumber: string
  /** 品名（productName（productCode）＋title 併記）。 */
  productLabel: string
  /** 数量＝見積数量（estimateQuantity）。 */
  quantity: number
  /** 客提示の1枚単価（finalUnitPriceManualJpy ?? autoUnitPriceJpy を円未満切り上げ）。 */
  unitPriceJpy: number
  /** 金額＝unitPriceJpy × quantity（電卓一致）。 */
  amountJpy: number
  notes: string | null
}

/** 別枠（初期費用）セクションの1行（isSeparateBilling かつ presentedPriceManualJpy 非 null のみ）。 */
export type PeQuotationSeparateRow = {
  /** 項目名（itemName（productName 付記）＝どの品番の費用か明示）。 */
  label: string
  amountJpy: number
}

/** 備考行（notes が非 null の PE のみ）。 */
export type PeQuotationNoteRow = {
  productLabel: string
  notes: string
}

export type PeQuotationPdfData = {
  issuedAt: Date
  clientName: string
  productRows: PeQuotationProductRow[]
  productTotalJpy: number
  separateRows: PeQuotationSeparateRow[]
  separateTotalJpy: number
  /** 総合計＝製品合計＋別枠合計（spec §3・税なし）。 */
  grandTotalJpy: number
  notesRows: PeQuotationNoteRow[]
}

export type PeQuotationPdfError = {
  error: "MIXED_CLIENT" | "NOT_FOUND" | "EMPTY" | "PE_NOT_READY"
  /** PE_NOT_READY のとき対象 PE 番号。 */
  estimateNumbers?: string[]
}

// =============================================================================
// 純関数（ガード判定・単価解決・選別・合計）＝ unit test 対象
// =============================================================================

/** Decimal|number|null → number|null。 */
export function dec(
  v: Prisma.Decimal | number | null | undefined,
): number | null {
  if (v === null || v === undefined) return null
  const n =
    typeof v === "number" ? v : "toNumber" in v ? v.toNumber() : Number(v)
  return Number.isFinite(n) ? n : null
}

/** 客提示の1枚単価＝手打ち ?? 自動、を円未満切り上げ。どちらも null なら null。 */
export function resolvePeUnitPriceJpy(
  finalUnitPriceManualJpy: number | null,
  autoUnitPriceJpy: number | null,
): number | null {
  const base = finalUnitPriceManualJpy ?? autoUnitPriceJpy
  if (base == null) return null
  return Math.ceil(base)
}

/** 出力不可判定（PE_NOT_READY・spec §2）: 数量≦0 または 単価が手打ち/自動とも null。 */
export function isPeNotReady(
  estimateQuantity: number,
  finalUnitPriceManualJpy: number | null,
  autoUnitPriceJpy: number | null,
): boolean {
  if (estimateQuantity <= 0) return true
  return finalUnitPriceManualJpy == null && autoUnitPriceJpy == null
}

export type PeSeparateItemInput = {
  isSeparateBilling: boolean
  presentedPriceManualJpy: number | null
  itemName: string
}

/**
 * 別枠行の選別（spec §3）: isSeparateBilling かつ presentedPriceManualJpy 非 null のみ計上。
 * presentedPriceManualJpy が null の別枠行は PDF に出さない（既定非計上・二重請求防止）。
 * フォールバックなし（QE-1R と異なる点）。
 */
export function selectSeparateRows(
  items: PeSeparateItemInput[],
  productLabel: string,
): PeQuotationSeparateRow[] {
  const rows: PeQuotationSeparateRow[] = []
  for (const it of items) {
    if (!it.isSeparateBilling || it.presentedPriceManualJpy == null) continue
    rows.push({
      label: `${it.itemName}（${productLabel}）`,
      amountJpy: it.presentedPriceManualJpy,
    })
  }
  return rows
}

/** 合計（製品合計・別枠合計・総合計＝製品＋別枠）。 */
export function computePeTotals(
  productRows: Pick<PeQuotationProductRow, "amountJpy">[],
  separateRows: Pick<PeQuotationSeparateRow, "amountJpy">[],
): { productTotalJpy: number; separateTotalJpy: number; grandTotalJpy: number } {
  const productTotalJpy = productRows.reduce((a, r) => a + r.amountJpy, 0)
  const separateTotalJpy = separateRows.reduce((a, r) => a + r.amountJpy, 0)
  return {
    productTotalJpy,
    separateTotalJpy,
    grandTotalJpy: productTotalJpy + separateTotalJpy,
  }
}

// =============================================================================
// DB 取得＋整形（route から呼ぶ）
// =============================================================================

type ProductLike = {
  productName: string
  productCode: string
  clientProductCode: string | null
}

function productLabelOf(
  product: ProductLike | undefined,
  title: string | null,
): string {
  const base = product
    ? `${product.productName}（${primaryProductCode(product)}）`
    : "（品番不明）"
  return title ? `${base} ${title}` : base
}

export async function getPeQuotationPdfData(
  ids: string[],
  companyId: string,
): Promise<PeQuotationPdfData | PeQuotationPdfError> {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return { error: "EMPTY" }

  // header は cost/margin 列を select しない（spec §4・型レベル漏れ防止）。
  const estimates = await prisma.productionEstimate.findMany({
    where: { id: { in: uniqueIds }, companyId, deletedAt: null },
    select: {
      id: true,
      estimateNumber: true,
      productId: true,
      title: true,
      notes: true,
      estimateQuantity: true,
      finalUnitPriceManualJpy: true,
      autoUnitPriceJpy: true,
      initialCostBillingMode: true,
    },
  })
  if (estimates.length < uniqueIds.length) return { error: "NOT_FOUND" }

  // productId → Product 一括引き（宛先解決＋品名）。
  const productIds = [...new Set(estimates.map((e) => e.productId))]
  const products = await prisma.product.findMany({
    where: { companyId, id: { in: productIds } },
    select: {
      id: true,
      clientId: true,
      productName: true,
      productCode: true,
      clientProductCode: true,
    },
  })
  const productById = new Map(products.map((p) => [p.id, p]))

  // product 欠損 → 宛先不定 → NOT_FOUND。宛先混在 → MIXED_CLIENT。
  const clientIds = new Set<string>()
  for (const e of estimates) {
    const p = productById.get(e.productId)
    if (!p) return { error: "NOT_FOUND" }
    clientIds.add(p.clientId)
  }
  if (clientIds.size > 1) return { error: "MIXED_CLIENT" }

  // PE_NOT_READY: 数量0 or 単価なしの PE を弾く。
  const notReady = estimates
    .filter((e) =>
      isPeNotReady(
        e.estimateQuantity,
        dec(e.finalUnitPriceManualJpy),
        dec(e.autoUnitPriceJpy),
      ),
    )
    .map((e) => e.estimateNumber)
  if (notReady.length > 0) {
    return { error: "PE_NOT_READY", estimateNumbers: notReady }
  }

  const clientId = [...clientIds][0]
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId },
    select: { companyName: true },
  })
  const clientName = client?.companyName ?? "—"

  const estimateById = new Map(estimates.map((e) => [e.id, e]))
  const productRows: PeQuotationProductRow[] = []
  const separateRows: PeQuotationSeparateRow[] = []
  const notesRows: PeQuotationNoteRow[] = []

  // ids の並び順を尊重。
  for (const id of uniqueIds) {
    const e = estimateById.get(id)
    if (!e) continue
    const product = productById.get(e.productId)
    const productLabel = productLabelOf(product, e.title)

    const unit = resolvePeUnitPriceJpy(
      dec(e.finalUnitPriceManualJpy),
      dec(e.autoUnitPriceJpy),
    ) as number // PE_NOT_READY で non-null を担保済み。

    productRows.push({
      estimateNumber: e.estimateNumber,
      productLabel,
      quantity: e.estimateQuantity,
      unitPriceJpy: unit,
      amountJpy: unit * e.estimateQuantity,
      notes: e.notes,
    })
    if (e.notes) notesRows.push({ productLabel, notes: e.notes })

    // spec §5: SEPARATE 以外の値が来ても 500 にせず SEPARATE 同等で出力＋警告。
    if (e.initialCostBillingMode !== InitialCostBillingMode.SEPARATE) {
      console.warn(
        `[B-085] ${e.estimateNumber}: initialCostBillingMode=${e.initialCostBillingMode} を SEPARATE 同等で出力（B-077 未実装）`,
      )
    }

    // 別枠行: isSeparateBilling の明細のみ取得（材料/工賃明細は取得もしない・spec §4）。
    const items = await prisma.productionEstimateItem.findMany({
      where: { productionEstimateId: e.id, isSeparateBilling: true },
      orderBy: { itemOrder: "asc" },
      select: {
        itemName: true,
        isSeparateBilling: true,
        presentedPriceManualJpy: true,
      },
    })
    separateRows.push(
      ...selectSeparateRows(
        items.map((it) => ({
          isSeparateBilling: it.isSeparateBilling,
          presentedPriceManualJpy: dec(it.presentedPriceManualJpy),
          itemName: it.itemName,
        })),
        productLabel,
      ),
    )
  }

  const { productTotalJpy, separateTotalJpy, grandTotalJpy } = computePeTotals(
    productRows,
    separateRows,
  )

  return {
    issuedAt: new Date(),
    clientName,
    productRows,
    productTotalJpy,
    separateRows,
    separateTotalJpy,
    grandTotalJpy,
    notesRows,
  }
}
