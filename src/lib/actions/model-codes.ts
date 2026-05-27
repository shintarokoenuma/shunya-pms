"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  ModelCodeStatus,
  BrandStatus,
  type ModelCode,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  modelCodeBaseSchema,
  type ModelCodeInput,
} from "@/lib/validators/model-code"

/**
 * Phase 1A-12: 型番（ModelCode）Server Actions
 *
 * 設計方針（spec 2026-05-27）:
 * - shunya-master-patterns v1.2 §5 標準の 8 関数構成
 * - ハイブリッド実装：基本情報は手動編集可、累積データ / 保有資産は読み取り専用
 * - 採番：`M-{brandCode}-{連番4桁}`、ブランドごとに独立した連番
 * - 採番タイミング：(a) Brand 選択時にプレビュー + 保存時に最終確定
 *   - generateNextModelCodePreview：UI から呼ばれるプレビュー専用
 *   - create 時：transaction 内で再計算 + 衝突時はリトライ
 * - modelCode は immutable（update では既存値を維持）
 *
 * Prisma スキーマ事情：
 * - ModelCode.brandId は FK 列が存在するが、Prisma の relation は宣言されていない
 *   （既存スキーマの穴。Phase 1A-12 ではスキーマ変更を避けるため、Brand は別クエリで join）
 *
 * Phase 1B 以降の拡張ポイント：
 * - Product 完了時に totalRepetitions / totalProductionQty / totalRevenue を自動更新
 * - PatternVersion / DesignVersion 作成時に hasPattern / hasDesign を true に
 * - 累積データ / 保有資産フラグの手動編集 UI は実装しない（運用整合性保護）
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type ModelCodeUsage = {
  productCount: number
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
// 補助 1: フォームの Brand セレクト用に ACTIVE な Brand 候補を返す
// =============================================================================
export type BrandOptionForModelCode = {
  id: string
  brandCode: string
  brandName: string
  clientId: string
  clientName: string | null
}

export async function listActiveBrandsForModelCodeSelect(): Promise<
  BrandOptionForModelCode[]
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

// =============================================================================
// 補助 2: Brand サマリ（一覧 / 詳細で manual join するための型）
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
      client: {
        select: { id: true, clientCode: true, companyName: true },
      },
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

// =============================================================================
// 補助 3: 自動採番ヘルパー
//
// 指定ブランド配下で次に使う modelCode（`M-{brandCode}-{0001}`）を計算する。
// Prisma の TransactionClient と prisma 本体の両方から呼べるよう、必要な
// メソッドだけ構造的に受け取る。
// =============================================================================
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
 * UI のプレビュー専用：Brand 選択時に次の modelCode を返す。
 * 保存時は create 内で再計算され、衝突時にリトライされる。
 */
