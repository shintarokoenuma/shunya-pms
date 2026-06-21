"use server"

import { revalidatePath } from "next/cache"
import { Prisma, ProductCategoryStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  productCategoryInputSchema,
  type ProductCategoryInput,
} from "@/lib/validators/product-category"

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type ProductCategoryUsage = {
  childrenCount: number
  productCount: number
  modelCodeCount: number
  totalRefs: number
}

// =============================================================================
// Decimal 変換ヘルパー（標準値用）
// =============================================================================
function toDecimalOrNull(v: number | null): Prisma.Decimal | null {
  if (v === null) return null
  return new Prisma.Decimal(v)
}

// =============================================================================
// 階層整合性ヘルパー
// 親カテゴリが指定された時、親の level + 1 == 自分の level か確認
// =============================================================================
async function validateHierarchy(
  companyId: string,
  parentCategoryId: string | null,
  selfLevel: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // level=1（大分類）は親なしの想定だが、ここでも確認
  if (selfLevel === 1) {
    if (parentCategoryId !== null && parentCategoryId !== "") {
      return { ok: false, error: "大分類（レベル1）には親カテゴリを設定できません" }
    }
    return { ok: true }
  }

  // level=2 or 3 は親が必須
  if (parentCategoryId === null || parentCategoryId === "") {
    const label = selfLevel === 2 ? "中分類" : "小分類"
    return { ok: false, error: `${label}には親カテゴリの選択が必須です` }
  }

  const parent = await prisma.productCategory.findFirst({
    where: { id: parentCategoryId, companyId, deletedAt: null },
    select: { id: true, level: true, categoryName: true },
  })

  if (!parent) {
    return { ok: false, error: "指定された親カテゴリが見つかりません" }
  }

  if (parent.level + 1 !== selfLevel) {
    return {
      ok: false,
      error: `親カテゴリのレベル（${parent.level}）と階層が一致しません。レベル ${parent.level + 1} のカテゴリとして登録してください`,
    }
  }

  return { ok: true }
}

// =============================================================================
// 循環参照防止ヘルパー（編集時のみ使用）
// 自分の子孫を親に設定すると循環するので、それを防ぐ
// =============================================================================
async function checkCircularReference(
  companyId: string,
  selfId: string,
  newParentId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newParentId === null || newParentId === "") {
    return { ok: true }
  }

  if (newParentId === selfId) {
    return { ok: false, error: "自分自身を親カテゴリに設定することはできません" }
  }

  // newParentId から ancestor チェーンをたどり、selfId に到達するかチェック
  let cursor: string | null = newParentId
  const visited = new Set<string>()

  while (cursor !== null) {
    if (visited.has(cursor)) {
      // 既存データに循環があった場合のフェイルセーフ
      return { ok: false, error: "親カテゴリの階層に循環が検出されました" }
    }
    visited.add(cursor)

    if (cursor === selfId) {
      return { ok: false, error: "自分の子孫を親カテゴリに設定することはできません" }
    }

    const next: { parentCategoryId: string | null } | null =
      await prisma.productCategory.findFirst({
        where: { id: cursor, companyId, deletedAt: null },
        select: { parentCategoryId: true },
      })

    if (!next) break
    cursor = next.parentCategoryId
  }

  return { ok: true }
}

// =============================================================================
// 一覧取得
// =============================================================================
export type ListProductCategoriesParams = {
  q?: string
  status?: ProductCategoryStatus
  level?: 1 | 2 | 3
  parentCategoryId?: string
  page?: number
  pageSize?: number
}

export async function listProductCategories(params: ListProductCategoriesParams) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.ProductCategoryWhereInput = {
    companyId,
    deletedAt: null,
  }

  if (params.status) {
    where.status = params.status
  }

  if (params.level) {
    where.level = params.level
  }

  if (params.parentCategoryId) {
    where.parentCategoryId = params.parentCategoryId
  }

  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim()
    where.OR = [
      { categoryName: { contains: q, mode: "insensitive" } },
      { categoryNameEn: { contains: q, mode: "insensitive" } },
      { categoryCode: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, categories] = await Promise.all([
    prisma.productCategory.count({ where }),
    prisma.productCategory.findMany({
      where,
      orderBy: [{ level: "asc" }, { categoryCode: "asc" }],
      skip,
      take: pageSize,
      include: {
        parent: {
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
            level: true,
          },
        },
      },
    }),
  ])

  return {
    categories,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  }
}

