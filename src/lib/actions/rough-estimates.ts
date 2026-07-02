"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  Currency,
  MarginRateSource,
  type RoughEstimate,
  type RoughEstimateCategory,
  type RoughEstimateItemSource,
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
  materialId: string | null
  itemLabel: string | null
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
  costCategoryId: string | null
  workDescription: string
  quantity: number | null
  unit: string | null
  unitPrice: number
  currency: Currency
  subtotal: number | null
}

/** materialId キーで過去 PoItem（単価確定分）を新しい順に引き当て候補として返す（PAST_PO）。 */
export async function listPastPoItemsByMaterial(
  materialId: string,
): Promise<PastPoItemCandidate[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  if (!materialId) return []

  const pos = await prisma.purchaseOrder.findMany({
    where: { companyId: sess.companyId, deletedAt: null },
    select: { id: true, poNumber: true, orderDate: true },
  })
  if (pos.length === 0) return []
  const poById = new Map(pos.map((p) => [p.id, p]))

  const items = await prisma.poItem.findMany({
    where: {
      poId: { in: [...poById.keys()] },
      materialId,
      unitPrice: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  return items.map((it) => {
    const po = poById.get(it.poId)
    return {
      poItemId: it.id,
      poNumber: po?.poNumber ?? "",
      materialId: it.materialId,
      itemLabel: it.customItemName,
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
    select: { id: true, woNumber: true },
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

  return items.map((it) => ({
    woItemId: it.id,
    woNumber: woById.get(it.woId)?.woNumber ?? "",
    costCategoryId: it.costCategoryId,
    workDescription: it.workDescription,
    quantity: it.quantity != null ? Number(it.quantity) : null,
    unit: it.unit,
    unitPrice: Number(it.unitPrice),
    currency: it.currency,
    subtotal: it.subtotal != null ? Number(it.subtotal) : null,
  }))
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
    // 手打ち最終値の初期値＝自動提示価格（未指定時）。自動値は別列で常に保持。
    const finalPriceManualJpy =
      data.finalPriceManualJpy != null
        ? data.finalPriceManualJpy
        : autoPriceTotalJpy

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
                expectedQuantityBand: data.expectedQuantityBand || null,
                currency: data.currency,
                validUntil: data.validUntil ? new Date(data.validUntil) : null,
                marginRate: new Prisma.Decimal(marginRate),
                marginRateSource,
                autoCostTotalJpy: new Prisma.Decimal(autoCostTotalJpy),
                autoPriceTotalJpy: new Prisma.Decimal(autoPriceTotalJpy),
                finalPriceManualJpy: new Prisma.Decimal(finalPriceManualJpy),
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
          autoCostTotalJpy,
          autoPriceTotalJpy,
          finalPriceManualJpy,
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
    const finalPriceManualJpy =
      data.finalPriceManualJpy != null
        ? data.finalPriceManualJpy
        : autoPriceTotalJpy

    const beforeSnapshot = {
      productId: existing.productId,
      marginRate: existing.marginRate != null ? Number(existing.marginRate) : null,
      marginRateSource: existing.marginRateSource,
      autoCostTotalJpy:
        existing.autoCostTotalJpy != null
          ? Number(existing.autoCostTotalJpy)
          : null,
      autoPriceTotalJpy:
        existing.autoPriceTotalJpy != null
          ? Number(existing.autoPriceTotalJpy)
          : null,
      finalPriceManualJpy:
        existing.finalPriceManualJpy != null
          ? Number(existing.finalPriceManualJpy)
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
            expectedQuantityBand: data.expectedQuantityBand || null,
            currency: data.currency,
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
            marginRate: new Prisma.Decimal(marginRate),
            marginRateSource,
            autoCostTotalJpy: new Prisma.Decimal(autoCostTotalJpy),
            autoPriceTotalJpy: new Prisma.Decimal(autoPriceTotalJpy),
            finalPriceManualJpy: new Prisma.Decimal(finalPriceManualJpy),
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
          autoCostTotalJpy,
          autoPriceTotalJpy,
          finalPriceManualJpy,
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
  expectedQuantityBand: string | null
  currency: Currency
  marginRate: number | null
  marginRateSource: MarginRateSource
  autoCostTotalJpy: number | null
  autoPriceTotalJpy: number | null
  finalPriceManualJpy: number | null
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
      expectedQuantityBand: true,
      currency: true,
      marginRate: true,
      marginRateSource: true,
      autoCostTotalJpy: true,
      autoPriceTotalJpy: true,
      finalPriceManualJpy: true,
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
      expectedQuantityBand: r.expectedQuantityBand,
      currency: r.currency,
      marginRate,
      marginRateSource: r.marginRateSource,
      autoCostTotalJpy:
        r.autoCostTotalJpy != null ? Number(r.autoCostTotalJpy) : null,
      autoPriceTotalJpy:
        r.autoPriceTotalJpy != null ? Number(r.autoPriceTotalJpy) : null,
      finalPriceManualJpy:
        r.finalPriceManualJpy != null ? Number(r.finalPriceManualJpy) : null,
      belowMarginWarning: isBelowMarginWarning(marginRate),
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
  notes: string | null
}

export type RoughEstimateEditData = {
  id: string
  estimateNumber: string
  productId: string
  title: string | null
  notes: string | null
  presentedMoq: number | null
  expectedQuantityBand: string | null
  currency: Currency
  validUntil: string | null
  marginRate: number | null
  marginRateSource: MarginRateSource
  finalPriceManualJpy: number | null
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
        expectedQuantityBand: header.expectedQuantityBand,
        currency: header.currency,
        validUntil: header.validUntil
          ? header.validUntil.toISOString().slice(0, 10)
          : null,
        marginRate: header.marginRate != null ? Number(header.marginRate) : null,
        marginRateSource: header.marginRateSource,
        finalPriceManualJpy:
          header.finalPriceManualJpy != null
            ? Number(header.finalPriceManualJpy)
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
