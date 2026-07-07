"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  Currency,
  MarginRateSource,
  RoughEstimateCategory,
  type RoughEstimate,
  type RoughEstimateItemSource,
  type InitialCostBillingMode,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  roughEstimateInputSchema,
  type RoughEstimateInput,
} from "@/lib/validators/rough-estimate"
import {
  computeAutoCostTotalJpy,
  computeAutoPriceTotalJpy,
  isBelowMarginWarning,
  type RoughEstimateLineForCalc,
} from "@/lib/rough-estimate/calc"

/**
 * QE-1R（概算量産見積）Server Actions（実装ブリーフ §2〜§4 / P2）。
 *
 * 設計方針:
 * - 業務トランザクション（master-patterns 非適用）。採番 RE-{年}-{4桁}（companyId×年・保存時 tx 確定・P2002 リトライ）。
 * - house style: @relation traversal/include 不使用・明示クエリ + in 句一括結合。
 * - 集計は純関数（src/lib/rough-estimate/calc.ts）へ委譲。★原価分子に INITIAL_COST を混ぜない（v0.1 §6）。
 * - 過去実額引き当てはスナップショットコピー（金額は明細へ焼き込み・sourcePoItemId/sourceWoItemId は出所記録のみ）。
 */

// =============================================================================
// 戻り値の型
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

// =============================================================================
// デフォルト利益率の供給（§4）: productId → Product.brandId → Brand.defaultMarginRate
// scalar FK ゆえ relation 経由でなく明示クエリで辿る。
// =============================================================================
async function fetchBrandDefaultMarginRate(
  companyId: string,
  brandId: string,
): Promise<number | null> {
  const brand = await prisma.brand.findFirst({
    where: { id: brandId, companyId, deletedAt: null },
    select: { defaultMarginRate: true },
  })
  return brand?.defaultMarginRate != null ? Number(brand.defaultMarginRate) : null
}

/** UI プレフィル用：品番のブランド既定利益率（null なら 0 開始）。 */
export async function getDefaultMarginRateForProduct(
  productId: string,
): Promise<ActionResult<{ marginRate: number; marginRateSource: MarginRateSource }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId: sess.companyId, deletedAt: null },
      select: { brandId: true },
    })
    if (!product) return { ok: false, error: "品番が見つかりません" }
    const def = await fetchBrandDefaultMarginRate(sess.companyId, product.brandId)
    // null フォールバック: 0 開始（§4・v0.1 論点1=(a)）。0 は赤字警告対象。
    return {
      ok: true,
      data: {
        marginRate: def ?? 0,
        marginRateSource: MarginRateSource.BRAND_DEFAULT,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "利益率の取得に失敗しました",
    }
  }
}

/**
 * 適用利益率と出所を確定する。
 * - marginRate 明示入力あり → 値をそのまま採用・source=MANUAL_OVERRIDE（明示指定があればそれを優先）。
 * - 未指定 → Brand.defaultMarginRate を供給・source=BRAND_DEFAULT。null なら 0 開始。
 */
async function resolveMarginRate(
  companyId: string,
  brandId: string,
  input: RoughEstimateInput,
): Promise<{ rate: number; source: MarginRateSource }> {
  if (input.marginRate != null) {
    return {
      rate: input.marginRate,
      source: input.marginRateSource ?? MarginRateSource.MANUAL_OVERRIDE,
    }
  }
  const def = await fetchBrandDefaultMarginRate(companyId, brandId)
  return { rate: def ?? 0, source: MarginRateSource.BRAND_DEFAULT }
}

// =============================================================================
// 過去実額引き当てクエリ（§5 ピッカー用）
// PoItem/WoItem は companyId を持たないため、親（PO/WO）ID を自社スコープで先引き→ in 句で明細取得。
// =============================================================================
export type PastPoItemCandidate = {
  poItemId: string
  poNumber: string
  poTitle: string | null // 引き当て元 PurchaseOrder.title（識別用）
  materialId: string | null // 焼き込み用に残す（素材マスター品目のとき非null）
  displayName: string // 表示名: customItemName 優先 → 素材名 → 「（過去発注）」
  color: string | null // 品目識別補助
  colorCode: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number
  currency: Currency
  subtotal: number | null
  orderDate: string | null
}

