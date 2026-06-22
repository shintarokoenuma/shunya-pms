"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  ProductStatus,
  ModelCodeStatus,
  type Product,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import { getSignedReadUrl } from "@/lib/gcs"
import { productBaseSchema, type ProductInput } from "@/lib/validators/product"
import { composeSeason } from "@/lib/constants/season-types"

/**
 * S-1: 品番カルテ（Product）Server Actions
 *
 * 設計方針（仕様議事録 v1.0 2026-06-06 / docs/specs/product-sample-spec-confirmation-v1_0-2026-06-06.md）:
 * - shunya-master-patterns v1.2 §5 標準の 8 関数構成を precedent として踏襲（Product はマスターでは
 *   ないが CRUD 作法は揃える）。
 * - 社内品番（productCode）採番：`{brandCode}-{season}-{categoryCode}-{連番3桁}`。
 *   companyId × brandId × season × categoryId ごとに 001 から。保存時に transaction 内で確定し、
 *   衝突時はリトライする。UI ではプレビューのみ。
 * - ModelCode は UI に出さず、createProduct の同一 transaction 内で1件自動発番して紐づける
 *   （Product.modelCodeId は NOT NULL。schema 無変更で満たすための A 案）。
 * - status 変更時は必ず ProductStatusHistory に記録（create 時は from=null → to=初期status）。
 * - clientId はフォームではなく brandId から導出（Brand.clientId）。
 * - update の AuditLog snapshot は B-006/B-015 と同様に Product 業務スカラを全件載せ、
 *   satisfies Record<ProductAuditField, unknown> で網羅をコンパイル時に強制する。
 *
 * Prisma スキーマ事情：
 * - Product.brandId / clientId / categoryId は FK 列のみで relation 宣言が無い（ModelCode 同様）。
 *   そのため Brand / Client / ProductCategory は別クエリで manual join する。
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type ProductUsage = {
  skuCount: number
  collectionLinkCount: number
  totalRefs: number
}

// =============================================================================
// 認証ヘルパー
// =============================================================================
async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
    tenantType: session.user.tenantType,
  }
}

// =============================================================================
// manual join 用サマリ
// =============================================================================
export type BrandSummary = {
  id: string
  brandCode: string
  brandName: string
  clientId: string
  client: {
    id: string
    clientCode: string
    companyName: string
  } | null
}

export type CategorySummary = {
  id: string
  categoryCode: string
  categoryName: string
  level: number
}

async function fetchBrandSummariesByIds(
  companyId: string,
  brandIds: string[],
): Promise<Map<string, BrandSummary>> {
  if (brandIds.length === 0) return new Map()
  const rows = await prisma.brand.findMany({
    where: { id: { in: brandIds }, companyId },
    select: {
      id: true,
      brandCode: true,
      brandName: true,
      clientId: true,
      client: { select: { id: true, clientCode: true, companyName: true } },
    },
  })
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        brandCode: r.brandCode,
        brandName: r.brandName,
        clientId: r.clientId,
        client: r.client,
      } satisfies BrandSummary,
    ]),
  )
}

async function fetchCategorySummariesByIds(
  companyId: string,
  categoryIds: string[],
): Promise<Map<string, CategorySummary>> {
  if (categoryIds.length === 0) return new Map()
  const rows = await prisma.productCategory.findMany({
    where: { id: { in: categoryIds }, companyId },
    select: { id: true, categoryCode: true, categoryName: true, level: true },
  })
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        categoryCode: r.categoryCode,
        categoryName: r.categoryName,
        level: r.level,
      } satisfies CategorySummary,
    ]),
  )
}

// =============================================================================
// 採番ヘルパー
// =============================================================================
type ProductCodeFinder = {
  findFirst: (args: {
    where: { companyId: string; productCode: { startsWith: string } }
    orderBy: { productCode: "desc" }
    select: { productCode: true }
  }) => Promise<{ productCode: string } | null>
}

type ModelCodeFinder = {
  findFirst: (args: {
    where: { companyId: string; modelCode: { startsWith: string } }
    orderBy: { modelCode: "desc" }
    select: { modelCode: true }
  }) => Promise<{ modelCode: string } | null>
}

function productCodePrefix(
  brandCode: string,
  season: string,
  categoryCode: string,
): string {
  // season も brandCode / categoryCode と同様に大文字化して採番する
  // （26ss と 26SS の表記ゆれが検索・突合の事故になるのを防ぐ）。
  return `${brandCode.toUpperCase()}-${season.toUpperCase()}-${categoryCode.toUpperCase()}-`
}


async function computeNextProductCode(
  finder: ProductCodeFinder,
  companyId: string,
  prefix: string,
): Promise<string> {
  const last = await finder.findFirst({
    where: { companyId, productCode: { startsWith: prefix } },
    orderBy: { productCode: "desc" },
    select: { productCode: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.productCode.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(3, "0")}`
}

async function computeNextModelCode(
  finder: ModelCodeFinder,
  companyId: string,
  brandCode: string,
): Promise<string> {
  const prefix = `M-${brandCode.toUpperCase()}-`
  const last = await finder.findFirst({
    where: { companyId, modelCode: { startsWith: prefix } },
    orderBy: { modelCode: "desc" },
    select: { modelCode: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.modelCode.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`
}

/**
 * UI のプレビュー専用：Brand / season / category 選択時に次の社内品番を返す。
 * 保存時は create 内で再計算され、衝突時にリトライされる（表示値は参考）。
 */
