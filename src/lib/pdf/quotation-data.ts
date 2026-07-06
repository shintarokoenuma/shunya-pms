import {
  Prisma,
  Currency,
  InitialCostBillingMode,
  RoughEstimateCategory,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { primaryProductCode } from "@/lib/utils/product-code"
import { computePriceBreakdownFromTotals } from "@/lib/rough-estimate/calc"

/**
 * QE-1R 見積書 PDF 用に RoughEstimate を正規化した型（Part B）。
 * ★原価(autoCostTotalJpy)・利益率(marginRate) は型に一切載せない（§6-2・型で漏れ防止）。
 */
export type QuotationPdfItem = {
  itemName: string
  itemCategory: RoughEstimateCategory
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  currency: Currency
  subtotalJpy: number | null
}

/** 対象品番ブロック（order-data.ts の OrderPdfTarget と同語彙）。 */
export type QuotationPdfTarget = {
  brandName: string | null
  productName: string
  itemNumber: string
  season: string | null
}

export type QuotationPdfBlock = {
  target: QuotationPdfTarget | null
  title: string | null
  estimateNumber: string
  presentedMoq: number | null
  materialItems: QuotationPdfItem[]
  laborItems: QuotationPdfItem[]
  initialCostItems: QuotationPdfItem[]
  /** 1枚あたり提示単価（§6-3・presentedMoq>0 かつ合計が揃うときのみ）。 */
  perUnit: { label: string; valueJpy: number } | null
  /** ご提示価格（§6-1・finalPriceManualJpy ?? autoPriceTotalJpy）。 */
  finalPriceJpy: number | null
  notes: string | null
}

export type QuotationPdfData = {
  issuedAt: Date
  clientName: string
  blocks: QuotationPdfBlock[]
}

export type QuotationPdfError = {
  error: "MIXED_CLIENT" | "NOT_FOUND" | "EMPTY"
}

/** Decimal|number|null → number|null（order-data.ts と同実装）。 */
function dec(v: Prisma.Decimal | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === "number" ? v : "toNumber" in v ? v.toNumber() : Number(v)
  return Number.isFinite(n) ? n : null
}

/** productId 起点で対象品番ブロックを解決（sampleProductionId 起点の既存は流用不可）。 */
async function resolveTargetByProduct(
  productId: string,
  companyId: string,
): Promise<QuotationPdfTarget | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, companyId },
    select: {
      productName: true,
      productCode: true,
      clientProductCode: true,
      season: true,
      brandId: true,
    },
  })
  if (!product) return null
  const brand = await prisma.brand.findFirst({
    where: { id: product.brandId, companyId },
    select: { brandName: true },
  })
  return {
    brandName: brand?.brandName ?? null,
    productName: product.productName,
    itemNumber: primaryProductCode(product),
    season: product.season,
  }
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

  // product 欠損 estimate があると宛先が定まらない → NOT_FOUND。
  const clientIds = new Set<string>()
  for (const e of estimates) {
    const clientId = clientIdByProduct.get(e.productId)
    if (!clientId) return { error: "NOT_FOUND" }
    clientIds.add(clientId)
  }
  if (clientIds.size > 1) return { error: "MIXED_CLIENT" }

  const clientId = [...clientIds][0]
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId },
    select: { companyName: true },
  })
  const clientName = client?.companyName ?? "—"

  // ids の並び順を尊重してブロックを整列。
  const estimateById = new Map(estimates.map((e) => [e.id, e]))
  const blocks: QuotationPdfBlock[] = []
  for (const id of uniqueIds) {
    const e = estimateById.get(id)
    if (!e) continue // findMany 数一致を上で担保済み（保険）。

    const items = await prisma.roughEstimateItem.findMany({
      where: { roughEstimateId: e.id },
      orderBy: { itemOrder: "asc" },
    })

    const materialItems: QuotationPdfItem[] = []
    const laborItems: QuotationPdfItem[] = []
    const initialCostItems: QuotationPdfItem[] = []
    for (const it of items) {
      const row: QuotationPdfItem = {
        itemName: it.itemName,
        itemCategory: it.itemCategory,
        quantity: dec(it.quantity),
        unit: it.unit,
        unitPrice: dec(it.unitPrice),
        currency: it.currency,
        subtotalJpy: dec(it.subtotalJpy),
      }
      if (it.itemCategory === RoughEstimateCategory.MATERIAL) materialItems.push(row)
      else if (it.itemCategory === RoughEstimateCategory.LABOR) laborItems.push(row)
      else initialCostItems.push(row)
    }

    const autoCost = dec(e.autoCostTotalJpy)
    const autoPrice = dec(e.autoPriceTotalJpy)
    const margin = dec(e.marginRate)

    let perUnit: { label: string; valueJpy: number } | null = null
    if (autoCost != null && autoPrice != null) {
      const bd = computePriceBreakdownFromTotals(
        autoCost,
        autoPrice,
        margin,
        e.initialCostBillingMode,
        e.presentedMoq,
      )
      if (bd.perUnit) {
        perUnit =
          e.initialCostBillingMode === InitialCostBillingMode.SEPARATE
            ? {
                label: "量産1枚あたり",
                valueJpy: bd.perUnit.productionPricePerUnitJpy,
              }
            : {
                label: "1枚あたり（初期費用込）",
                valueJpy: bd.perUnit.includedPerUnitPriceJpy,
              }
      }
    }

    const finalPriceJpy = dec(e.finalPriceManualJpy) ?? autoPrice ?? null
    const target = await resolveTargetByProduct(e.productId, companyId)

    blocks.push({
      target,
      title: e.title,
      estimateNumber: e.estimateNumber,
      presentedMoq: e.presentedMoq,
      materialItems,
      laborItems,
      initialCostItems,
      perUnit,
      finalPriceJpy,
      notes: e.notes,
    })
  }

  return { issuedAt: new Date(), clientName, blocks }
}