export type PastWoItemCandidate = {
  woItemId: string
  woNumber: string
  woTitle: string | null // 引き当て元 WorkOrder.title（識別用）
  costCategoryId: string | null
  workDescription: string
  quantity: number | null
  unit: string | null
  unitPrice: number
  currency: Currency
  subtotal: number | null
}

/**
 * 仕入先キーで過去 PoItem（単価確定分）を新しい順に引き当て候補として返す（PAST_PO）。
 * 素材マスター未登録の品目も引けるよう、materialId ではなく親 PurchaseOrder.supplierId で絞る。
 * 表示名は customItemName 優先、null なら素材名を一括解決して補う。
 */
export async function listPastPoItemsBySupplier(
  supplierId: string,
): Promise<PastPoItemCandidate[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  if (!supplierId) return []

  // その仕入先の PO だけを親として絞る（会社スコープ＋論理削除除外）。
  const pos = await prisma.purchaseOrder.findMany({
    where: { companyId: sess.companyId, deletedAt: null, supplierId },
    select: { id: true, poNumber: true, title: true, orderDate: true },
  })
  if (pos.length === 0) return []
  const poById = new Map(pos.map((p) => [p.id, p]))

  const items = await prisma.poItem.findMany({
    where: {
      poId: { in: [...poById.keys()] },
      unitPrice: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  // customItemName が null（素材マスター品目）の行の表示名用に、素材名を一括解決。
  const materialIds = [
    ...new Set(items.map((it) => it.materialId).filter((v): v is string => !!v)),
  ]
  const materialNameById = new Map<string, string>()
  if (materialIds.length > 0) {
    const mats = await prisma.material.findMany({
      where: { companyId: sess.companyId, id: { in: materialIds } },
      select: { id: true, materialName: true },
    })
    mats.forEach((m) => materialNameById.set(m.id, m.materialName))
  }

  return items.map((it) => {
    const po = poById.get(it.poId)
    const displayName =
      it.customItemName ??
      (it.materialId ? materialNameById.get(it.materialId) ?? null : null) ??
      "（過去発注）"
    return {
      poItemId: it.id,
      poNumber: po?.poNumber ?? "",
      poTitle: po?.title ?? null,
      materialId: it.materialId,
      displayName,
      color: it.color,
      colorCode: it.colorCode,
      quantity: it.quantity != null ? Number(it.quantity) : null,
      unit: it.unit,
      unitPrice: Number(it.unitPrice),
      currency: it.currency,
      subtotal: it.subtotal != null ? Number(it.subtotal) : null,
      orderDate: po?.orderDate ? po.orderDate.toISOString().slice(0, 10) : null,
    }
  })
}

/** costCategoryId キーで過去 WoItem（単価確定分）を新しい順に引き当て候補として返す（PAST_WO）。 */
export async function listPastWoItemsByCostCategory(
  costCategoryId: string,
): Promise<PastWoItemCandidate[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  if (!costCategoryId) return []

  const wos = await prisma.workOrder.findMany({
    where: { companyId: sess.companyId, deletedAt: null },
    select: { id: true, woNumber: true, title: true },
  })
  if (wos.length === 0) return []
  const woById = new Map(wos.map((w) => [w.id, w]))

  const items = await prisma.woItem.findMany({
    where: {
      woId: { in: [...woById.keys()] },
      costCategoryId,
      unitPrice: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return items.map((it) => {
    const wo = woById.get(it.woId)
    return {
    woItemId: it.id,
    woNumber: wo?.woNumber ?? "",
    woTitle: wo?.title ?? null,
    costCategoryId: it.costCategoryId,
    workDescription: it.workDescription,
    quantity: it.quantity != null ? Number(it.quantity) : null,
    unit: it.unit,
    unitPrice: Number(it.unitPrice),
    currency: it.currency,
    subtotal: it.subtotal != null ? Number(it.subtotal) : null,
    }
  })
}

// =============================================================================
// 採番（RE-{年}-{4桁}）— computeNextPoNumber と同作法
// =============================================================================
type ReNumberFinder = {
  findFirst: (args: {
    where: { companyId: string; estimateNumber: { startsWith: string } }
    orderBy: { estimateNumber: "desc" }
    select: { estimateNumber: true }
  }) => Promise<{ estimateNumber: string } | null>
}

function estimateNumberPrefix(year: number): string {
  return `RE-${year}-`
}

async function computeNextRoughEstimateNumber(
  finder: ReNumberFinder,
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

/** UI プレビュー専用：当年の次の RE 番号（保存時に再計算・確定）。 */
export async function generateNextRoughEstimateNumberPreview(): Promise<
  ActionResult<{ preview: string }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const preview = await computeNextRoughEstimateNumber(
      prisma.roughEstimate,
      sess.companyId,
      estimateNumberPrefix(new Date().getFullYear()),
    )
    return { ok: true, data: { preview } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "採番プレビューに失敗しました",
    }
  }
}

// =============================================================================
// 明細行の組み立て（subtotal＝行ネイティブ通貨・subtotalJpy＝入力レートで JPY 換算）
// =============================================================================
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** JPY 換算（JPY はそのまま・USD は入力レート・それ以外は validator でブロック済み）。 */
function toSubtotalJpy(
  subtotal: number | null,
  currency: Currency,
  usdJpyRate: number | null,
): number | null {
  if (subtotal === null) return null
  if (currency === Currency.JPY) return round2(subtotal)
  if (currency === Currency.USD) {
    return usdJpyRate != null ? round2(subtotal * usdJpyRate) : null
  }
  return null
}

type BuiltItem = {
  row: Omit<Prisma.RoughEstimateItemCreateManyInput, "roughEstimateId">
  calc: RoughEstimateLineForCalc
}

function buildItemRows(data: RoughEstimateInput): BuiltItem[] {
  return data.items.map((it, i) => {
    const hasSubtotal = it.quantity != null && it.unitPrice != null
    const subtotal = hasSubtotal
      ? round2(Number(it.quantity) * Number(it.unitPrice))
      : null
    const subtotalJpy = toSubtotalJpy(subtotal, it.currency, data.usdJpyRate)
    return {
      row: {
        itemOrder: i,
        itemCategory: it.itemCategory,
        itemName: it.itemName,
        itemNameEn: it.itemNameEn || null,
        materialId: it.materialId,
        costCategoryId: it.costCategoryId,
        source: it.source,
        sourcePoItemId: it.sourcePoItemId,
        sourceWoItemId: it.sourceWoItemId,
        quantity: it.quantity != null ? new Prisma.Decimal(it.quantity) : null,
        unit: it.unit || null,
        unitPrice: it.unitPrice != null ? new Prisma.Decimal(it.unitPrice) : null,
        currency: it.currency,
        subtotal: subtotal != null ? new Prisma.Decimal(subtotal) : null,
        subtotalJpy: subtotalJpy != null ? new Prisma.Decimal(subtotalJpy) : null,
        // 道A: 初期費用行の手打ち提示額のみ保持。他費目に来たら null に落とす（サーバ側ガード）。
        presentedPriceManualJpy:
          it.itemCategory === RoughEstimateCategory.INITIAL_COST &&
          it.presentedPriceManualJpy != null
            ? new Prisma.Decimal(it.presentedPriceManualJpy)
            : null,
        notes: it.notes || null,
      },
      calc: { itemCategory: it.itemCategory, subtotalJpy },
    }
  })
}

// =============================================================================
// 新規（採番 + ヘッダ + 明細群を同一 tx）
// =============================================================================
const CREATE_MAX_RETRIES = 3

export async function createRoughEstimate(
  input: RoughEstimateInput,
): Promise<ActionResult<{ id: string; estimateNumber: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = roughEstimateInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const product = await prisma.product.findFirst({
      where: { id: data.productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, brandId: true },
    })
    if (!product) return { ok: false, error: "指定された品番が見つかりません" }

    const { rate: marginRate, source: marginRateSource } = await resolveMarginRate(
      sess.companyId,
      product.brandId,
      data,
    )

    const built = buildItemRows(data)
    const lines = built.map((b) => b.calc)
    const autoCostTotalJpy = computeAutoCostTotalJpy(lines)
    const autoPriceTotalJpy = computeAutoPriceTotalJpy(lines, marginRate)
    // 道A: 手打ち1枚単価（任意）。旧 finalPriceManualJpy（総額手打ち）は書かない（列残置・非推奨）。
    const finalUnitPriceManualJpy = data.finalUnitPriceManualJpy ?? null

    const prefix = estimateNumberPrefix(new Date().getFullYear())
    let created: { id: string; estimateNumber: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx) => {
            const estimateNumber = await computeNextRoughEstimateNumber(
              tx.roughEstimate,
              sess.companyId,
              prefix,
            )
            const header = await tx.roughEstimate.create({
              data: {
                companyId: sess.companyId,
                estimateNumber,
                productId: data.productId,
                title: data.title || null,
                notes: data.notes || null,
                presentedMoq: data.presentedMoq,
                currency: data.currency,
                validUntil: data.validUntil ? new Date(data.validUntil) : null,
                marginRate: new Prisma.Decimal(marginRate),
                marginRateSource,
                initialCostBillingMode: data.initialCostBillingMode,
                autoCostTotalJpy: new Prisma.Decimal(autoCostTotalJpy),
                autoPriceTotalJpy: new Prisma.Decimal(autoPriceTotalJpy),
                // 道A: 総額手打ち finalPriceManualJpy は書かない（列残置・null のまま）。
                finalUnitPriceManualJpy:
                  finalUnitPriceManualJpy != null
                    ? new Prisma.Decimal(finalUnitPriceManualJpy)
                    : null,
                createdByUserId: sess.userId,
              },
              select: { id: true, estimateNumber: true },
            })
            await tx.roughEstimateItem.createMany({
              data: built.map((b) => ({
                ...b.row,
                roughEstimateId: header.id,
              })),
            })
            return header
            // 遅延 DB での部分コミット孤児を防ぐ安全マージン（既定5秒→15秒）
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
          continue // estimateNumber unique 衝突：再試行
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
        entityType: "RoughEstimate",
        entityId: created.id,
        afterData: {
          estimateNumber: created.estimateNumber,
          productId: data.productId,
          marginRate,
          marginRateSource,
          initialCostBillingMode: data.initialCostBillingMode,
          autoCostTotalJpy,
          autoPriceTotalJpy,
          finalUnitPriceManualJpy,
          itemCount: built.length,
        },
      },
    })

    revalidatePath(`/products/${data.productId}`)
    return {
      ok: true,
      data: { id: created.id, estimateNumber: created.estimateNumber },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "作成に失敗しました",
    }
  }
}

// =============================================================================
// 更新（ヘッダ + 明細差し替え。明細は全削除→再作成）
// =============================================================================
export async function updateRoughEstimate(
  id: string,
  input: RoughEstimateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = roughEstimateInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.roughEstimate.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) return { ok: false, error: "概算見積が見つかりません" }

    const product = await prisma.product.findFirst({
      where: { id: data.productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, brandId: true },
    })
    if (!product) return { ok: false, error: "指定された品番が見つかりません" }

    const { rate: marginRate, source: marginRateSource } = await resolveMarginRate(
      sess.companyId,
      product.brandId,
      data,
    )

    const built = buildItemRows(data)
    const lines = built.map((b) => b.calc)
    const autoCostTotalJpy = computeAutoCostTotalJpy(lines)
    const autoPriceTotalJpy = computeAutoPriceTotalJpy(lines, marginRate)
    // 道A: 手打ち1枚単価のみ更新。旧 finalPriceManualJpy（総額手打ち）は触らない（既存値放置）。
    const finalUnitPriceManualJpy = data.finalUnitPriceManualJpy ?? null

    const beforeSnapshot = {
      productId: existing.productId,
      marginRate: existing.marginRate != null ? Number(existing.marginRate) : null,
      marginRateSource: existing.marginRateSource,
      initialCostBillingMode: existing.initialCostBillingMode,
      autoCostTotalJpy:
        existing.autoCostTotalJpy != null
          ? Number(existing.autoCostTotalJpy)
          : null,
      autoPriceTotalJpy:
        existing.autoPriceTotalJpy != null
          ? Number(existing.autoPriceTotalJpy)
          : null,
      finalUnitPriceManualJpy:
        existing.finalUnitPriceManualJpy != null
          ? Number(existing.finalUnitPriceManualJpy)
          : null,
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        const row = await tx.roughEstimate.update({
          where: { id },
          data: {
            productId: data.productId,
            title: data.title || null,
            notes: data.notes || null,
            presentedMoq: data.presentedMoq,
            currency: data.currency,
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
            marginRate: new Prisma.Decimal(marginRate),
            marginRateSource,
            initialCostBillingMode: data.initialCostBillingMode,
            autoCostTotalJpy: new Prisma.Decimal(autoCostTotalJpy),
            autoPriceTotalJpy: new Prisma.Decimal(autoPriceTotalJpy),
            // 道A: finalPriceManualJpy（総額手打ち）は更新対象に含めない（既存値放置）。
            finalUnitPriceManualJpy:
              finalUnitPriceManualJpy != null
                ? new Prisma.Decimal(finalUnitPriceManualJpy)
                : null,
          },
        })
        // 明細は全削除→再作成（RoughEstimateItem は deletedAt を持たずヘッダ従属・Cascade）
        await tx.roughEstimateItem.deleteMany({ where: { roughEstimateId: id } })
        await tx.roughEstimateItem.createMany({
          data: built.map((b) => ({ ...b.row, roughEstimateId: id })),
        })
        return row
      },
      { timeout: 15000 },
    )

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "RoughEstimate",
        entityId: updated.id,
        beforeData: beforeSnapshot,
        afterData: {
          productId: data.productId,
          marginRate,
          marginRateSource,
          initialCostBillingMode: data.initialCostBillingMode,
          autoCostTotalJpy,
          autoPriceTotalJpy,
          finalUnitPriceManualJpy,
          itemCount: built.length,
        },
      },
    })

    revalidatePath(`/products/${data.productId}`)
    return { ok: true, data: { id: updated.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// ソフトデリート
// =============================================================================
export async function softDeleteRoughEstimate(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.roughEstimate.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productId: true, estimateNumber: true },
    })
    if (!existing) return { ok: false, error: "概算見積が見つかりません" }

    await prisma.roughEstimate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "RoughEstimate",
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
// 一覧（品番配下・P3 UI 用のサマリ行）
// =============================================================================
export type RoughEstimateListRow = {
  id: string
  estimateNumber: string
  issuedAt: string
  title: string | null
  presentedMoq: number | null
  currency: Currency
  marginRate: number | null
  marginRateSource: MarginRateSource
  initialCostBillingMode: InitialCostBillingMode
  autoCostTotalJpy: number | null
  autoPriceTotalJpy: number | null
  finalUnitPriceManualJpy: number | null
  belowMarginWarning: boolean
}