// =============================================================================
// 親候補取得（フォーム用）
// 指定された level の「親候補」を返す
// level=1 を指定した場合は空配列（親なし）
// level=2 を指定した場合は level=1 のカテゴリ一覧
// level=3 を指定した場合は level=2 のカテゴリ一覧
// =============================================================================
export async function listParentCandidates(level: 2 | 3) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const parentLevel = level - 1

  const candidates = await prisma.productCategory.findMany({
    where: {
      companyId,
      deletedAt: null,
      level: parentLevel,
      status: ProductCategoryStatus.ACTIVE,
    },
    orderBy: [{ categoryCode: "asc" }],
    select: {
      id: true,
      categoryCode: true,
      categoryName: true,
      level: true,
    },
  })

  return candidates
}

// =============================================================================
// 全 ACTIVE カテゴリを階層パンくず付きで返す（ModelCode 等の Select 用）
// Phase 1A-14：ModelCode の Category Select を有効化するために追加
// =============================================================================
export type ProductCategoryOptionForSelect = {
  id: string
  categoryCode: string
  categoryName: string
  level: number
  /** 階層パンくず（例: "レディース > トップス > Tシャツ"） */
  breadcrumb: string
}

export async function listAllActiveProductCategoriesForSelect(): Promise<
  ProductCategoryOptionForSelect[]
> {
  const session = await auth()
  if (!session?.user) return []
  const companyId = session.user.companyId
  if (!companyId) return []

  const rows = await prisma.productCategory.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: ProductCategoryStatus.ACTIVE,
    },
    orderBy: [{ categoryCode: "asc" }],
    select: {
      id: true,
      categoryCode: true,
      categoryName: true,
      level: true,
      parentCategoryId: true,
    },
  })

  // id -> row の Map を作って、各行について parent を辿りパンくず生成
  const byId = new Map(rows.map((r) => [r.id, r]))

  const buildBreadcrumb = (id: string): string => {
    const names: string[] = []
    let cursor: string | null = id
    const visited = new Set<string>()
    while (cursor !== null) {
      if (visited.has(cursor)) break
      visited.add(cursor)
      const row = byId.get(cursor)
      if (!row) break
      names.unshift(row.categoryName)
      cursor = row.parentCategoryId
    }
    return names.join(" > ")
  }

  return rows.map((r) => ({
    id: r.id,
    categoryCode: r.categoryCode,
    categoryName: r.categoryName,
    level: r.level,
    breadcrumb: buildBreadcrumb(r.id),
  }))
}

// =============================================================================
// 詳細取得
// =============================================================================
export async function getProductCategory(id: string) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const category = await prisma.productCategory.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      parent: {
        select: {
          id: true,
          categoryCode: true,
          categoryName: true,
          level: true,
        },
      },
      children: {
        where: { deletedAt: null },
        orderBy: [{ categoryCode: "asc" }],
        select: {
          id: true,
          categoryCode: true,
          categoryName: true,
          level: true,
          status: true,
        },
      },
    },
  })

  if (!category) {
    throw new Error("商品カテゴリが見つかりません")
  }

  return category
}

