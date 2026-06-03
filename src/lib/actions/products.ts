"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  ProductStatus,
  ModelCodeStatus,
  BrandStatus,
  ProductCategoryStatus,
  type Product,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  productBaseSchema,
  type ProductInput,
} from "@/lib/validators/product"

/**
 * S-1: 品番カルテ（Product）Server Actions
 *
 * 設計方針（指示書 s-1-product-crud-implementation-brief-2026-06-03.md）:
 * - shunya-master-patterns v1.2 §5 標準の 8 関数構成
 * - 採番: {brandCode}-{season}-{categoryCode}-{3桁連番}
 *   companyId × brandCode × season × categoryCode ごとに 001 から
 *   保存時に transaction 内で再計算・確定。衝突時はリトライ最大 3 回
 * - ModelCode 連携:
 *   - mode="existing": 既存 ACTIVE な ModelCode を選択
 *   - mode="new": 同一 transaction 内で M-{brandCode}-{4桁連番} を発番（1A-12 と同じ computeNextModelCode を tx.modelCode で呼ぶ）
 * - status 変化時は ProductStatusHistory に履歴を残す（create 時の初期 PLANNING も記録）
 * - Product → Client / Brand のリレーションは schema 未宣言（FK 列のみ）。
 *   ModelCode と同じく manual join で扱う。
 *
 * 制約:
 * - schema 無変更（migration なし）
 * - 物理削除は MASTER_ADMIN + ARCHIVED + 確認コード一致 + usage 0 件
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type ProductUsage = {
  skuCount: number
  sampleProductionCount: number
  workOrderCount: number
  poAllocationCount: number
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
// 補助: Brand / Client / ProductCategory / ModelCode サマリ（manual join 用）
// =============================================================================
export type BrandSummary = {
  id: string
  brandCode: string
  brandName: string
  clientId: string
}

export type ClientSummary = {
  id: string
  clientCode: string
  companyName: string
}

export type ProductCategorySummary = {
  id: string
  categoryCode: string
  categoryName: string
  level: number
}

export type ModelCodeSummary = {
  id: string
  modelCode: string
  modelName: string
  brandId: string
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
    },
  })
  return new Map(rows.map((r) => [r.id, r]))
}

async function fetchClientSummariesByIds(
  companyId: string,
  clientIds: string[],
): Promise<Map<string, ClientSummary>> {
  if (clientIds.length === 0) return new Map()
  const rows = await prisma.client.findMany({
    where: { id: { in: clientIds }, companyId },
    select: { id: true, clientCode: true, companyName: true },
  })
  return new Map(rows.map((r) => [r.id, r]))
}

async function fetchCategorySummariesByIds(
  companyId: string,
  categoryIds: string[],
): Promise<Map<string, ProductCategorySummary>> {
  if (categoryIds.length === 0) return new Map()
  const rows = await prisma.productCategory.findMany({
    where: { id: { in: categoryIds }, companyId },
    select: {
      id: true,
      categoryCode: true,
      categoryName: true,
      level: true,
    },
  })
  return new Map(rows.map((r) => [r.id, r]))
}

// =============================================================================
// 補助: フォーム Select 用の Active 候補取得
// =============================================================================
export async function listActiveBrandsForProductSelect(): Promise<
  Array<{
    id: string
    brandCode: string
    brandName: string
    clientId: string
    clientName: string | null
  }>
> {
  const sess = await requireSession()
  if (!sess.ok) return []

  const rows = await prisma.brand.findMany({
    where: {
      companyId: sess.companyId,
      deletedAt: null,
      status: BrandStatus.ACTIVE,
    },
    select: {
      id: true,
      brandCode: true,
      brandName: true,
      clientId: true,
      client: { select: { companyName: true } },
    },
    orderBy: [{ brandCode: "asc" }],
  })
  return rows.map((r) => ({
    id: r.id,
    brandCode: r.brandCode,
    brandName: r.brandName,
    clientId: r.clientId,
    clientName: r.client?.companyName ?? null,
  }))
}

export async function listActiveClientsForProductSelect(): Promise<
  Array<{ id: string; clientCode: string; companyName: string }>
> {
  const sess = await requireSession()
  if (!sess.ok) return []

  // Client.status は ClientStatus enum なら ACTIVE で絞れるが、schema を別途
  // 確認するまで status 列のフィルタは入れず、deletedAt = null のみで返す。
  // （実害なし: アーカイブ済 Client も選択肢に出るが、新規作成時の選択肢としては許容）
  const rows = await prisma.client.findMany({
    where: { companyId: sess.companyId, deletedAt: null },
    select: { id: true, clientCode: true, companyName: true },
    orderBy: [{ clientCode: "asc" }],
  })
  return rows
}

export async function listActiveProductCategoriesForProductSelect(): Promise<
  Array<{
    id: string
    categoryCode: string
    categoryName: string
    level: number
  }>
> {
  const sess = await requireSession()
  if (!sess.ok) return []

  const rows = await prisma.productCategory.findMany({
    where: {
      companyId: sess.companyId,
      deletedAt: null,
      status: ProductCategoryStatus.ACTIVE,
    },
    select: {
      id: true,
      categoryCode: true,
      categoryName: true,
      level: true,
    },
    orderBy: [{ categoryCode: "asc" }],
  })
  return rows
}

/**
 * 指定 Brand の ACTIVE ModelCode を返す（modelCodeMode="existing" の Select 用）。
 * brandId が空文字なら空配列。
 */
