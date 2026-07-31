"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  Currency,
  MarginRateSource,
  BillingClassification,
  FabricProcurementMode,
  ProductionEstimateCategory,
  ProductionEstimateItemSource,
  ProcurementRoute,
  WorkOrderType,
  type InitialCostBillingMode,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  listActiveSuppliersForPoSelect,
  type SupplierOption,
} from "@/lib/actions/purchase-orders"
import {
  listActiveFactoriesForWoSelect,
  listActiveContractorsForWoSelect,
  type FactoryOption,
  type ContractorOption,
} from "@/lib/actions/work-orders"
import {
  productionEstimateInputSchema,
  type ProductionEstimateInput,
  type ProductionEstimateItemInput,
} from "@/lib/validators/production-estimate"
import {
  computeProductionEstimate,
  type ProductionEstimateLineForCalc,
} from "@/lib/production-estimate/calc"
import type { ProductionCostCurrency } from "@/lib/calc/production-cost"

/**
 * (A) 量産見積 seed① Server Actions（production-axis v1.0 §1）。
 *
 * house style は rough-estimates.ts を踏襲（採番 P2002 retry・スナップショット焼き込み・
 * scalar FK 明示クエリ・監査ログ・全 Decimal は Prisma.Decimal 書き / Number 読み）。
 * 差分:
 * - seed① コピー導線 createProductionEstimateFromSample（確定サンプルの PO/WO 明細を焼き込み）。
 * - 絶対防衛線（§1-5）: INDIVIDUAL_BILLING 行は isSeparateBilling=true・presentedPriceManualJpy=null（非計上）。
 * - §1-6: コピー時に通貨を確定扱いする自動処理を入れない（exchangeRate は人が編集で入力）。
 */

// =============================================================================
// 型・ヘルパー
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
  }
}

/** Decimal → number（読み・null 保持）。 */
function dnum(v: Prisma.Decimal | null): number | null {
  return v != null ? Number(v) : null
}

/** number → Prisma.Decimal（書き・null 保持）。 */
function dec(n: number | null): Prisma.Decimal | null {
  return n != null ? new Prisma.Decimal(n) : null
}

function estimateNumberPrefix(year: number): string {
  return `PE-${year}-`
}

type PeNumberFinder = {
  findFirst: (args: {
    where: { companyId: string; estimateNumber: { startsWith: string } }
    orderBy: { estimateNumber: "desc" }
    select: { estimateNumber: true }
  }) => Promise<{ estimateNumber: string } | null>
}