export async function generateNextModelCodePreview(
  brandId: string,
): Promise<ActionResult<{ preview: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const brand = await prisma.brand.findFirst({
      where: { id: brandId, companyId: sess.companyId, deletedAt: null },
      select: { brandCode: true },
    })
    if (!brand) {
      return { ok: false, error: "ブランドが見つかりません" }
    }

    const preview = await computeNextModelCode(
      prisma.modelCode,
      sess.companyId,
      brand.brandCode,
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
export type ListModelCodesParams = {
  q?: string
  brandId?: string
  categoryId?: string
  status?: ModelCodeStatus
  page?: number
  pageSize?: number
}

type ModelCodeBaseRow = Pick<
  ModelCode,
  | "id"
  | "modelCode"
  | "modelName"
  | "modelNameEn"
  | "brandId"
  | "categoryId"
  | "silhouette"
  | "status"
  | "patternOwnership"
  | "designOwnership"
  | "totalRepetitions"
  | "totalProductionQty"
  | "createdAt"
  | "updatedAt"
>

export type ModelCodeListItem = ModelCodeBaseRow & {
  brand: BrandSummary | null
}

export async function listModelCodes(
  params: ListModelCodesParams = {},
): Promise<
  ActionResult<{
    items: ModelCodeListItem[]
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

    const where: Prisma.ModelCodeWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (params.status) where.status = params.status
    if (params.brandId) where.brandId = params.brandId
    if (params.categoryId) where.categoryId = params.categoryId
    if (q.length > 0) {
      where.OR = [
        { modelCode: { contains: q, mode: "insensitive" } },
        { modelName: { contains: q, mode: "insensitive" } },
        { modelNameEn: { contains: q, mode: "insensitive" } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.modelCode.findMany({
        where,
        select: {
          id: true,
          modelCode: true,
          modelName: true,
          modelNameEn: true,
          brandId: true,
          categoryId: true,
          silhouette: true,
          status: true,
          patternOwnership: true,
          designOwnership: true,
          totalRepetitions: true,
          totalProductionQty: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ modelCode: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.modelCode.count({ where }),
    ])

    const brandMap = await fetchBrandSummariesByIds(
      sess.companyId,
      [...new Set(rows.map((r) => r.brandId))],
    )

    const items: ModelCodeListItem[] = rows.map((r) => ({
      ...r,
      brand: brandMap.get(r.brandId) ?? null,
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
export type ModelCodeDetail = ModelCode & { brand: BrandSummary | null }

export async function getModelCode(
  id: string,
): Promise<
  | { ok: true; data: ModelCodeDetail }
  | { ok: false; error: string }
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const row = await prisma.modelCode.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!row) {
      return { ok: false, error: "型番が見つかりません" }
    }

    const brandMap = await fetchBrandSummariesByIds(sess.companyId, [
      row.brandId,
    ])

    return {
      ok: true,
      data: { ...row, brand: brandMap.get(row.brandId) ?? null },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "詳細取得に失敗しました",
    }
  }
}

// =============================================================================
// 3. 新規作成（自動採番、衝突時リトライ最大 3 回）
// =============================================================================
const CREATE_MAX_RETRIES = 3

export async function createModelCode(
  input: ModelCodeInput,
): Promise<ActionResult<{ id: string; modelCode: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = modelCodeBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // brand 存在チェック + brandCode 取得
    const brand = await prisma.brand.findFirst({
      where: {
        id: data.brandId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true, brandCode: true },
    })
    if (!brand) {
      return { ok: false, error: "指定されたブランドが見つかりません" }
    }

    // 衝突リトライ付きで採番 + create
    let created: { id: string; modelCode: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const modelCode = await computeNextModelCode(
            tx.modelCode,
            sess.companyId,
            brand.brandCode,
          )
          const row = await tx.modelCode.create({
            data: {
              companyId: sess.companyId,
              modelCode,
              brandId: data.brandId,
              modelName: data.modelName,
              modelNameEn: data.modelNameEn || null,
              description: data.description || null,
              categoryId: data.categoryId,
              silhouette: data.silhouette || null,
              patternOwnership: data.patternOwnership,
              designOwnership: data.designOwnership,
              status: data.status,
            },
            select: { id: true, modelCode: true },
          })
          return row
        })
        break
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          // unique 衝突：再試行
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
        entityType: "ModelCode",
        entityId: created.id,
        afterData: {
          modelCode: created.modelCode,
          brandId: data.brandId,
          modelName: data.modelName,
          status: data.status,
        },
      },
    })

    revalidatePath("/model-codes")
    return {
      ok: true,
      data: { id: created.id, modelCode: created.modelCode },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新（modelCode は immutable）
// =============================================================================
export async function updateModelCode(
  id: string,
  input: ModelCodeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = modelCodeBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.modelCode.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "型番が見つかりません" }
    }

    // brandId 変更時のみ存在チェック
    if (existing.brandId !== data.brandId) {
      const brand = await prisma.brand.findFirst({
        where: {
          id: data.brandId,
          companyId: sess.companyId,
          deletedAt: null,
        },
      })
      if (!brand) {
        return { ok: false, error: "指定されたブランドが見つかりません" }
      }
    }

    const updated = await prisma.modelCode.update({
      where: { id },
      data: {
        // modelCode は immutable：data.modelCode は送られてこない
        brandId: data.brandId,
        modelName: data.modelName,
        modelNameEn: data.modelNameEn || null,
        description: data.description || null,
        categoryId: data.categoryId,
        silhouette: data.silhouette || null,
        patternOwnership: data.patternOwnership,
        designOwnership: data.designOwnership,
        status: data.status,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ModelCode",
        entityId: id,
        beforeData: {
          brandId: existing.brandId,
          modelName: existing.modelName,
          status: existing.status,
        },
        afterData: {
          brandId: updated.brandId,
          modelName: updated.modelName,
          status: updated.status,
        },
      },
    })

    revalidatePath("/model-codes")
    revalidatePath(`/model-codes/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. アーカイブ
// =============================================================================
export async function archiveModelCode(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.modelCode.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "型番が見つかりません" }
    }
    if (existing.status === ModelCodeStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブ済みです" }
    }

    await prisma.modelCode.update({
      where: { id },
      data: { status: ModelCodeStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ModelCode",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: ModelCodeStatus.ARCHIVED },
      },
    })

    revalidatePath("/model-codes")
    revalidatePath(`/model-codes/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 6. 復元（ARCHIVED → ACTIVE）
// =============================================================================
export async function restoreModelCode(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.modelCode.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "型番が見つかりません" }
    }
    if (existing.status !== ModelCodeStatus.ARCHIVED) {
      return { ok: false, error: "アーカイブ済みではありません" }
    }

    await prisma.modelCode.update({
      where: { id },
      data: { status: ModelCodeStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ModelCode",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: ModelCodeStatus.ACTIVE },
      },
    })

    revalidatePath("/model-codes")
    revalidatePath(`/model-codes/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 7. 紐付き確認（物理削除前のガード用）
//    Phase 1A は Product CRUD 未実装のため通常 0 件。Product 行が将来できれば自動カウント。
// =============================================================================
export async function checkModelCodeUsage(
  id: string,
): Promise<ActionResult<ModelCodeUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.modelCode.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "型番が見つかりません" }
    }

    const productCount = await prisma.product.count({
      where: { modelCodeId: id },
    })

    return {
      ok: true,
      data: { productCount, totalRefs: productCount },
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
export async function deleteModelCodePermanently(
  id: string,
  confirmationName: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // ガード 1: MASTER_ADMIN
    if (sess.tenantType !== "MASTER_ADMIN") {
      return {
        ok: false,
        error: "物理削除はマスター管理者のみ実行可能です",
      }
    }

    const existing = await prisma.modelCode.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "型番が見つかりません" }
    }

    // ガード 2: ARCHIVED
    if (existing.status !== ModelCodeStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みの型番のみ物理削除できます",
      }
    }

    // ガード 3: 確認名一致（modelName で確認）
    if (confirmationName.trim() !== existing.modelName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    // ガード 4: 参照ゼロ
    const usage = await checkModelCodeUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return {
        ok: false,
        error: `この型番は ${usage.data.productCount} 件の品番から参照されています。`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.modelCode.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "ModelCode",
        entityId: id,
        beforeData: {
          modelCode: existing.modelCode,
          brandId: existing.brandId,
          modelName: existing.modelName,
          status: existing.status,
        },
      },
    })

    revalidatePath("/model-codes")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