// =============================================================================
// 新規作成
// =============================================================================
export async function createProductCategory(
  input: ProductCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = productCategoryInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      }
    }
    const data = parsed.data

    // categoryCode の重複チェック
    const existingCode = await prisma.productCategory.findFirst({
      where: {
        companyId,
        categoryCode: data.categoryCode,
        deletedAt: null,
      },
    })
    if (existingCode) {
      return {
        ok: false,
        error: `カテゴリコード "${data.categoryCode}" は既に存在します`,
      }
    }

    // categoryName の重複チェック
    const existingName = await prisma.productCategory.findFirst({
      where: {
        companyId,
        categoryName: data.categoryName,
        deletedAt: null,
      },
    })
    if (existingName) {
      return {
        ok: false,
        error: `カテゴリ名 "${data.categoryName}" は既に存在します`,
      }
    }

    // 階層整合性チェック
    const hierarchyCheck = await validateHierarchy(
      companyId,
      data.parentCategoryId,
      data.level,
    )
    if (!hierarchyCheck.ok) {
      return { ok: false, error: hierarchyCheck.error }
    }

    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.productCategory.create({
        data: {
          companyId,
          categoryCode: data.categoryCode,
          categoryName: data.categoryName,
          categoryNameEn: data.categoryNameEn || null,
          parentCategoryId: data.parentCategoryId || null,
          level: data.level,
          standardFabricUsage: toDecimalOrNull(data.standardFabricUsage),
          standardLossRate: toDecimalOrNull(data.standardLossRate),
          standardSewingFee: toDecimalOrNull(data.standardSewingFee),
          defaultSizeOptions: data.defaultSizeOptions as Prisma.InputJsonValue,
          status: data.status,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "CREATE",
          entityType: "ProductCategory",
          entityId: c.id,
          afterData: {
            categoryCode: c.categoryCode,
            categoryName: c.categoryName,
            level: c.level,
            defaultSizeOptions: data.defaultSizeOptions,
          },
        },
      })

      return c
    })

    revalidatePath("/product-categories")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "商品カテゴリの作成に失敗しました",
    }
  }
}

