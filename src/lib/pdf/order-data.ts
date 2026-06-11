import { Prisma, Currency } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { primaryProductCode } from "@/lib/utils/product-code"

/**
 * S-4c-2: 発注書 PDF 用に PO/WO を正規化した型。
 * S-4c-1.6 のコスト内訳と同一語彙（品名 / 品番 / C# / 数量・単位 / 単価 / 小計）。
 */
export type OrderPdfItem = {
  itemName: string
  itemCode: string | null
  colorCode: string | null
  quantity: number
  unit: string
  unitPrice: number | null
  subtotal: number | null
}

/** 対象品番ブロック（縫製仕様書ヘッダと同語彙: ブランド/品名/品番）。 */
export type OrderPdfTarget = {
  brandName: string | null
  productName: string
  itemNumber: string
  season: string | null
}

export type OrderPdfData = {
  docKind: "PO" | "WO"
  docNumber: string
  orderDate: Date
  orderToName: string
  /** どの品番のための発注か（SampleProduction 未紐付けなら null） */
  target: OrderPdfTarget | null
  title: string | null
  description: string | null
  expectedDeliveryDate: Date | null
  currency: Currency
  items: OrderPdfItem[]
  /** 金額確定（subtotal!=null）明細の合計 */
  total: number
  /** 金額未定明細を含むか（フッタ注記の出し分け） */
  hasUndecided: boolean
}

/** SampleProduction → Product → Brand を辿り対象品番ブロックを解決（未紐付けは null）。 */
async function resolveTarget(
  sampleProductionId: string | null,
  companyId: string,
): Promise<OrderPdfTarget | null> {
  if (!sampleProductionId) return null
  const sp = await prisma.sampleProduction.findFirst({
    where: { id: sampleProductionId, companyId },
    select: { productId: true },
  })
  if (!sp) return null
  const product = await prisma.product.findFirst({
    where: { id: sp.productId, companyId },
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

function dec(v: Prisma.Decimal | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === "number" ? v : "toNumber" in v ? v.toNumber() : Number(v)
  return Number.isFinite(n) ? n : null
}

function finalize(
  base: Omit<OrderPdfData, "total" | "hasUndecided">,
): OrderPdfData {
  let total = 0
  let hasUndecided = false
  for (const it of base.items) {
    if (it.subtotal === null) hasUndecided = true
    else total += it.subtotal
  }
  return { ...base, total, hasUndecided }
}

export async function getOrderPdfData(
  type: "po" | "wo",
  id: string,
  companyId: string,
): Promise<OrderPdfData | null> {
  if (type === "po") {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        poNumber: true,
        orderDate: true,
        title: true,
        description: true,
        expectedDeliveryDate: true,
        currency: true,
        supplierId: true,
        sampleProductionId: true,
      },
    })
    if (!po) return null

    const target = await resolveTarget(po.sampleProductionId, companyId)
    const [supplier, items] = await Promise.all([
      prisma.supplier.findFirst({
        where: { id: po.supplierId, companyId },
        select: { companyName: true },
      }),
      prisma.poItem.findMany({
        where: { poId: id },
        orderBy: { itemOrder: "asc" },
      }),
    ])

    const materialIds = [
      ...new Set(items.map((i) => i.materialId).filter((v): v is string => !!v)),
    ]
    const matName = new Map<string, string>()
    const matCode = new Map<string, string>()
    if (materialIds.length > 0) {
      const mats = await prisma.material.findMany({
        where: { id: { in: materialIds }, companyId },
        select: { id: true, materialName: true, materialCode: true },
      })
      for (const m of mats) {
        matName.set(m.id, m.materialName)
        matCode.set(m.id, m.materialCode)
      }
    }

    return finalize({
      docKind: "PO",
      docNumber: po.poNumber,
      orderDate: po.orderDate,
      orderToName: supplier?.companyName ?? "（発注先未設定）",
      target,
      title: po.title,
      description: po.description,
      expectedDeliveryDate: po.expectedDeliveryDate,
      currency: po.currency,
      items: items.map((it) => ({
        itemName:
          it.customItemName ??
          (it.materialId ? matName.get(it.materialId) ?? "（素材）" : "（品目未設定）"),
        itemCode:
          it.supplierItemCode ||
          (it.materialId ? matCode.get(it.materialId) ?? null : null),
        colorCode: it.colorCode || null,
        quantity: dec(it.quantity) ?? 0,
        unit: it.unit,
        unitPrice: dec(it.unitPrice),
        subtotal: dec(it.subtotal),
      })),
    })
  }

  // --- WO ---
  const wo = await prisma.workOrder.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      woNumber: true,
      orderDate: true,
      title: true,
      description: true,
      expectedDeliveryDate: true,
      currency: true,
      factoryId: true,
      contractorId: true,
      samplProductionId: true,
    },
  })
  if (!wo) return null

  const target = await resolveTarget(wo.samplProductionId, companyId)
  const [factory, contractor, items] = await Promise.all([
    wo.factoryId
      ? prisma.factory.findFirst({
          where: { id: wo.factoryId, companyId },
          select: { factoryName: true },
        })
      : Promise.resolve(null),
    wo.contractorId
      ? prisma.contractor.findFirst({
          where: { id: wo.contractorId, companyId },
          select: { contractorName: true },
        })
      : Promise.resolve(null),
    prisma.woItem.findMany({ where: { woId: id }, orderBy: { itemOrder: "asc" } }),
  ])

  return finalize({
    docKind: "WO",
    docNumber: wo.woNumber,
    orderDate: wo.orderDate,
    orderToName:
      factory?.factoryName ?? contractor?.contractorName ?? "（発注先未設定）",
    target,
    title: wo.title,
    description: wo.description,
    expectedDeliveryDate: wo.expectedDeliveryDate,
    currency: wo.currency,
    items: items.map((it) => ({
      itemName: it.workDescription,
      itemCode: null,
      colorCode: it.colorCode || null,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: dec(it.unitPrice),
      subtotal: dec(it.subtotal),
    })),
  })
}