async function computeNextEstimateNumber(
  finder: PeNumberFinder,
  companyId: string,
  prefix: string,
): Promise<string> {
  const last = await finder.findFirst({
    where: { companyId, estimateNumber: { startsWith: prefix } },
    orderBy: { estimateNumber: "desc" },
    select: { estimateNumber: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.estimateNumber.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`
}

async function resolvePeMarginRate(
  companyId: string,
  brandId: string,
  input: { marginRate: number | null; marginRateSource: MarginRateSource | null },
): Promise<{ rate: number | null; source: MarginRateSource }> {
  if (input.marginRate != null) {
    return {
      rate: input.marginRate,
      source: input.marginRateSource ?? MarginRateSource.MANUAL_OVERRIDE,
    }
  }
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, companyId, deletedAt: null },
    select: { defaultMarginRate: true },
  })
  const def =
    brand?.defaultMarginRate != null ? Number(brand.defaultMarginRate) : null
  return { rate: def, source: MarginRateSource.BRAND_DEFAULT }
}

/** 両経路（コピー / 編集入力）が生成する正規化明細（number 正規化済み）。 */
type FullItem = {
  key: string
  itemOrder: number
  itemCategory: ProductionEstimateCategory
  isSeparateBilling: boolean
  procurementRoute: ProcurementRoute
  itemName: string
  itemNameEn: string | null
  materialId: string | null
  costCategoryId: string | null
  source: ProductionEstimateItemSource
  sourcePoItemId: string | null
  sourceWoItemId: string | null
  sourceBomItemId: string | null
  unitPrice: number | null
  currency: Currency
  usagePerUnit: number | null
  lossRate: number
  procurementMode: FabricProcurementMode | null
  rollLength: number | null
  rollPrice: number | null
  rollCurrency: Currency | null
  cutFee: number | null
  quantity: number | null
  unit: string | null
  presentedPriceManualJpy: number | null
  notes: string | null
}

function toCalcLine(f: FullItem): ProductionEstimateLineForCalc {
  return {
    id: f.key,
    itemCategory:
      f.itemCategory === ProductionEstimateCategory.MATERIAL
        ? "MATERIAL"
        : "LABOR",
    isSeparateBilling: f.isSeparateBilling,
    procurementRoute: f.procurementRoute,
    usagePerUnit: f.usagePerUnit,
    lossRate: f.lossRate,
    procurementMode: (f.procurementMode as "ROLL" | "METER" | null) ?? null,
    rollLength: f.rollLength,
    rollPrice: f.rollPrice,
    rollCurrency: (f.rollCurrency as ProductionCostCurrency | null) ?? null,
    cutFee: f.cutFee,
    unitPrice: f.unitPrice,
    currency: f.currency as ProductionCostCurrency,
    quantity: f.quantity,
    unit: f.unit,
    presentedPriceManualJpy: f.presentedPriceManualJpy,
  }
}

/** FullItem → createMany 用データ（productionEstimateId・subtotal は呼び出し側で付与）。 */
function toItemCreateBase(
  f: FullItem,
): Omit<
  Prisma.ProductionEstimateItemCreateManyInput,
  "productionEstimateId" | "subtotal" | "subtotalJpy"
> {
  return {
    itemOrder: f.itemOrder,
    itemCategory: f.itemCategory,
    isSeparateBilling: f.isSeparateBilling,
    procurementRoute: f.procurementRoute,
    itemName: f.itemName,
    itemNameEn: f.itemNameEn,
    materialId: f.materialId,
    costCategoryId: f.costCategoryId,
    source: f.source,
    sourcePoItemId: f.sourcePoItemId,
    sourceWoItemId: f.sourceWoItemId,
    sourceBomItemId: f.sourceBomItemId,
    unitPrice: dec(f.unitPrice),
    currency: f.currency,
    usagePerUnit: dec(f.usagePerUnit),
    lossRate: new Prisma.Decimal(f.lossRate),
    procurementMode: f.procurementMode,
    rollLength: dec(f.rollLength),
    rollPrice: dec(f.rollPrice),
    rollCurrency: f.rollCurrency,
    cutFee: dec(f.cutFee),
    quantity: dec(f.quantity),
    unit: f.unit,
    presentedPriceManualJpy: dec(
      f.isSeparateBilling ? f.presentedPriceManualJpy : null,
    ),
    notes: f.notes,
  }
}

/** 編集入力 → FullItem（別枠でない行の手打ち提示額は落とす）。 */
function fromInputItem(
  it: ProductionEstimateItemInput,
  order: number,
): FullItem {
  return {
    key: String(order),
    itemOrder: order,
    itemCategory: it.itemCategory,
    isSeparateBilling: it.isSeparateBilling,
    procurementRoute: it.procurementRoute,
    itemName: it.itemName,
    itemNameEn: it.itemNameEn || null,
    materialId: it.materialId,
    costCategoryId: it.costCategoryId,
    source: it.source,
    sourcePoItemId: it.sourcePoItemId,
    sourceWoItemId: it.sourceWoItemId,
    sourceBomItemId: it.sourceBomItemId,
    unitPrice: it.unitPrice,
    currency: it.currency,
    usagePerUnit: it.usagePerUnit,
    lossRate: it.lossRate,
    procurementMode: it.procurementMode,
    rollLength: it.rollLength,
    rollPrice: it.rollPrice,
    rollCurrency: it.rollCurrency,
    // 保存側ガード: カット代は METER 行のみ有効（それ以外は null に正規化・保存データを汚さない）。
    cutFee:
      it.procurementMode === FabricProcurementMode.METER ? it.cutFee : null,
    quantity: it.quantity,
    unit: it.unit || null,
    presentedPriceManualJpy: it.isSeparateBilling
      ? it.presentedPriceManualJpy
      : null,
    notes: it.notes || null,
  }
}

// =============================================================================
// DTO（client 安全・Decimal は number 正規化）
// =============================================================================
export type ProductionEstimateItemDTO = {
  id: string
  itemOrder: number
  itemCategory: ProductionEstimateCategory
  isSeparateBilling: boolean
  procurementRoute: ProcurementRoute
  itemName: string
  itemNameEn: string | null
  materialId: string | null
  costCategoryId: string | null
  source: ProductionEstimateItemSource
  sourcePoItemId: string | null
  sourceWoItemId: string | null
  sourceBomItemId: string | null
  unitPrice: number | null
  currency: Currency
  usagePerUnit: number | null
  lossRate: number
  procurementMode: FabricProcurementMode | null
  rollLength: number | null
  rollPrice: number | null
  rollCurrency: Currency | null
  cutFee: number | null
  quantity: number | null
  unit: string | null
  subtotal: number | null
  subtotalJpy: number | null
  presentedPriceManualJpy: number | null
  notes: string | null
}

export type ProductionEstimateDTO = {
  id: string
  estimateNumber: string
  productId: string
  sourceSampleProductionId: string | null
  issuedAt: string
  title: string | null
  notes: string | null
  estimateQuantity: number
  currency: Currency
  exchangeRateUsdJpy: number | null
  marginRate: number | null
  marginRateSource: MarginRateSource
  initialCostBillingMode: InitialCostBillingMode
  autoUnitCostJpy: number | null
  autoUnitPriceJpy: number | null
  finalUnitPriceManualJpy: number | null
  items: ProductionEstimateItemDTO[]
}

export type ProductionEstimateListRow = {
  id: string
  estimateNumber: string
  issuedAt: string
  title: string | null
  estimateQuantity: number
  currency: Currency
  autoUnitCostJpy: number | null
  autoUnitPriceJpy: number | null
  finalUnitPriceManualJpy: number | null
  /** 別枠合計（手打ち提示額が入った別枠行の Σ・1枚原価外）。 */
  separateTotalJpy: number
}

// =============================================================================
// seed① コピー: 確定サンプルから見積を生成
// =============================================================================
const CREATE_MAX_RETRIES = 3

export async function createProductionEstimateFromSample(
  productId: string,
): Promise<ActionResult<{ id: string; estimateNumber: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const product = await prisma.product.findFirst({
      where: { id: productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, brandId: true },
    })
    if (!product) return { ok: false, error: "指定された品番が見つかりません" }

    // (a) 基準サンプル
    const baseSample = await prisma.sampleProduction.findFirst({
      where: {
        productId,
        companyId: sess.companyId,
        isProductionEstimateBase: true,
        deletedAt: null,
      },
      select: { id: true, patternWoId: true, sewingWoId: true },
    })
    if (!baseSample) {
      return { ok: false, error: "確定サンプルが未指定です" }
    }

    // (b) 発注群の特定（PO: sampleProductionId / WO: samplProductionId ∪ pattern/sewing）
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        companyId: sess.companyId,
        sampleProductionId: baseSample.id,
        deletedAt: null,
      },
      select: { id: true },
    })
    const woIdSet = new Set<string>()
    if (baseSample.patternWoId) woIdSet.add(baseSample.patternWoId)
    if (baseSample.sewingWoId) woIdSet.add(baseSample.sewingWoId)
    const linkedWos = await prisma.workOrder.findMany({
      where: {
        companyId: sess.companyId,
        samplProductionId: baseSample.id,
        deletedAt: null,
      },
      select: { id: true },
    })
    for (const w of linkedWos) woIdSet.add(w.id)
    // pattern/sewing WO を含め deletedAt null・会社スコープの実在のみ残す。
    const liveWos = woIdSet.size
      ? await prisma.workOrder.findMany({
          where: {
            id: { in: [...woIdSet] },
            companyId: sess.companyId,
            deletedAt: null,
          },
          select: { id: true },
        })
      : []
    const woIds = liveWos.map((w) => w.id)
    const poIds = pos.map((p) => p.id)

    const [poItems, woItems] = await Promise.all([
      poIds.length
        ? prisma.poItem.findMany({
            where: { poId: { in: poIds } },
            orderBy: [{ poId: "asc" }, { itemOrder: "asc" }],
          })
        : Promise.resolve([]),
      woIds.length
        ? prisma.woItem.findMany({
            where: { woId: { in: woIds } },
            orderBy: [{ woId: "asc" }, { itemOrder: "asc" }],
          })
        : Promise.resolve([]),
    ])

    // (c) BOM 既定値（生地行の usagePerUnit/lossRate/procurementMode）
    const bom = await prisma.bom.findFirst({
      where: { productId, companyId: sess.companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    const bomItems = bom
      ? await prisma.bomItem.findMany({
          where: { bomId: bom.id, materialId: { not: null } },
          select: {
            materialId: true,
            usagePerUnit: true,
            lossRate: true,
            procurementMode: true,
            unit: true,
          },
        })
      : []
    const bomByMaterial = new Map(
      bomItems
        .filter((b) => b.materialId)
        .map((b) => [b.materialId as string, b]),
    )

    // Material 反情報（ROLL 既定値・名称解決）
    const materialIds = [
      ...new Set(
        poItems
          .map((p) => p.materialId)
          .filter((x): x is string => x !== null),
      ),
    ]
    const materials = materialIds.length
      ? await prisma.material.findMany({
          where: { id: { in: materialIds }, companyId: sess.companyId },
          select: {
            id: true,
            materialName: true,
            materialNameEn: true,
            rollLength: true,
            rollPrice: true,
            currency: true,
          },
        })
      : []
    const materialById = new Map(materials.map((m) => [m.id, m]))

    // (d) 見積数量＝Σ Sku.productionQuantity（0 なら 0 のまま）
    const skus = await prisma.sku.findMany({
      where: { productId, companyId: sess.companyId },
      select: { productionQuantity: true },
    })
    const estimateQuantity = skus.reduce(
      (s, r) => s + r.productionQuantity,
      0,
    )

    const { rate: marginRate, source: marginRateSource } =
      await resolvePeMarginRate(sess.companyId, product.brandId, {
        marginRate: null,
        marginRateSource: null,
      })

    // (c) スナップショットコピー → FullItem[]
    const fulls: FullItem[] = []
    let order = 0

    for (const p of poItems) {
      const sep =
        p.billingClassification === BillingClassification.INDIVIDUAL_BILLING
      const bomDef = p.materialId ? bomByMaterial.get(p.materialId) : undefined
      const mat = p.materialId ? materialById.get(p.materialId) : undefined
      // 案A（PR-2 追加修正）: MATERIAL 行はすべて所要量ベース。BOM 既定があれば優先、
      // 無ければ付属既定 usagePerUnit=1・lossRate=0（＝単価×見積数量）を焼き込む。
      const usagePerUnit =
        bomDef?.usagePerUnit != null ? Number(bomDef.usagePerUnit) : 1
      const lossRate = bomDef?.lossRate != null ? Number(bomDef.lossRate) : 0
      const procurementMode = bomDef?.procurementMode ?? null
      const isRoll = procurementMode === FabricProcurementMode.ROLL
      fulls.push({
        key: String(order),
        itemOrder: order,
        itemCategory: ProductionEstimateCategory.MATERIAL,
        isSeparateBilling: sep,
        // コピー行は自社手配を既定（seed① は自社が発注した実績のため）。
        procurementRoute: ProcurementRoute.COMPANY_ARRANGED,
        itemName: p.customItemName ?? mat?.materialName ?? "（品目名未設定）",
        itemNameEn: p.customItemNameEn ?? mat?.materialNameEn ?? null,
        materialId: p.materialId,
        costCategoryId: p.costCategoryId,
        source: ProductionEstimateItemSource.SAMPLE_PO,
        sourcePoItemId: p.id,
        sourceWoItemId: null,
        sourceBomItemId: null,
        unitPrice: dnum(p.unitPrice),
        currency: p.currency,
        usagePerUnit,
        lossRate,
        procurementMode,
        rollLength: isRoll && mat?.rollLength != null ? Number(mat.rollLength) : null,
        rollPrice: isRoll && mat?.rollPrice != null ? Number(mat.rollPrice) : null,
        rollCurrency: isRoll ? mat?.currency ?? null : null,
        cutFee: null,
        quantity: Number(p.quantity),
        // 単位は所要量表示の基準（使用量/枚 の単位）。BOM 既定があれば BomItem.unit、
        // 無ければ PoItem.unit（購入単位）を焼き込む（PR-2 追加修正2・§1）。
        unit: bomDef?.unit ?? p.unit,
        presentedPriceManualJpy: null,
        notes: null,
      })
      order++
    }

    for (const w of woItems) {
      const sep =
        w.billingClassification === BillingClassification.INDIVIDUAL_BILLING
      fulls.push({
        key: String(order),
        itemOrder: order,
        itemCategory: ProductionEstimateCategory.LABOR,
        isSeparateBilling: sep,
        // コピー行は自社手配を既定（seed① は自社が発注した実績のため）。
        procurementRoute: ProcurementRoute.COMPANY_ARRANGED,
        itemName: w.workDescription,
        itemNameEn: null,
        materialId: null,
        costCategoryId: w.costCategoryId,
        source: ProductionEstimateItemSource.SAMPLE_WO,
        sourcePoItemId: null,
        sourceWoItemId: w.id,
        sourceBomItemId: null,
        unitPrice: dnum(w.unitPrice),
        currency: w.currency,
        usagePerUnit: null,
        lossRate: 0,
        procurementMode: null,
        rollLength: null,
        rollPrice: null,
        rollCurrency: null,
        cutFee: null,
        quantity: w.quantity,
        unit: w.unit,
        presentedPriceManualJpy: null,
        notes: null,
      })
      order++
    }

    // §1-6: コピー時は exchangeRate を確定させない（人が編集で入力）。USD 行は一旦除外表示。
    const calc = computeProductionEstimate(
      fulls.map(toCalcLine),
      estimateQuantity,
      marginRate,
      null,
    )
    const calcById = new Map(calc.rows.map((r) => [r.itemId, r]))

    const prefix = estimateNumberPrefix(new Date().getFullYear())
    let created: { id: string; estimateNumber: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx) => {
            const estimateNumber = await computeNextEstimateNumber(
              tx.productionEstimate,
              sess.companyId,
              prefix,
            )
            const header = await tx.productionEstimate.create({
              data: {
                companyId: sess.companyId,
                estimateNumber,
                productId,
                sourceSampleProductionId: baseSample.id,
                estimateQuantity,
                currency: Currency.JPY,
                exchangeRateUsdJpy: null,
                marginRate: dec(marginRate),
                marginRateSource,
                autoUnitCostJpy: dec(calc.autoUnitCostJpy),
                autoUnitPriceJpy: dec(calc.autoUnitPriceJpy),
                createdByUserId: sess.userId,
              },
              select: { id: true, estimateNumber: true },
            })
            await tx.productionEstimateItem.createMany({
              data: fulls.map((f) => {
                const row = calcById.get(f.key)
                return {
                  ...toItemCreateBase(f),
                  productionEstimateId: header.id,
                  subtotal: dec(row?.subtotal ?? null),
                  subtotalJpy: dec(row?.subtotalJpy ?? null),
                }
              }),
            })
            return header
          },
          { timeout: 15000 },
        )
        break
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue
        }
        throw e
      }
    }

    if (!created) {
      return {
        ok: false,
        error:
          lastError instanceof Error
            ? `採番衝突が解消されませんでした：${lastError.message}`
            : "採番衝突が解消されませんでした",
      }
    }

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "ProductionEstimate",
        entityId: created.id,
        afterData: {
          estimateNumber: created.estimateNumber,
          productId,
          sourceSampleProductionId: baseSample.id,
          estimateQuantity,
          itemCount: fulls.length,
          autoUnitCostJpy: calc.autoUnitCostJpy,
          autoUnitPriceJpy: calc.autoUnitPriceJpy,
        },
      },
    })

    revalidatePath(`/products/${productId}`)
    return {
      ok: true,
      data: { id: created.id, estimateNumber: created.estimateNumber },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "見積の作成に失敗しました",
    }
  }
}

// =============================================================================
// 更新（編集フォーム）
// =============================================================================
export async function updateProductionEstimate(
  id: string,
  input: ProductionEstimateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = productionEstimateInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.productionEstimate.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productId: true },
    })
    if (!existing) return { ok: false, error: "量産見積が見つかりません" }

    const product = await prisma.product.findFirst({
      where: { id: data.productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, brandId: true },
    })
    if (!product) return { ok: false, error: "指定された品番が見つかりません" }

    const { rate: marginRate, source: marginRateSource } =
      await resolvePeMarginRate(sess.companyId, product.brandId, {
        marginRate: data.marginRate,
        marginRateSource: data.marginRateSource,
      })

    const fulls = data.items.map((it, i) => fromInputItem(it, i))
    const calc = computeProductionEstimate(
      fulls.map(toCalcLine),
      data.estimateQuantity,
      marginRate,
      data.exchangeRateUsdJpy,
    )
    const calcById = new Map(calc.rows.map((r) => [r.itemId, r]))
    const finalUnitPriceManualJpy = data.finalUnitPriceManualJpy ?? null

    const updated = await prisma.$transaction(
      async (tx) => {
        const row = await tx.productionEstimate.update({
          where: { id },
          data: {
            productId: data.productId,
            title: data.title || null,
            notes: data.notes || null,
            estimateQuantity: data.estimateQuantity,
            currency: data.currency,
            exchangeRateUsdJpy: dec(data.exchangeRateUsdJpy),
            marginRate: dec(marginRate),
            marginRateSource,
            initialCostBillingMode: data.initialCostBillingMode,
            autoUnitCostJpy: dec(calc.autoUnitCostJpy),
            autoUnitPriceJpy: dec(calc.autoUnitPriceJpy),
            finalUnitPriceManualJpy: dec(finalUnitPriceManualJpy),
          },
        })
        // 明細はヘッダ従属（deletedAt なし・Cascade）＝全削除→再作成。
        await tx.productionEstimateItem.deleteMany({
          where: { productionEstimateId: id },
        })
        if (fulls.length) {
          await tx.productionEstimateItem.createMany({
            data: fulls.map((f) => {
              const cr = calcById.get(f.key)
              return {
                ...toItemCreateBase(f),
                productionEstimateId: id,
                subtotal: dec(cr?.subtotal ?? null),
                subtotalJpy: dec(cr?.subtotalJpy ?? null),
              }
            }),
          })
        }
        return row
      },
      { timeout: 15000 },
    )

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ProductionEstimate",
        entityId: updated.id,
        afterData: {
          productId: data.productId,
          estimateQuantity: data.estimateQuantity,
          marginRate,
          marginRateSource,
          autoUnitCostJpy: calc.autoUnitCostJpy,
          autoUnitPriceJpy: calc.autoUnitPriceJpy,
          finalUnitPriceManualJpy,
          itemCount: fulls.length,
        },
      },
    })

    revalidatePath(`/products/${data.productId}`)
    revalidatePath(`/production-estimates/${id}`)
    return { ok: true, data: { id: updated.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// 論理削除
// =============================================================================
export async function softDeleteProductionEstimate(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.productionEstimate.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productId: true, estimateNumber: true },
    })
    if (!existing) return { ok: false, error: "量産見積が見つかりません" }

    await prisma.productionEstimate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "ProductionEstimate",
        entityId: existing.id,
        beforeData: { estimateNumber: existing.estimateNumber },
      },
    })

    revalidatePath(`/products/${existing.productId}`)
    return { ok: true, data: { id: existing.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "削除に失敗しました",
    }
  }
}

// =============================================================================
// 取得（詳細・編集共用 DTO）
// =============================================================================
export async function getProductionEstimate(
  id: string,
): Promise<ActionResult<ProductionEstimateDTO>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const header = await prisma.productionEstimate.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!header) return { ok: false, error: "量産見積が見つかりません" }

    const items = await prisma.productionEstimateItem.findMany({
      where: { productionEstimateId: id },
      orderBy: { itemOrder: "asc" },
    })

    return {
      ok: true,
      data: {
        id: header.id,
        estimateNumber: header.estimateNumber,
        productId: header.productId,
        sourceSampleProductionId: header.sourceSampleProductionId,
        issuedAt: header.issuedAt.toISOString(),
        title: header.title,
        notes: header.notes,
        estimateQuantity: header.estimateQuantity,
        currency: header.currency,
        exchangeRateUsdJpy: dnum(header.exchangeRateUsdJpy),
        marginRate: dnum(header.marginRate),
        marginRateSource: header.marginRateSource,
        initialCostBillingMode: header.initialCostBillingMode,
        autoUnitCostJpy: dnum(header.autoUnitCostJpy),
        autoUnitPriceJpy: dnum(header.autoUnitPriceJpy),
        finalUnitPriceManualJpy: dnum(header.finalUnitPriceManualJpy),
        items: items.map((it) => ({
          id: it.id,
          itemOrder: it.itemOrder,
          itemCategory: it.itemCategory,
          isSeparateBilling: it.isSeparateBilling,
          procurementRoute: it.procurementRoute,
          itemName: it.itemName,
          itemNameEn: it.itemNameEn,
          materialId: it.materialId,
          costCategoryId: it.costCategoryId,
          source: it.source,
          sourcePoItemId: it.sourcePoItemId,
          sourceWoItemId: it.sourceWoItemId,
          sourceBomItemId: it.sourceBomItemId,
          unitPrice: dnum(it.unitPrice),
          currency: it.currency,
          usagePerUnit: dnum(it.usagePerUnit),
          lossRate: Number(it.lossRate),
          procurementMode: it.procurementMode,
          rollLength: dnum(it.rollLength),
          rollPrice: dnum(it.rollPrice),
          rollCurrency: it.rollCurrency,
          cutFee: dnum(it.cutFee),
          quantity: dnum(it.quantity),
          unit: it.unit,
          subtotal: dnum(it.subtotal),
          subtotalJpy: dnum(it.subtotalJpy),
          presentedPriceManualJpy: dnum(it.presentedPriceManualJpy),
          notes: it.notes,
        })),
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "取得に失敗しました",
    }
  }
}

// =============================================================================
// 品番カルテ用: 発行履歴 ＋ 基準サンプル有無
// =============================================================================
export async function getProductionEstimateSection(productId: string): Promise<{
  rows: ProductionEstimateListRow[]
  hasBaseSample: boolean
}> {
  const sess = await requireSession()
  if (!sess.ok) return { rows: [], hasBaseSample: false }

  const [estimates, baseCount] = await Promise.all([
    prisma.productionEstimate.findMany({
      where: { companyId: sess.companyId, productId, deletedAt: null },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        estimateNumber: true,
        issuedAt: true,
        title: true,
        estimateQuantity: true,
        currency: true,
        autoUnitCostJpy: true,
        autoUnitPriceJpy: true,
        finalUnitPriceManualJpy: true,
        items: {
          select: {
            isSeparateBilling: true,
            presentedPriceManualJpy: true,
          },
        },
      },
    }),
    prisma.sampleProduction.count({
      where: {
        companyId: sess.companyId,
        productId,
        isProductionEstimateBase: true,
        deletedAt: null,
      },
    }),
  ])

  const rows: ProductionEstimateListRow[] = estimates.map((e) => {
    const separateTotalJpy = e.items.reduce((acc, it) => {
      if (!it.isSeparateBilling || it.presentedPriceManualJpy == null) {
        return acc
      }
      return acc + Number(it.presentedPriceManualJpy)
    }, 0)
    return {
      id: e.id,
      estimateNumber: e.estimateNumber,
      issuedAt: e.issuedAt.toISOString(),
      title: e.title,
      estimateQuantity: e.estimateQuantity,
      currency: e.currency,
      autoUnitCostJpy: dnum(e.autoUnitCostJpy),
      autoUnitPriceJpy: dnum(e.autoUnitPriceJpy),
      finalUnitPriceManualJpy: dnum(e.finalUnitPriceManualJpy),
      separateTotalJpy,
    }
  })

  return { rows, hasBaseSample: baseCount > 0 }
}

// =============================================================================
// 会社横断一覧（/quotations 用・listRoughEstimatesForCompany の house style 踏襲）
// productId → Product を in 句一括結合で解決（N+1 回避）。
// =============================================================================
export type CompanyProductionEstimateRow = {
  id: string
  estimateNumber: string
  productId: string
  productName: string
  productCode: string
  /** 宛先クライアント（PDF 一括出力の混在ガード用）。 */
  clientId: string
  title: string | null
  issuedAt: string // ISO
  estimateQuantity: number
  /** 最終1枚単価 = finalUnitPriceManualJpy ?? autoUnitPriceJpy。 */
  finalUnitPriceJpy: number | null
}

export async function listProductionEstimatesForCompany(): Promise<
  CompanyProductionEstimateRow[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []

  const estimates = await prisma.productionEstimate.findMany({
    where: { companyId: sess.companyId, deletedAt: null },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      estimateNumber: true,
      productId: true,
      title: true,
      issuedAt: true,
      estimateQuantity: true,
      finalUnitPriceManualJpy: true,
      autoUnitPriceJpy: true,
    },
  })

  const productIds = [...new Set(estimates.map((e) => e.productId))]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { companyId: sess.companyId, id: { in: productIds } },
        select: { id: true, productName: true, productCode: true, clientId: true },
      })
    : []
  const productById = new Map(products.map((p) => [p.id, p]))

  return estimates.map((e) => {
    const product = productById.get(e.productId)
    return {
      id: e.id,
      estimateNumber: e.estimateNumber,
      productId: e.productId,
      productName: product?.productName ?? "—",
      productCode: product?.productCode ?? "—",
      clientId: product?.clientId ?? "",
      title: e.title,
      issuedAt: e.issuedAt.toISOString(),
      estimateQuantity: e.estimateQuantity,
      finalUnitPriceJpy:
        dnum(e.finalUnitPriceManualJpy) ?? dnum(e.autoUnitPriceJpy),
    }
  })
}

// =============================================================================
// (B) 量産発注生成 コンテキスト（read 系・生成画面が消費）
//   §3/§5: procurementRoute=COMPANY_ARRANGED かつ isSeparateBilling=false の行のみ。
//   §2: 相手先を生成時に導出（元伝票 → primarySupplier → 人指定）。
// =============================================================================

/** 明細行の導出済み相手先。MATERIAL→仕入先(PO)・LABOR→工場/外注先(WO)。 */
export type GenLineTarget =
  | {
      kind: "MATERIAL"
      supplierId: string | null
      supplierSource: "sourcePo" | "material" | null
    }
  | {
      kind: "LABOR"
      targetType: "factory" | "contractor" | null
      targetId: string | null
      workType: WorkOrderType | null
      targetSource: "sourceWo" | null
    }

/** 生成対象の PE 明細行（生地/付属/工賃の判定材料を全部載せる）。 */
export type GenLine = {
  peItemId: string
  itemOrder: number
  itemCategory: "MATERIAL" | "LABOR"
  itemName: string
  materialId: string | null
  costCategoryId: string | null
  unitPrice: number | null
  currency: Currency
  usagePerUnit: number | null
  lossRate: number
  procurementMode: FabricProcurementMode | null
  rollLength: number | null
  rollPrice: number | null
  rollCurrency: Currency | null
  cutFee: number | null
  quantity: number | null
  unit: string | null
  sourcePoItemId: string | null
  sourceWoItemId: string | null
  target: GenLineTarget
}

export type GenSkuCell = {
  skuId: string
  size: string
  sizeOrder: number
  productionQuantity: number
}
export type GenColorwayGroup = {
  colorwayId: string
  colorwayCode: string
  colorwayName: string
  sizes: GenSkuCell[]
}

export type ProductionOrderGenerationContext = {
  pe: {
    id: string
    estimateNumber: string
    productId: string
    productCode: string
    estimateQuantity: number
    currency: Currency
    exchangeRateUsdJpy: number | null
  }
  lines: GenLine[]
  colorways: GenColorwayGroup[]
  options: {
    suppliers: SupplierOption[]
    factories: FactoryOption[]
    contractors: ContractorOption[]
  }
}

export async function getProductionOrderGenerationContext(
  peId: string,
): Promise<ActionResult<ProductionOrderGenerationContext>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const pe = await prisma.productionEstimate.findFirst({
      where: { id: peId, companyId: sess.companyId, deletedAt: null },
    })
    if (!pe) return { ok: false, error: "量産見積が見つかりません" }

    const product = await prisma.product.findFirst({
      where: { id: pe.productId, companyId: sess.companyId },
      select: { productCode: true },
    })

    // §3/§5: 生成対象は COMPANY_ARRANGED かつ 非別枠のみ（初期費用・支給・引き当ては除外）。
    const items = await prisma.productionEstimateItem.findMany({
      where: {
        productionEstimateId: peId,
        procurementRoute: ProcurementRoute.COMPANY_ARRANGED,
        isSeparateBilling: false,
      },
      orderBy: { itemOrder: "asc" },
    })

    // 相手先導出のための一括参照。
    const poItemIds = items
      .map((it) => it.sourcePoItemId)
      .filter((v): v is string => !!v)
    const woItemIds = items
      .map((it) => it.sourceWoItemId)
      .filter((v): v is string => !!v)
    const materialIds = items
      .map((it) => it.materialId)
      .filter((v): v is string => !!v)

    const [srcPoItems, srcWoItems, mats] = await Promise.all([
      poItemIds.length
        ? prisma.poItem.findMany({
            where: { id: { in: poItemIds } },
            select: { id: true, po: { select: { supplierId: true } } },
          })
        : Promise.resolve([]),
      woItemIds.length
        ? prisma.woItem.findMany({
            where: { id: { in: woItemIds } },
            select: {
              id: true,
              wo: {
                select: {
                  factoryId: true,
                  contractorId: true,
                  workType: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      materialIds.length
        ? prisma.material.findMany({
            where: { id: { in: materialIds }, companyId: sess.companyId },
            select: { id: true, primarySupplierId: true },
          })
        : Promise.resolve([]),
    ])
    const poItemById = new Map(srcPoItems.map((r) => [r.id, r]))
    const woItemById = new Map(srcWoItems.map((r) => [r.id, r]))
    const matById = new Map(mats.map((r) => [r.id, r]))

    const lines: GenLine[] = items.map((it) => {
      const isMaterial = it.itemCategory === ProductionEstimateCategory.MATERIAL
      let target: GenLineTarget
      if (isMaterial) {
        // (1) 元 PO の仕入先 → (2) Material.primarySupplierId → (3) null
        let supplierId: string | null = null
        let supplierSource: "sourcePo" | "material" | null = null
        if (it.sourcePoItemId && poItemById.get(it.sourcePoItemId)) {
          supplierId = poItemById.get(it.sourcePoItemId)!.po.supplierId
          supplierSource = "sourcePo"
        } else if (it.materialId && matById.get(it.materialId)) {
          supplierId = matById.get(it.materialId)!.primarySupplierId
          supplierSource = "material"
        }
        target = { kind: "MATERIAL", supplierId, supplierSource }
      } else {
        // LABOR: (1) 元 WO の工場/外注先＋workType → (2) null
        let targetType: "factory" | "contractor" | null = null
        let targetId: string | null = null
        let workType: WorkOrderType | null = null
        let targetSource: "sourceWo" | null = null
        const src = it.sourceWoItemId
          ? woItemById.get(it.sourceWoItemId)
          : undefined
        if (src) {
          if (src.wo.factoryId) {
            targetType = "factory"
            targetId = src.wo.factoryId
          } else if (src.wo.contractorId) {
            targetType = "contractor"
            targetId = src.wo.contractorId
          }
          workType = src.wo.workType
          targetSource = "sourceWo"
        }
        target = { kind: "LABOR", targetType, targetId, workType, targetSource }
      }
      return {
        peItemId: it.id,
        itemOrder: it.itemOrder,
        itemCategory: isMaterial ? "MATERIAL" : "LABOR",
        itemName: it.itemName,
        materialId: it.materialId,
        costCategoryId: it.costCategoryId,
        unitPrice: dnum(it.unitPrice),
        currency: it.currency,
        usagePerUnit: dnum(it.usagePerUnit),
        lossRate: Number(it.lossRate),
        procurementMode: it.procurementMode,
        rollLength: dnum(it.rollLength),
        rollPrice: dnum(it.rollPrice),
        rollCurrency: it.rollCurrency,
        cutFee: dnum(it.cutFee),
        quantity: dnum(it.quantity),
        unit: it.unit,
        sourcePoItemId: it.sourcePoItemId,
        sourceWoItemId: it.sourceWoItemId,
        target,
      }
    })

    // SKU 一覧をカラーウェイ別にグループ化（既定数量＝Sku.productionQuantity）。
    const skus = await prisma.sku.findMany({
      where: { productId: pe.productId, deletedAt: null },
      select: {
        id: true,
        size: true,
        sizeOrder: true,
        productionQuantity: true,
        colorwayId: true,
        colorway: {
          select: { id: true, colorwayCode: true, colorwayName: true },
        },
      },
      orderBy: [{ colorway: { sortOrder: "asc" } }, { sizeOrder: "asc" }],
    })
    const groupMap = new Map<string, GenColorwayGroup>()
    for (const s of skus) {
      let g = groupMap.get(s.colorwayId)
      if (!g) {
        g = {
          colorwayId: s.colorwayId,
          colorwayCode: s.colorway.colorwayCode,
          colorwayName: s.colorway.colorwayName,
          sizes: [],
        }
        groupMap.set(s.colorwayId, g)
      }
      g.sizes.push({
        skuId: s.id,
        size: s.size,
        sizeOrder: s.sizeOrder,
        productionQuantity: s.productionQuantity,
      })
    }
    const colorways = [...groupMap.values()]

    const [suppliers, factories, contractors] = await Promise.all([
      listActiveSuppliersForPoSelect(),
      listActiveFactoriesForWoSelect(),
      listActiveContractorsForWoSelect(),
    ])

    return {
      ok: true,
      data: {
        pe: {
          id: pe.id,
          estimateNumber: pe.estimateNumber,
          productId: pe.productId,
          productCode: product?.productCode ?? "—",
          estimateQuantity: pe.estimateQuantity,
          currency: pe.currency,
          exchangeRateUsdJpy: dnum(pe.exchangeRateUsdJpy),
        },
        lines,
        colorways,
        options: { suppliers, factories, contractors },
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "生成コンテキスト取得に失敗しました",
    }
  }
}