export async function generateNextProductCodePreview(input: {
  brandId: string
  season: string
  categoryId: string
}): Promise<ActionResult<{ preview: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const season = input.season.trim()
    if (!input.brandId || !input.categoryId || season.length === 0) {
      return { ok: false, error: "ブランド・シーズン・カテゴリを指定してください" }
    }

    const [brand, category] = await Promise.all([
      prisma.brand.findFirst({
        where: { id: input.brandId, companyId: sess.companyId, deletedAt: null },
        select: { brandCode: true },
      }),
      prisma.productCategory.findFirst({
        where: { id: input.categoryId, companyId: sess.companyId, deletedAt: null },
        select: { categoryCode: true },
      }),
    ])
    if (!brand) return { ok: false, error: "ブランドが見つかりません" }
    if (!category) return { ok: false, error: "商品カテゴリが見つかりません" }

    const preview = await computeNextProductCode(
      prisma.product,
      sess.companyId,
      productCodePrefix(brand.brandCode, season, category.categoryCode),
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
// 1. 一覧取得
// =============================================================================
export type ListProductsParams = {
  q?: string
  brandId?: string
  categoryId?: string
  season?: string
  status?: ProductStatus
  page?: number
  pageSize?: number
}

type ProductBaseRow = Pick<
  Product,
  | "id"
  | "productCode"
  | "clientProductCode"
  | "productName"
  | "productNameEn"
  | "brandId"
  | "categoryId"
  | "season"
  | "year"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "sketchThumbPath" // B-027: 一覧サムネ用（非正規化・先頭サムネの gs://パス）
>

export type ProductListItem = ProductBaseRow & {
  brand: BrandSummary | null
  category: CategorySummary | null
  sketchThumbUrl?: string // B-027: 一覧サムネの署名URL（listProducts でまとめて生成）
}

export async function listProducts(
  params: ListProductsParams = {},
): Promise<
  ActionResult<{
    items: ProductListItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    const skip = (page - 1) * pageSize
    const q = (params.q ?? "").trim()

    const where: Prisma.ProductWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (params.status) where.status = params.status
    if (params.brandId) where.brandId = params.brandId
    if (params.categoryId) where.categoryId = params.categoryId
    if (params.season) where.season = params.season
    if (q.length > 0) {
      where.OR = [
        { productCode: { contains: q, mode: "insensitive" } },
        { clientProductCode: { contains: q, mode: "insensitive" } },
        { productName: { contains: q, mode: "insensitive" } },
        { productNameEn: { contains: q, mode: "insensitive" } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          productCode: true,
          clientProductCode: true,
          productName: true,
          productNameEn: true,
          brandId: true,
          categoryId: true,
          season: true,
          year: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          sketchThumbPath: true, // B-027
        },
        orderBy: [{ season: "desc" }, { productCode: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ])

    const brandMap = await fetchBrandSummariesByIds(
      sess.companyId,
      [...new Set(rows.map((r) => r.brandId))],
    )
    const categoryMap = await fetchCategorySummariesByIds(
      sess.companyId,
      [...new Set(rows.map((r) => r.categoryId).filter((v): v is string => !!v))],
    )

    // B-027: 一覧サムネは行数ぶん署名URLをまとめて発行（client で N 回 action を呼ばせない）
    const thumbUrls = await Promise.all(
      rows.map((r) =>
        r.sketchThumbPath ? getSignedReadUrl(r.sketchThumbPath) : Promise.resolve(null),
      ),
    )

    const items: ProductListItem[] = rows.map((r, idx) => ({
      ...r,
      brand: brandMap.get(r.brandId) ?? null,
      category: r.categoryId ? categoryMap.get(r.categoryId) ?? null : null,
      sketchThumbUrl: thumbUrls[idx] ?? undefined,
    }))

    return {
      ok: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "一覧取得に失敗しました",
    }
  }
}

// =============================================================================
// 2. 詳細取得
// =============================================================================
export type ProductStatusHistoryItem = {
  id: string
  fromStatus: ProductStatus | null
  toStatus: ProductStatus
  changedByUserId: string | null
  changeReason: string | null
  changedAt: Date
}

export type ProductDetail = Product & {
  brand: BrandSummary | null
  category: CategorySummary | null
  statusHistory: ProductStatusHistoryItem[]
}

export async function getProduct(
  id: string,
): Promise<{ ok: true; data: ProductDetail } | { ok: false; error: string }> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const row = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: {
        statusHistory: {
          orderBy: { changedAt: "desc" },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            changedByUserId: true,
            changeReason: true,
            changedAt: true,
          },
        },
      },
    })
    if (!row) {
      return { ok: false, error: "品番が見つかりません" }
    }

    const { statusHistory, ...product } = row
    const [brandMap, categoryMap] = await Promise.all([
      fetchBrandSummariesByIds(sess.companyId, [row.brandId]),
      row.categoryId
        ? fetchCategorySummariesByIds(sess.companyId, [row.categoryId])
        : Promise.resolve(new Map<string, CategorySummary>()),
    ])

    return {
      ok: true,
      data: {
        ...product,
        brand: brandMap.get(row.brandId) ?? null,
        category: row.categoryId
          ? categoryMap.get(row.categoryId) ?? null
          : null,
        statusHistory,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "詳細取得に失敗しました",
    }
  }
}