export async function listRoughEstimatesByProduct(
  productId: string,
): Promise<RoughEstimateListRow[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  const rows = await prisma.roughEstimate.findMany({
    where: { companyId: sess.companyId, productId, deletedAt: null },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      estimateNumber: true,
      issuedAt: true,
      title: true,
      presentedMoq: true,
      currency: true,
      marginRate: true,
      marginRateSource: true,
      initialCostBillingMode: true,
      autoCostTotalJpy: true,
      autoPriceTotalJpy: true,
      finalUnitPriceManualJpy: true,
    },
  })
  return rows.map((r) => {
    const marginRate = r.marginRate != null ? Number(r.marginRate) : null
    return {
      id: r.id,
      estimateNumber: r.estimateNumber,
      issuedAt: r.issuedAt.toISOString(),
      title: r.title,
      presentedMoq: r.presentedMoq,
      currency: r.currency,
      marginRate,
      marginRateSource: r.marginRateSource,
      initialCostBillingMode: r.initialCostBillingMode,
      autoCostTotalJpy:
        r.autoCostTotalJpy != null ? Number(r.autoCostTotalJpy) : null,
      autoPriceTotalJpy:
        r.autoPriceTotalJpy != null ? Number(r.autoPriceTotalJpy) : null,
      finalUnitPriceManualJpy:
        r.finalUnitPriceManualJpy != null
          ? Number(r.finalUnitPriceManualJpy)
          : null,
      belowMarginWarning: isBelowMarginWarning(marginRate),
    }
  })
}