// =============================================================================
// 更新
// =============================================================================
export async function updateProductCategory(
  id: string,
  input: ProductCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = productCategoryInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.productCategory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "商品カテゴリが見つかりません" }
    }

    // categoryCode の重複チェック（自分以外）
    if (data.categoryCode !== existing.categoryCode) {
      const conflict = await prisma.productCategory.findFirst({
        where: {
          companyId,
          categoryCode: data.categoryCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `カテゴリコード "${data.categoryCode}" は既に存在します`,
        }
      }
    }

    // categoryName の重複チェック（自分以外）
    if (data.categoryName !== existing.categoryName) {
      const conflict = await prisma.productCategory.findFirst({
        where: {
          companyId,
          categoryName: data.categoryName,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `カテゴリ名 "${data.categoryName}" は既に存在します`,
        }
      }
    }

    // 階層整合性チェック
    const hierarchyCheck = await validateHierarchy(
      companyId,
      data.parentCategoryId,
      data.level,
    )
    if (!hierarchyCheck.ok) {
      return { ok: false, error: hierarchyCheck.error }
    }

    // 循環参照チェック（編集時のみ）
    const circularCheck = await checkCircularReference(
      companyId,
      id,
      data.parentCategoryId,
    )
    if (!circularCheck.ok) {
      return { ok: false, error: circularCheck.error }
    }

    // level が変わる場合、子カテゴリへの影響を警告
    // （ただし、これは厳密にはエラーではなく警告。MVP では拒否する方が安全）
    if (data.level !== existing.level) {
      const childrenCount = await prisma.productCategory.count({
        where: { parentCategoryId: id, deletedAt: null },
      })
      if (childrenCount > 0) {
        return {
          ok: false,
          error: `このカテゴリには ${childrenCount} 件の子カテゴリが存在するため、階層レベルを変更できません。子カテゴリを先に編集してください`,
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.productCategory.update({
        where: { id },
        data: {
          categoryCode: data.categoryCode,
          categoryName: data.categoryName,
          categoryNameEn: data.categoryNameEn || null,
          parentCategoryId: data.parentCategoryId || null,
          level: data.level,
          standardFabricUsage: toDecimalOrNull(data.standardFabricUsage),
          standardLossRate: toDecimalOrNull(data.standardLossRate),
          standardSewingFee: toDecimalOrNull(data.standardSewingFee),
          defaultSizeOptions: data.defaultSizeOptions as Prisma.InputJsonValue,
          status: data.status,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          entityType: "ProductCategory",
          entityId: id,
          beforeData: {
            categoryCode: existing.categoryCode,
            categoryName: existing.categoryName,
            level: existing.level,
            status: existing.status,
            defaultSizeOptions: existing.defaultSizeOptions,
          },
          afterData: {
            categoryCode: updated.categoryCode,
            categoryName: updated.categoryName,
            level: updated.level,
            status: updated.status,
            defaultSizeOptions: updated.defaultSizeOptions,
          },
        },
      })
    })

    revalidatePath("/product-categories")
    revalidatePath(`/product-categories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "商品カテゴリの更新に失敗しました",
    }
  }
}

// =============================================================================
// アーカイブ
// 子カテゴリ（ACTIVE）が存在する場合はアーカイブ拒否
// =============================================================================
export async function archiveProductCategory(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.productCategory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の商品カテゴリが見つかりません" }
    }
    if (before.status === ProductCategoryStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブされています" }
    }

    // 子カテゴリ（ACTIVE のみ）が存在する場合は拒否
    const activeChildrenCount = await prisma.productCategory.count({
      where: {
        parentCategoryId: id,
        status: ProductCategoryStatus.ACTIVE,
        deletedAt: null,
      },
    })
    if (activeChildrenCount > 0) {
      return {
        ok: false,
        error: `稼働中の子カテゴリが ${activeChildrenCount} 件存在するため、アーカイブできません。子カテゴリを先にアーカイブしてください`,
      }
    }

    const after = await prisma.productCategory.update({
      where: { id },
      data: { status: ProductCategoryStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "ProductCategory",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/product-categories")
    revalidatePath(`/product-categories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 復元
// =============================================================================
export async function restoreProductCategory(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.productCategory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の商品カテゴリが見つかりません" }
    }
    if (before.status !== ProductCategoryStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブされていないカテゴリは復元できません",
      }
    }

    // 親カテゴリがアーカイブされている場合は復元できない
    if (before.parentCategoryId) {
      const parent = await prisma.productCategory.findFirst({
        where: { id: before.parentCategoryId, companyId, deletedAt: null },
      })
      if (!parent) {
        return {
          ok: false,
          error: "親カテゴリが存在しないため復元できません",
        }
      }
      if (parent.status === ProductCategoryStatus.ARCHIVED) {
        return {
          ok: false,
          error:
            "親カテゴリがアーカイブされているため復元できません。先に親カテゴリを復元してください",
        }
      }
    }

    const after = await prisma.productCategory.update({
      where: { id },
      data: { status: ProductCategoryStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "ProductCategory",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/product-categories")
    revalidatePath(`/product-categories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 紐付きチェック
// =============================================================================
export async function checkProductCategoryUsage(
  id: string,
): Promise<ProductCategoryUsage> {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const category = await prisma.productCategory.findFirst({
    where: { id, companyId },
  })
  if (!category) {
    throw new Error("商品カテゴリが見つかりません")
  }

  // 子カテゴリ・Product・ModelCode からの参照を集計
  const [childrenCount, productCount, modelCodeCount] = await Promise.all([
    prisma.productCategory.count({
      where: { parentCategoryId: id, deletedAt: null },
    }),
    prisma.product.count({
      where: { categoryId: id, deletedAt: null },
    }),
    prisma.modelCode.count({
      where: { categoryId: id, deletedAt: null },
    }),
  ])

  const totalRefs = childrenCount + productCount + modelCodeCount

  return {
    childrenCount,
    productCount,
    modelCodeCount,
    totalRefs,
  }
}

// =============================================================================
// 物理削除
// 子カテゴリ / Product / ModelCode のいずれかから参照されている場合は拒否
// =============================================================================
export async function deleteProductCategoryPermanently(
  id: string,
  confirmationName: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })
    if (!company || company.tenantType !== "MASTER_ADMIN") {
      return {
        ok: false,
        error: "物理削除は MASTER_ADMIN テナントのみ実行できます",
      }
    }

    const existing = await prisma.productCategory.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return { ok: false, error: "商品カテゴリが見つかりません" }
    }

    if (existing.status !== ProductCategoryStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みのカテゴリのみ物理削除できます",
      }
    }

    if (confirmationName.trim() !== existing.categoryName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    // 参照チェック
    const usage = await checkProductCategoryUsage(id)
    if (usage.totalRefs > 0) {
      return {
        ok: false,
        error: `紐付くデータ（子カテゴリ ${usage.childrenCount} 件 / 品番 ${usage.productCount} 件 / モデルコード ${usage.modelCodeCount} 件）があるため削除できません`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.productCategory.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "DELETE",
        entityType: "ProductCategory",
        entityId: id,
        beforeData: {
          categoryCode: existing.categoryCode,
          categoryName: existing.categoryName,
          level: existing.level,
          status: existing.status,
        },
      },
    })

    revalidatePath("/product-categories")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