export async function listModelCodesForBrandSelect(
  brandId: string,
): Promise<Array<{ id: string; modelCode: string; modelName: string }>> {
  const sess = await requireSession()
  if (!sess.ok) return []
  if (!brandId || brandId === "") return []

  const rows = await prisma.modelCode.findMany({
    where: {
      companyId: sess.companyId,
      brandId,
      deletedAt: null,
      status: ModelCodeStatus.ACTIVE,
    },
    select: { id: true, modelCode: true, modelName: true },
    orderBy: [{ modelCode: "asc" }],
  })
  return rows
}

// =============================================================================
// 採番ヘルパー
// =============================================================================

/**
 * Product 連番採番。
 * `{brandCode}-{season}-{categoryCode}-` を prefix として、tx.product/prisma.product
 * の findFirst で「prefix で startsWith する最大連番行」を取り、その +1 を返す。
 * 1A-12 の computeNextModelCode と同形（finder 構造型で tx と prisma の両対応）。
 */
type ProductCodeFinder = {
  findFirst: (args: {
    where: {
      companyId: string
      productCode: { startsWith: string }
    }
    orderBy: { productCode: "desc" }
    select: { productCode: true }
  }) => Promise<{ productCode: string } | null>
}

async function computeNextProductCode(
  finder: ProductCodeFinder,
  companyId: string,
  brandCode: string,
  season: string,
  categoryCode: string,
): Promise<string> {
  const prefix = `${brandCode}-${season}-${categoryCode}-`

  const last = await finder.findFirst({
    where: {
      companyId,
      productCode: { startsWith: prefix },
    },
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

/**
 * ModelCode 連番採番。1A-12 model-codes.ts と同じロジック。
 * 同一 tx 内で Product 採番と ModelCode 採番を両方走らせるため、ここに同形を再掲。
 * 将来共通化したくなったら src/lib/numbering/ に切り出す候補（B-XXX）。
 */
type ModelCodeFinder = {
  findFirst: (args: {
    where: {
      companyId: string
      modelCode: { startsWith: string }
    }
    orderBy: { modelCode: "desc" }
    select: { modelCode: true }
  }) => Promise<{ modelCode: string } | null>
}

async function computeNextModelCode(
  finder: ModelCodeFinder,
  companyId: string,
  brandCode: string,
): Promise<string> {
  const normalized = brandCode.toUpperCase()
  const prefix = `M-${normalized}-`

  const last = await finder.findFirst({
    where: {
      companyId,
      modelCode: { startsWith: prefix },
    },
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
 * UI のプレビュー専用 Server Action。
 * Brand / Season / Category 入力時に呼んで「次の productCode」を表示する。
 * 保存時は create 内で再計算され、衝突時にリトライされる。
 */
export async function generateNextProductCodePreview(params: {
  brandId: string
  season: string
  categoryId: string
}): Promise<ActionResult<{ preview: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    if (!params.brandId || !params.season || !params.categoryId) {
      return {
        ok: false,
        error: "ブランド・シーズン・カテゴリをすべて指定してください",
      }
    }

    const brand = await prisma.brand.findFirst({
      where: {
        id: params.brandId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { brandCode: true },
    })
    if (!brand) {
      return { ok: false, error: "ブランドが見つかりません" }
    }

    const category = await prisma.productCategory.findFirst({
      where: {
        id: params.categoryId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { categoryCode: true },
    })
    if (!category) {
      return { ok: false, error: "商品カテゴリが見つかりません" }
    }

    const preview = await computeNextProductCode(
      prisma.product,
      sess.companyId,
      brand.brandCode,
      params.season,
      category.categoryCode,
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
  status?: ProductStatus
  season?: string
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
  | "modelCodeId"
  | "clientId"
  | "brandId"
  | "categoryId"
  | "season"
  | "year"
  | "status"
  | "createdAt"
  | "updatedAt"
>

export type ProductListRow = ProductBaseRow & {
  brand: BrandSummary | null
  client: ClientSummary | null
  category: ProductCategorySummary | null
  modelCode: { id: string; modelCode: string; modelName: string } | null
}

export async function listProducts(params: ListProductsParams) {
  const sess = await requireSession()
  if (!sess.ok) throw new Error(sess.error)

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.ProductWhereInput = {
    companyId: sess.companyId,
    deletedAt: null,
  }

  if (params.status) where.status = params.status
  if (params.brandId) where.brandId = params.brandId
  if (params.categoryId) where.categoryId = params.categoryId
  if (params.season) where.season = params.season
  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim()
    where.OR = [
      { productCode: { contains: q, mode: "insensitive" } },
      { productName: { contains: q, mode: "insensitive" } },
      { clientProductCode: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        productCode: true,
        clientProductCode: true,
        productName: true,
        productNameEn: true,
        modelCodeId: true,
        clientId: true,
        brandId: true,
        categoryId: true,
        season: true,
        year: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        modelCode: { select: { id: true, modelCode: true, modelName: true } },
      },
    }),
  ])

  // manual join: Brand / Client / Category（Product 上に relation 未宣言）
  const brandIds = Array.from(new Set(rows.map((r) => r.brandId)))
  const clientIds = Array.from(new Set(rows.map((r) => r.clientId)))
  const categoryIds = Array.from(
    new Set(rows.map((r) => r.categoryId).filter((v): v is string => !!v)),
  )

  const [brandMap, clientMap, categoryMap] = await Promise.all([
    fetchBrandSummariesByIds(sess.companyId, brandIds),
    fetchClientSummariesByIds(sess.companyId, clientIds),
    fetchCategorySummariesByIds(sess.companyId, categoryIds),
  ])

  const products: ProductListRow[] = rows.map((r) => ({
    id: r.id,
    productCode: r.productCode,
    clientProductCode: r.clientProductCode,
    productName: r.productName,
    productNameEn: r.productNameEn,
    modelCodeId: r.modelCodeId,
    clientId: r.clientId,
    brandId: r.brandId,
    categoryId: r.categoryId,
    season: r.season,
    year: r.year,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    brand: brandMap.get(r.brandId) ?? null,
    client: clientMap.get(r.clientId) ?? null,
    category: r.categoryId ? (categoryMap.get(r.categoryId) ?? null) : null,
    modelCode: r.modelCode,
  }))

  return {
    products,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  }
}

// =============================================================================
// 2. 詳細取得
// =============================================================================
export type ProductDetail = Product & {
  brand: BrandSummary | null
  client: ClientSummary | null
  category: ProductCategorySummary | null
  modelCode: { id: string; modelCode: string; modelName: string } | null
  statusHistory: Array<{
    id: string
    fromStatus: ProductStatus | null
    toStatus: ProductStatus
    changedByUserId: string | null
    changedByUserName: string | null
    changeReason: string | null
    changedAt: Date
  }>
}

export async function getProduct(
  id: string,
): Promise<ActionResult<ProductDetail>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const product = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: {
        modelCode: {
          select: { id: true, modelCode: true, modelName: true },
        },
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
    if (!product) {
      return { ok: false, error: "品番が見つかりません" }
    }

    const [brandMap, clientMap, categoryMap] = await Promise.all([
      fetchBrandSummariesByIds(sess.companyId, [product.brandId]),
      fetchClientSummariesByIds(sess.companyId, [product.clientId]),
      product.categoryId
        ? fetchCategorySummariesByIds(sess.companyId, [product.categoryId])
        : Promise.resolve(new Map<string, ProductCategorySummary>()),
    ])

    // changedByUserName を引く（History の userId 集約）
    const userIds = Array.from(
      new Set(
        product.statusHistory
          .map((h) => h.changedByUserId)
          .filter((v): v is string => !!v),
      ),
    )
    const userMap = new Map<string, string>()
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, companyId: sess.companyId },
        select: { id: true, displayName: true, email: true },
      })
      for (const u of users) {
        userMap.set(u.id, u.displayName ?? u.email)
      }
    }

    const detail: ProductDetail = {
      ...product,
      brand: brandMap.get(product.brandId) ?? null,
      client: clientMap.get(product.clientId) ?? null,
      category: product.categoryId
        ? (categoryMap.get(product.categoryId) ?? null)
        : null,
      modelCode: product.modelCode,
      statusHistory: product.statusHistory.map((h) => ({
        ...h,
        changedByUserName: h.changedByUserId
          ? (userMap.get(h.changedByUserId) ?? null)
          : null,
      })),
    }
    return { ok: true, data: detail }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "取得に失敗しました",
    }
  }
}

// =============================================================================
// 3. 新規作成（採番 + ModelCode 連携 + status 履歴 + 衝突リトライ）
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

    // Brand 存在チェック + brandCode / clientId 取得
    // 設計判断: Product.clientId は Brand.clientId を正とする（ユーザー入力の clientId は無視）。
    // これで Brand と Client の矛盾入力が構造的に作れなくなる。
    const brand = await prisma.brand.findFirst({
      where: {
        id: data.brandId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true, brandCode: true, clientId: true },
    })
    if (!brand) {
      return { ok: false, error: "指定されたブランドが見つかりません" }
    }

    // Client 存在チェック（Brand から導出した clientId に対して）
    const client = await prisma.client.findFirst({
      where: {
        id: brand.clientId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!client) {
      return {
        ok: false,
        error: "ブランドに紐づくクライアントが見つかりません",
      }
    }

    // Category 存在チェック + categoryCode 取得（categoryId は superRefine で必須化済）
    if (!data.categoryId) {
      return { ok: false, error: "商品カテゴリは必須です" }
    }
    const category = await prisma.productCategory.findFirst({
      where: {
        id: data.categoryId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true, categoryCode: true },
    })
    if (!category) {
      return { ok: false, error: "指定された商品カテゴリが見つかりません" }
    }

    // ModelCode モード別チェック
    if (data.modelCodeMode === "existing") {
      if (!data.modelCodeId) {
        return { ok: false, error: "既存モデルコードを選択してください" }
      }
      const existingMc = await prisma.modelCode.findFirst({
        where: {
          id: data.modelCodeId,
          companyId: sess.companyId,
          brandId: data.brandId,
          deletedAt: null,
        },
        select: { id: true },
      })
      if (!existingMc) {
        return {
          ok: false,
          error:
            "指定されたモデルコードが見つかりません（ブランドとの不一致か削除済み）",
        }
      }
    } else {
      // mode === "new"
      if (
        !data.newModelCodeModelName ||
        data.newModelCodeModelName.trim() === ""
      ) {
        return {
          ok: false,
          error: "新規モデルコードのモデル名は必須です",
        }
      }
    }

    // 衝突リトライ付き transaction
    let created: { id: string; productCode: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          // ModelCode 解決（mode=new なら同 tx で発番）
          let resolvedModelCodeId: string
          if (data.modelCodeMode === "new") {
            const newModelCodeValue = await computeNextModelCode(
              tx.modelCode,
              sess.companyId,
              brand.brandCode,
            )
            const newMc = await tx.modelCode.create({
              data: {
                companyId: sess.companyId,
                modelCode: newModelCodeValue,
                brandId: data.brandId,
                modelName: data.newModelCodeModelName!.trim(),
                categoryId: data.categoryId,
                status: ModelCodeStatus.ACTIVE,
              },
              select: { id: true },
            })
            resolvedModelCodeId = newMc.id
          } else {
            resolvedModelCodeId = data.modelCodeId!
          }

          // Product 採番
          const productCode = await computeNextProductCode(
            tx.product,
            sess.companyId,
            brand.brandCode,
            data.season,
            category.categoryCode,
          )

          // Product 作成（clientId は Brand.clientId を正とする）
          const product = await tx.product.create({
            data: {
              companyId: sess.companyId,
              productCode,
              clientProductCode: data.clientProductCode || null,
              modelCodeId: resolvedModelCodeId,
              clientId: brand.clientId,
              brandId: data.brandId,
              categoryId: data.categoryId,
              productName: data.productName,
              productNameEn: data.productNameEn || null,
              description: data.description || null,
              season: data.season,
              year: data.year,
              status: data.status,
            },
            select: { id: true, productCode: true, status: true },
          })

          // 初期 status 履歴（fromStatus=null）
          await tx.productStatusHistory.create({
            data: {
              productId: product.id,
              fromStatus: null,
              toStatus: product.status,
              changedByUserId: sess.userId,
              changeReason: "作成",
            },
          })

          return { id: product.id, productCode: product.productCode }
        })
        break
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          // unique 衝突: productCode or modelCode → リトライ
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
          productName: data.productName,
          brandId: data.brandId,
          clientId: brand.clientId,
          categoryId: data.categoryId,
          season: data.season,
          year: data.year,
          status: data.status,
          modelCodeMode: data.modelCodeMode,
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
// 4. 更新（productCode / modelCodeId は immutable）
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

    // brandId / categoryId / season は productCode の組成要素のため immutable。
    // 既発番コードの整合性を保つため、後から変えたい場合は「複製機能」で受ける
    // （B-023: duplicateProduct。S-2 で品番作り直し運用が見えてから着手）。
    if (existing.brandId !== data.brandId) {
      return {
        ok: false,
        error:
          "ブランドは編集できません。変更する場合は品番を複製して作り直してください（採番整合性のため。複製機能は後続で提供予定）",
      }
    }
    if (existing.categoryId !== data.categoryId) {
      return {
        ok: false,
        error:
          "商品カテゴリは編集できません。変更する場合は品番を複製して作り直してください（採番整合性のため。複製機能は後続で提供予定）",
      }
    }
    if (existing.season !== data.season) {
      return {
        ok: false,
        error:
          "シーズンは編集できません。変更する場合は品番を複製して作り直してください（採番整合性のため。複製機能は後続で提供予定）",
      }
    }

    // clientId は Brand から導出されるため、update では編集対象外（既存値を維持）。
    // brandId が immutable のため、clientId も実質固定。

    const statusChanged = existing.status !== data.status

    await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          clientProductCode: data.clientProductCode || null,
          productName: data.productName,
          productNameEn: data.productNameEn || null,
          description: data.description || null,
          year: data.year,
          status: data.status,
          // productCode / modelCodeId / brandId / clientId / categoryId / season は immutable
        },
      })

      if (statusChanged) {
        await tx.productStatusHistory.create({
          data: {
            productId: id,
            fromStatus: existing.status,
            toStatus: updated.status,
            changedByUserId: sess.userId,
            changeReason: null,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          companyId: sess.companyId,
          userId: sess.userId,
          action: "UPDATE",
          entityType: "Product",
          entityId: id,
          beforeData: {
            productName: existing.productName,
            productNameEn: existing.productNameEn,
            clientProductCode: existing.clientProductCode,
            year: existing.year,
            status: existing.status,
          },
          afterData: {
            productName: updated.productName,
            productNameEn: updated.productNameEn,
            clientProductCode: updated.clientProductCode,
            year: updated.year,
            status: updated.status,
          },
        },
      })
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
// 5. アーカイブ（status → ARCHIVED + 直前 status を内部保持はしない・S-2 で検討）
// =============================================================================
export async function archiveProduct(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "品番が見つかりません" }
    }
    if (existing.status === ProductStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブ済みです" }
    }

    const previousStatus = existing.status

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { status: ProductStatus.ARCHIVED },
      })

      await tx.productStatusHistory.create({
        data: {
          productId: id,
          fromStatus: previousStatus,
          toStatus: ProductStatus.ARCHIVED,
          changedByUserId: sess.userId,
          changeReason: "アーカイブ",
        },
      })

      await tx.auditLog.create({
        data: {
          companyId: sess.companyId,
          userId: sess.userId,
          action: "UPDATE",
          entityType: "Product",
          entityId: id,
          beforeData: { status: previousStatus },
          afterData: { status: ProductStatus.ARCHIVED },
        },
      })
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
// 6. 復元（ARCHIVED → 直前 status を履歴から復元）
//
// ProductStatusHistory から「toStatus != ARCHIVED の最新行」を引いて、
// その toStatus を復元先とする。履歴が引けない場合は PLANNING にフォールバック。
// =============================================================================
export async function restoreProduct(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "品番が見つかりません" }
    }
    if (existing.status !== ProductStatus.ARCHIVED) {
      return { ok: false, error: "アーカイブ済みではありません" }
    }

    // 履歴から「ARCHIVED 以外への遷移」の最新 toStatus を取得 → そこに戻す。
    // 引けなければ PLANNING にフォールバック。
    const previousNonArchived = await prisma.productStatusHistory.findFirst({
      where: {
        productId: id,
        toStatus: { not: ProductStatus.ARCHIVED },
      },
      orderBy: { changedAt: "desc" },
      select: { toStatus: true },
    })
    const restoredStatus =
      previousNonArchived?.toStatus ?? ProductStatus.PLANNING

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { status: restoredStatus },
      })

      await tx.productStatusHistory.create({
        data: {
          productId: id,
          fromStatus: ProductStatus.ARCHIVED,
          toStatus: restoredStatus,
          changedByUserId: sess.userId,
          changeReason: "アーカイブからの復元（直前状態へ）",
        },
      })

      await tx.auditLog.create({
        data: {
          companyId: sess.companyId,
          userId: sess.userId,
          action: "UPDATE",
          entityType: "Product",
          entityId: id,
          beforeData: { status: ProductStatus.ARCHIVED },
          afterData: { status: restoredStatus },
        },
      })
    })

    revalidatePath("/products")
    revalidatePath(`/products/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 7. 紐付きチェック（usage）
//
// S-1 段階の参照先（schema 上 productId を持つ主要モデル）:
//   - Sku
//   - SampleProduction
//   - WorkOrder
//   - PoAllocation（PurchaseOrder ↔ Product の橋）
// 他にも複数モデルが productId を持つが、S-1 では物理削除ガードに必要な範囲のみ。
// =============================================================================
export async function checkProductUsage(id: string): Promise<ProductUsage> {
  const sess = await requireSession()
  if (!sess.ok) throw new Error(sess.error)

  const product = await prisma.product.findFirst({
    where: { id, companyId: sess.companyId },
    select: { id: true },
  })
  if (!product) {
    throw new Error("品番が見つかりません")
  }

  const [skuCount, sampleProductionCount, workOrderCount, poAllocationCount] =
    await Promise.all([
      prisma.sku.count({ where: { productId: id, deletedAt: null } }),
      prisma.sampleProduction.count({
        where: { productId: id, deletedAt: null },
      }),
      prisma.workOrder.count({
        where: { productId: id, deletedAt: null },
      }),
      prisma.poAllocation.count({ where: { productId: id } }),
    ])

  return {
    skuCount,
    sampleProductionCount,
    workOrderCount,
    poAllocationCount,
    totalRefs:
      skuCount + sampleProductionCount + workOrderCount + poAllocationCount,
  }
}

// =============================================================================
// 8. 物理削除（4 重ガード）
//
// ガード: MASTER_ADMIN / ARCHIVED / 確認コード（productCode）一致 / usage 0 件
// =============================================================================
export async function deleteProductPermanently(
  id: string,
  confirmationCode: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const company = await prisma.company.findUnique({
      where: { id: sess.companyId },
      select: { tenantType: true },
    })
    if (company?.tenantType !== "MASTER_ADMIN") {
      return {
        ok: false,
        error: "物理削除はマスター管理者のみ実行可能です",
      }
    }

    const existing = await prisma.product.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "品番が見つかりません" }
    }

    if (existing.status !== ProductStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みの品番のみ物理削除できます",
      }
    }

    if (confirmationCode.trim() !== existing.productCode) {
      return { ok: false, error: "確認コードが一致しません" }
    }

    const usage = await checkProductUsage(id)
    if (usage.totalRefs > 0) {
      return {
        ok: false,
        error: `SKU ${usage.skuCount} 件 / サンプル製作 ${usage.sampleProductionCount} 件 / WO ${usage.workOrderCount} 件 / PO配分 ${usage.poAllocationCount} 件 から参照されています`,
      }
    }

    await runWithoutTenantContext(async () => {
      // ProductStatusHistory は Cascade delete で連動削除される（schema 真値）
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
          productName: existing.productName,
          brandId: existing.brandId,
          clientId: existing.clientId,
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