// =============================================================================
// 会社横断一覧（/quotations 用・原価/利益率は載せない）
// productId → Product → Client を2段一括引きで宛先解決（N+1 回避）。
// =============================================================================
export type CompanyRoughEstimateRow = {
  id: string
  estimateNumber: string
  productId: string
  productName: string
  productCode: string
  clientId: string
  clientName: string
  title: string | null
  presentedMoq: number | null
  issuedAt: string // ISO
}

export async function listRoughEstimatesForCompany(): Promise<
  CompanyRoughEstimateRow[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []

  const estimates = await prisma.roughEstimate.findMany({
    where: { companyId: sess.companyId, deletedAt: null },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      estimateNumber: true,
      productId: true,
      title: true,
      presentedMoq: true,
      issuedAt: true,
    },
  })

  const productIds = [...new Set(estimates.map((e) => e.productId))]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { companyId: sess.companyId, id: { in: productIds } },
        select: {
          id: true,
          productName: true,
          productCode: true,
          clientId: true,
        },
      })
    : []
  const productById = new Map(products.map((p) => [p.id, p]))

  const clientIds = [...new Set(products.map((p) => p.clientId))]
  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { companyId: sess.companyId, id: { in: clientIds } },
        select: { id: true, companyName: true },
      })
    : []
  const clientById = new Map(clients.map((c) => [c.id, c]))

  return estimates.map((e) => {
    const product = productById.get(e.productId)
    const client = product ? clientById.get(product.clientId) : undefined
    return {
      id: e.id,
      estimateNumber: e.estimateNumber,
      productId: e.productId,
      productName: product?.productName ?? "—",
      productCode: product?.productCode ?? "—",
      clientId: product?.clientId ?? "",
      clientName: client?.companyName ?? "—",
      title: e.title,
      presentedMoq: e.presentedMoq,
      issuedAt: e.issuedAt.toISOString(),
    }
  })
}