// =============================================================================
// 3. 新規作成（社内品番採番 + ModelCode 自動発番 + 初期 status 履歴を同一 transaction）
// =============================================================================
const CREATE_MAX_RETRIES = 3

export async function createProduct(
  input: ProductInput,
): Promise<ActionResult<{ id: string; productCode: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = productBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // brand 存在チェック（brandCode + clientId 取得）
    const brand = await prisma.brand.findFirst({
      where: { id: data.brandId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, brandCode: true, clientId: true },
    })
    if (!brand) {
      return { ok: false, error: "指定されたブランドが見つかりません" }
    }

    // category 存在チェック（categoryCode 取得・採番に必須）
    const category = await prisma.productCategory.findFirst({
      where: { id: data.categoryId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, categoryCode: true },
    })
    if (!category) {
      return { ok: false, error: "指定された商品カテゴリが見つかりません" }
    }

    // §6 案1：season は year + seasonType から合成（採番もこの合成値を使う）。
    const season = composeSeason(data.year, data.seasonType)
    const codePrefix = productCodePrefix(
      brand.brandCode,
      season,
      category.categoryCode,
    )
    const deliveryDate = data.desiredDeliveryDate
      ? new Date(data.desiredDeliveryDate)
      : null

    let created: { id: string; productCode: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          // (1) ModelCode を裏で自動発番（Product.modelCodeId NOT NULL を満たす）
          const modelCode = await computeNextModelCode(
            tx.modelCode,
            sess.companyId,
            brand.brandCode,
          )
          const newModelCode = await tx.modelCode.create({
            data: {
              companyId: sess.companyId,
              modelCode,
              brandId: brand.id,
              modelName: data.productName,
              categoryId: data.categoryId,
              status: ModelCodeStatus.ACTIVE,
            },
            select: { id: true },
          })

          // (2) 社内品番を採番して Product を作成
          const productCode = await computeNextProductCode(
            tx.product,
            sess.companyId,
            codePrefix,
          )
          const product = await tx.product.create({
            data: {
              companyId: sess.companyId,
              productCode,
              clientProductCode: data.clientProductCode || null,
              modelCodeId: newModelCode.id,
              clientId: brand.clientId,
              brandId: brand.id,
              categoryId: data.categoryId,
              productName: data.productName,
              productNameEn: data.productNameEn || null,
              description: data.description || null,
              silhouette: data.silhouette || null,
              season,
              seasonType: data.seasonType,
              year: data.year,
              expectedQuantity: data.expectedQuantity,
              desiredDeliveryDate: deliveryDate,
              assignedToUserId: data.assignedToUserId,
              designerId: data.designerId,
              patternMakerId: data.patternMakerId,
              internalNotes: data.internalNotes || null,
              status: data.status,
            },
            select: { id: true, productCode: true },
          })

          // (3) 初期 status を履歴に記録（from=null → to=初期status）
          await tx.productStatusHistory.create({
            data: {
              productId: product.id,
              fromStatus: null,
              toStatus: data.status,
              changedByUserId: sess.userId,
              changeReason: "品番カルテ新規作成",
            },
          })

          return product
        })
        break
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          // productCode / modelCode の unique 衝突：再試行
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
        entityType: "Product",
        entityId: created.id,
        afterData: {
          productCode: created.productCode,
          clientProductCode: data.clientProductCode || null,
          brandId: brand.id,
          clientId: brand.clientId,
          categoryId: data.categoryId,
          productName: data.productName,
          season,
          seasonType: data.seasonType,
          year: data.year,
          status: data.status,
        },
      },
    })

    revalidatePath("/products")
    return {
      ok: true,
      data: { id: created.id, productCode: created.productCode },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新（productCode / modelCodeId は immutable。status 変更時は履歴記録）
// =============================================================================
export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = productBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "品番が見つかりません" }
    }

    // brandId 変更時：存在チェック + clientId 再導出
    let clientId = existing.clientId
    if (existing.brandId !== data.brandId) {
      const brand = await prisma.brand.findFirst({
        where: { id: data.brandId, companyId: sess.companyId, deletedAt: null },
        select: { id: true, clientId: true },
      })
      if (!brand) {
        return { ok: false, error: "指定されたブランドが見つかりません" }
      }
      clientId = brand.clientId
    }

    // categoryId 変更時：存在チェック（採番済み productCode は変えない）
    if (existing.categoryId !== data.categoryId) {
      const category = await prisma.productCategory.findFirst({
        where: {
          id: data.categoryId,
          companyId: sess.companyId,
          deletedAt: null,
        },
        select: { id: true },
      })
      if (!category) {
        return { ok: false, error: "指定された商品カテゴリが見つかりません" }
      }
    }

    const statusChanged = existing.status !== data.status
    const deliveryDate = data.desiredDeliveryDate
      ? new Date(data.desiredDeliveryDate)
      : null

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.product.update({
        where: { id },
        data: {
          // productCode / modelCodeId は immutable（送らない）
          clientProductCode: data.clientProductCode || null,
          clientId,
          brandId: data.brandId,
          categoryId: data.categoryId,
          productName: data.productName,
          productNameEn: data.productNameEn || null,
          description: data.description || null,
          silhouette: data.silhouette || null,
          // §6 案1：productCode は immutable だが、season は year + seasonType から再合成して保存。
          season: composeSeason(data.year, data.seasonType),
          seasonType: data.seasonType,
          year: data.year,
          expectedQuantity: data.expectedQuantity,
          desiredDeliveryDate: deliveryDate,
          assignedToUserId: data.assignedToUserId,
          designerId: data.designerId,
          patternMakerId: data.patternMakerId,
          internalNotes: data.internalNotes || null,
          status: data.status,
        },
      })

      if (statusChanged) {
        await tx.productStatusHistory.create({
          data: {
            productId: id,
            fromStatus: existing.status,
            toStatus: data.status,
            changedByUserId: sess.userId,
          },
        })
      }

      return row
    })

    // B-015/B-006: Product 業務スカラを全件 snapshot に載せる。
    // システム項目 (id/companyId/createdAt/updatedAt/deletedAt) のみ除外し、
    // satisfies Record<ProductAuditField, unknown> で網羅をコンパイル時に強制する。
    // schema にスカラを足すと ProductScalarFieldEnum に自動で増えるため、Exclude しない限り
    // この型に組み込まれ、未追加でビルド失敗 = 監査スナップショット漏れの保険。
    type ProductAuditField = Exclude<
      keyof typeof Prisma.ProductScalarFieldEnum,
      // B-027: 絵型(sketchImages/sketchThumbPath) は product-sketches.ts が専用 AuditLog で
      //   管理し updateProduct は触らないため、基本情報の監査スナップショットからは除外する。
      | "id"
      | "companyId"
      | "createdAt"
      | "updatedAt"
      | "deletedAt"
      | "sketchImages"
      | "sketchThumbPath"
    >

    const beforeData = {
      productCode: existing.productCode,
      clientProductCode: existing.clientProductCode,
      inquiryId: existing.inquiryId,
      modelCodeId: existing.modelCodeId,
      clientId: existing.clientId,
      brandId: existing.brandId,
      categoryId: existing.categoryId,
      productName: existing.productName,
      productNameEn: existing.productNameEn,
      description: existing.description,
      season: existing.season,
      seasonType: existing.seasonType,
      year: existing.year,
      silhouette: existing.silhouette,
      expectedQuantity: existing.expectedQuantity,
      receivedOrderQty: existing.receivedOrderQty,
      productionQty: existing.productionQty,
      deliveredQty: existing.deliveredQty,
      defectQty: existing.defectQty,
      defectRate: existing.defectRate,
      samplePrice: existing.samplePrice,
      massUnitPrice: existing.massUnitPrice,
      totalRevenue: existing.totalRevenue,
      totalCost: existing.totalCost,
      grossProfit: existing.grossProfit,
      grossProfitRate: existing.grossProfitRate,
      currency: existing.currency,
      status: existing.status,
      isSpecLocked: existing.isSpecLocked,
      specLockedAt: existing.specLockedAt,
      orderPeriodStart: existing.orderPeriodStart,
      orderPeriodEnd: existing.orderPeriodEnd,
      desiredDeliveryDate: existing.desiredDeliveryDate,
      plannedDeliveryDate: existing.plannedDeliveryDate,
      actualDeliveryDate: existing.actualDeliveryDate,
      isOverseasProduction: existing.isOverseasProduction,
      productionCountry: existing.productionCountry,
      assignedToUserId: existing.assignedToUserId,
      designerId: existing.designerId,
      patternMakerId: existing.patternMakerId,
      patternOwnership: existing.patternOwnership,
      designOwnership: existing.designOwnership,
      internalNotes: existing.internalNotes,
    } satisfies Record<ProductAuditField, unknown>

    const afterData = {
      productCode: updated.productCode,
      clientProductCode: updated.clientProductCode,
      inquiryId: updated.inquiryId,
      modelCodeId: updated.modelCodeId,
      clientId: updated.clientId,
      brandId: updated.brandId,
      categoryId: updated.categoryId,
      productName: updated.productName,
      productNameEn: updated.productNameEn,
      description: updated.description,
      season: updated.season,
      seasonType: updated.seasonType,
      year: updated.year,
      silhouette: updated.silhouette,
      expectedQuantity: updated.expectedQuantity,
      receivedOrderQty: updated.receivedOrderQty,
      productionQty: updated.productionQty,
      deliveredQty: updated.deliveredQty,
      defectQty: updated.defectQty,
      defectRate: updated.defectRate,
      samplePrice: updated.samplePrice,
      massUnitPrice: updated.massUnitPrice,
      totalRevenue: updated.totalRevenue,
      totalCost: updated.totalCost,
      grossProfit: updated.grossProfit,
      grossProfitRate: updated.grossProfitRate,
      currency: updated.currency,
      status: updated.status,
      isSpecLocked: updated.isSpecLocked,
      specLockedAt: updated.specLockedAt,
      orderPeriodStart: updated.orderPeriodStart,
      orderPeriodEnd: updated.orderPeriodEnd,
      desiredDeliveryDate: updated.desiredDeliveryDate,
      plannedDeliveryDate: updated.plannedDeliveryDate,
      actualDeliveryDate: updated.actualDeliveryDate,
      isOverseasProduction: updated.isOverseasProduction,
      productionCountry: updated.productionCountry,
      assignedToUserId: updated.assignedToUserId,
      designerId: updated.designerId,
      patternMakerId: updated.patternMakerId,
      patternOwnership: updated.patternOwnership,
      designOwnership: updated.designOwnership,
      internalNotes: updated.internalNotes,
    } satisfies Record<ProductAuditField, unknown>

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Product",
        entityId: id,
        beforeData,
        afterData,
      },
    })

    revalidatePath("/products")
    revalidatePath(`/products/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. アーカイブ（status を ARCHIVED に + 履歴記録）
// =============================================================================
export async function archiveProduct(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true },
    })
    if (!existing) {
      return { ok: false, error: "品番が見つかりません" }
    }
    if (existing.status === ProductStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブ済みです" }
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { status: ProductStatus.ARCHIVED },
      })
      await tx.productStatusHistory.create({
        data: {
          productId: id,
          fromStatus: existing.status,
          toStatus: ProductStatus.ARCHIVED,
          changedByUserId: sess.userId,
          changeReason: "アーカイブ",
        },
      })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Product",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: ProductStatus.ARCHIVED },
      },
    })

    revalidatePath("/products")
    revalidatePath(`/products/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 6. 復元（履歴ベース：ARCHIVED 直前の status に戻す。無ければ PLANNING）
// =============================================================================
export async function restoreProduct(
  id: string,
): Promise<ActionResult<{ id: string; restoredTo: ProductStatus }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true },
    })
    if (!existing) {
      return { ok: false, error: "品番が見つかりません" }
    }
    if (existing.status !== ProductStatus.ARCHIVED) {
      return { ok: false, error: "アーカイブ済みではありません" }
    }

    // ARCHIVED にする直前の status（最後の非 ARCHIVED toStatus）を復元先にする
    const lastNonArchived = await prisma.productStatusHistory.findFirst({
      where: {
        productId: id,
        toStatus: { not: ProductStatus.ARCHIVED },
      },
      orderBy: { changedAt: "desc" },
      select: { toStatus: true },
    })
    const restoredTo = lastNonArchived?.toStatus ?? ProductStatus.PLANNING

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { status: restoredTo },
      })
      await tx.productStatusHistory.create({
        data: {
          productId: id,
          fromStatus: ProductStatus.ARCHIVED,
          toStatus: restoredTo,
          changedByUserId: sess.userId,
          changeReason: "アーカイブから復元",
        },
      })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Product",
        entityId: id,
        beforeData: { status: ProductStatus.ARCHIVED },
        afterData: { status: restoredTo },
      },
    })

    revalidatePath("/products")
    revalidatePath(`/products/${id}`)
    return { ok: true, data: { id, restoredTo } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 7. 紐付き確認（物理削除前のガード用）
//    対象は skus と collectionLinks。statusHistory は Cascade のためカウント不要。
// =============================================================================
export async function checkProductUsage(
  id: string,
): Promise<ActionResult<ProductUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "品番が見つかりません" }
    }

    const [skuCount, collectionLinkCount] = await Promise.all([
      prisma.sku.count({ where: { productId: id } }),
      prisma.collectionProduct.count({ where: { productId: id } }),
    ])

    return {
      ok: true,
      data: {
        skuCount,
        collectionLinkCount,
        totalRefs: skuCount + collectionLinkCount,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "参照確認に失敗しました",
    }
  }
}