// =============================================================================
// 単票取得（明細同梱・P3 UI / smoke 用）
// =============================================================================
export type RoughEstimateDetail = RoughEstimate & {
  items: Prisma.RoughEstimateItemGetPayload<object>[]
}

export async function getRoughEstimate(
  id: string,
): Promise<ActionResult<RoughEstimateDetail>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const header = await prisma.roughEstimate.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!header) return { ok: false, error: "概算見積が見つかりません" }

    const items = await prisma.roughEstimateItem.findMany({
      where: { roughEstimateId: id },
      orderBy: { itemOrder: "asc" },
    })
    return { ok: true, data: { ...header, items } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "取得に失敗しました",
    }
  }
}

// =============================================================================
// 編集プレフィル用（Decimal をクライアントへ渡さず plain number/string 化）
// =============================================================================
export type RoughEstimateEditItem = {
  itemCategory: RoughEstimateCategory
  itemName: string
  itemNameEn: string | null
  materialId: string | null
  costCategoryId: string | null
  source: RoughEstimateItemSource
  sourcePoItemId: string | null
  sourceWoItemId: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  currency: Currency
  /** 道A: 初期費用行の手打ち提示額（INITIAL_COST 行のみ非null 想定）。 */
  presentedPriceManualJpy: number | null
  notes: string | null
}

export type RoughEstimateEditData = {
  id: string
  estimateNumber: string
  productId: string
  title: string | null
  notes: string | null
  presentedMoq: number | null
  currency: Currency
  validUntil: string | null
  marginRate: number | null
  marginRateSource: MarginRateSource
  initialCostBillingMode: InitialCostBillingMode
  /** 道A: 手打ち1枚単価（金額の正）。旧 finalPriceManualJpy（総額手打ち）は返さない。 */
  finalUnitPriceManualJpy: number | null
  /** USD 行の subtotalJpy は保存済みだがレートは非保存（v1）。編集時は再入力を促す。 */
  hasUsdLine: boolean
  items: RoughEstimateEditItem[]
}

export async function getRoughEstimateForEdit(
  id: string,
): Promise<ActionResult<RoughEstimateEditData>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const header = await prisma.roughEstimate.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!header) return { ok: false, error: "概算見積が見つかりません" }

    const items = await prisma.roughEstimateItem.findMany({
      where: { roughEstimateId: id },
      orderBy: { itemOrder: "asc" },
    })

    return {
      ok: true,
      data: {
        id: header.id,
        estimateNumber: header.estimateNumber,
        productId: header.productId,
        title: header.title,
        notes: header.notes,
        presentedMoq: header.presentedMoq,
        currency: header.currency,
        validUntil: header.validUntil
          ? header.validUntil.toISOString().slice(0, 10)
          : null,
        marginRate: header.marginRate != null ? Number(header.marginRate) : null,
        marginRateSource: header.marginRateSource,
        initialCostBillingMode: header.initialCostBillingMode,
        finalUnitPriceManualJpy:
          header.finalUnitPriceManualJpy != null
            ? Number(header.finalUnitPriceManualJpy)
            : null,
        hasUsdLine: items.some((it) => it.currency === Currency.USD),
        items: items.map((it) => ({
          itemCategory: it.itemCategory,
          itemName: it.itemName,
          itemNameEn: it.itemNameEn,
          materialId: it.materialId,
          costCategoryId: it.costCategoryId,
          source: it.source,
          sourcePoItemId: it.sourcePoItemId,
          sourceWoItemId: it.sourceWoItemId,
          quantity: it.quantity != null ? Number(it.quantity) : null,
          unit: it.unit,
          unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
          currency: it.currency,
          presentedPriceManualJpy:
            it.presentedPriceManualJpy != null
              ? Number(it.presentedPriceManualJpy)
              : null,
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
// 複製プレフィル用（Part D）：既存見積を「新規作成の初期値」として返す read only。
// 書き込みは既存 createRoughEstimate に相乗り（採番・バリデーション・calc を二重実装しない）。
// =============================================================================
/** 複製プレフィル＝編集データから id/estimateNumber（採番は create 側）を落とした形。 */
export type RoughEstimateDuplicateData = Omit<
  RoughEstimateEditData,
  "id" | "estimateNumber"
>

export async function duplicateRoughEstimate(
  id: string,
): Promise<ActionResult<RoughEstimateDuplicateData>> {
  const r = await getRoughEstimateForEdit(id)
  if (!r.ok) return r
  const d = r.data
  // id/estimateNumber は Omit で落とす（採番は create 側）。
  const { id: _id, estimateNumber: _num, ...rest } = d
  void _id
  void _num
  return {
    ok: true,
    data: {
      ...rest,
      // §6-4: タイトルに「のコピー」付与。
      title: d.title ? `${d.title} のコピー` : "（コピー）",
      // 道A §6: 手打ち値（1枚単価・初期費用提示額）は各発行に固有 → リセット。
      finalUnitPriceManualJpy: null,
      items: rest.items.map((it) => ({ ...it, presentedPriceManualJpy: null })),
      // productId/notes/presentedMoq/currency/validUntil/marginRate/marginRateSource/
      // initialCostBillingMode/hasUsdLine/items（source・sourcePoItemId・sourceWoItemId の
      // 引き当て焼き込み含む）はそのまま引き継ぐ（rest 経由）。
    },
  }
}