// =============================================================================
// 8. 物理削除（4 重ガード）
// =============================================================================
export async function deleteProductPermanently(
  id: string,
  confirmationName: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // ガード 1: MASTER_ADMIN
    if (sess.tenantType !== "MASTER_ADMIN") {
      return { ok: false, error: "物理削除はマスター管理者のみ実行可能です" }
    }

    const existing = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "品番が見つかりません" }
    }

    // ガード 2: ARCHIVED
    if (existing.status !== ProductStatus.ARCHIVED) {
      return { ok: false, error: "アーカイブ済みの品番のみ物理削除できます" }
    }

    // ガード 3: 確認名一致（productName で確認）
    if (confirmationName.trim() !== existing.productName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    // ガード 4: 参照ゼロ
    const usage = await checkProductUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return {
        ok: false,
        error: `この品番は ${usage.data.skuCount} 件の SKU・${usage.data.collectionLinkCount} 件のコレクションから参照されています。`,
      }
    }

    await runWithoutTenantContext(async () => {
      // statusHistory は onDelete: Cascade のため Product 削除で自動消去される
      await prisma.product.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "Product",
        entityId: id,
        beforeData: {
          productCode: existing.productCode,
          clientProductCode: existing.clientProductCode,
          modelCodeId: existing.modelCodeId,
          brandId: existing.brandId,
          productName: existing.productName,
          status: existing.status,
        },
      },
    })

    revalidatePath("/products")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
