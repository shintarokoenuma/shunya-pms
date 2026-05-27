"use server"

import { revalidatePath } from "next/cache"
import { Prisma, MaterialCategoryStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  materialCategoryInputSchema,
  type MaterialCategoryInput,
} from "@/lib/validators/material-category"

/**
 * Phase 1A-15: 素材カテゴリ（MaterialCategory）Server Actions
 *
 * 設計方針（spec 2026-05-28、Phase 1A-14 ProductCategory の precedent 流用）:
 * - shunya-master-patterns v1.2 §5 標準の 8 関数構成
 * - 3 階層構造、ステータス 2 値、手動入力 categoryCode
 * - 階層整合性・自己参照・循環参照のチェックは ProductCategory と同パターン
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type MaterialCategoryUsage = {
  childrenCount: number
  materialCount: number
  totalRefs: number
}

// =============================================================================
// 階層整合性ヘルパー
// =============================================================================
async function validateHierarchy(
  companyId: string,
  parentCategoryId: string | null,
  selfLevel: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (selfLevel === 1) {
    if (parentCategoryId !== null && parentCategoryId !== "") {
      return {
        ok: false,
        error: "大分類（レベル1）には親カテゴリを設定できません",
      }
    }
    return { ok: true }
  }

  if (parentCategoryId === null || parentCategoryId === "") {
    const label = selfLevel === 2 ? "中分類" : "小分類"
    return { ok: false, error: `${label}には親カテゴリの選択が必須です` }
  }

  const parent = await prisma.materialCategory.findFirst({
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
// =============================================================================
async function checkCircularReference(
  companyId: string,
  selfId: string,
  newParentId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newParentId === null || newParentId === "") return { ok: true }

  if (newParentId === selfId) {
    return { ok: false, error: "自分自身を親カテゴリに設定することはできません" }
  }

  let cursor: string | null = newParentId
  const visited = new Set<string>()

  while (cursor !== null) {
    if (visited.has(cursor)) {
      return { ok: false, error: "親カテゴリの階層に循環が検出されました" }
    }
    visited.add(cursor)

    if (cursor === selfId) {
      return { ok: false, error: "自分の子孫を親カテゴリに設定することはできません" }
    }

    const next: { parentCategoryId: string | null } | null =
      await prisma.materialCategory.findFirst({
        where: { id: cursor, companyId, deletedAt: null },
        select: { parentCategoryId: true },
      })

    if (!next) break
    cursor = next.parentCategoryId
  }

  return { ok: true }
}

// =============================================================================
// 1. 一覧取得
// =============================================================================
export type ListMaterialCategoriesParams = {
  q?: string
  status?: MaterialCategoryStatus
  level?: 1 | 2 | 3
  parentCategoryId?: string
  page?: number
  pageSize?: number
}

export async function listMaterialCategories(
  params: ListMaterialCategoriesParams,
) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.MaterialCategoryWhereInput = {
    companyId,
    deletedAt: null,
  }

  if (params.status) where.status = params.status
  if (params.level) where.level = params.level
  if (params.parentCategoryId) where.parentCategoryId = params.parentCategoryId
  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim()
    where.OR = [
      { categoryName: { contains: q, mode: "insensitive" } },
      { categoryNameEn: { contains: q, mode: "insensitive" } },
      { categoryCode: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, categories] = await Promise.all([
    prisma.materialCategory.count({ where }),
    prisma.materialCategory.findMany({
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
// =============================================================================
export async function listMaterialCategoryParentCandidates(level: 2 | 3) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const parentLevel = level - 1

  return prisma.materialCategory.findMany({
    where: {
      companyId,
      deletedAt: null,
      level: parentLevel,
      status: MaterialCategoryStatus.ACTIVE,
    },
    orderBy: [{ categoryCode: "asc" }],
    select: {
      id: true,
      categoryCode: true,
      categoryName: true,
      level: true,
    },
  })
}

// =============================================================================
// 全 ACTIVE カテゴリを階層パンくず付きで返す（Material Select 用）
// =============================================================================
export type MaterialCategoryOptionForSelect = {
  id: string
  categoryCode: string
  categoryName: string
  level: number
  /** 階層パンくず（例: "表地 > コットン > ポプリン"） */
  breadcrumb: string
}

export async function listAllActiveMaterialCategoriesForSelect(): Promise<
  MaterialCategoryOptionForSelect[]
> {
  const session = await auth()
  if (!session?.user) return []
  const companyId = session.user.companyId
  if (!companyId) return []

  const rows = await prisma.materialCategory.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: MaterialCategoryStatus.ACTIVE,
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
// 2. 詳細取得
// =============================================================================
export async function getMaterialCategory(id: string) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  return prisma.materialCategory.findFirst({
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
}

// =============================================================================
// 3. 新規作成
// =============================================================================
export async function createMaterialCategory(
  input: MaterialCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = materialCategoryInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    // categoryCode 重複チェック
    const existingCode = await prisma.materialCategory.findFirst({
      where: { companyId, categoryCode: data.categoryCode, deletedAt: null },
    })
    if (existingCode) {
      return {
        ok: false,
        error: `カテゴリコード "${data.categoryCode}" は既に存在します`,
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
      const c = await tx.materialCategory.create({
        data: {
          companyId,
          categoryCode: data.categoryCode,
          categoryName: data.categoryName,
          categoryNameEn: data.categoryNameEn || null,
          parentCategoryId: data.parentCategoryId || null,
          level: data.level,
          status: data.status,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "CREATE",
          entityType: "MaterialCategory",
          entityId: c.id,
          afterData: {
            categoryCode: c.categoryCode,
            categoryName: c.categoryName,
            level: c.level,
          },
        },
      })

      return c
    })

    revalidatePath("/material-categories")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "素材カテゴリの作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新
// =============================================================================
export async function updateMaterialCategory(
  id: string,
  input: MaterialCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = materialCategoryInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((i) => i.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.materialCategory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "素材カテゴリが見つかりません" }
    }

    // categoryCode 重複チェック（自分以外）
    if (data.categoryCode !== existing.categoryCode) {
      const conflict = await prisma.materialCategory.findFirst({
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

    // 階層整合性
    const hierarchyCheck = await validateHierarchy(
      companyId,
      data.parentCategoryId,
      data.level,
    )
    if (!hierarchyCheck.ok) {
      return { ok: false, error: hierarchyCheck.error }
    }

    // 循環参照チェック
    const circularCheck = await checkCircularReference(
      companyId,
      id,
      data.parentCategoryId,
    )
    if (!circularCheck.ok) {
      return { ok: false, error: circularCheck.error }
    }

    // level 変更時、子カテゴリがあれば拒否
    if (data.level !== existing.level) {
      const childrenCount = await prisma.materialCategory.count({
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
      const updated = await tx.materialCategory.update({
        where: { id },
        data: {
          categoryCode: data.categoryCode,
          categoryName: data.categoryName,
          categoryNameEn: data.categoryNameEn || null,
          parentCategoryId: data.parentCategoryId || null,
          level: data.level,
          status: data.status,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          entityType: "MaterialCategory",
          entityId: id,
          beforeData: {
            categoryCode: existing.categoryCode,
            categoryName: existing.categoryName,
            level: existing.level,
            status: existing.status,
          },
          afterData: {
            categoryCode: updated.categoryCode,
            categoryName: updated.categoryName,
            level: updated.level,
            status: updated.status,
          },
        },
      })
    })

    revalidatePath("/material-categories")
    revalidatePath(`/material-categories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "素材カテゴリの更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. アーカイブ
// =============================================================================
export async function archiveMaterialCategory(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.materialCategory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の素材カテゴリが見つかりません" }
    }
    if (before.status === MaterialCategoryStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブされています" }
    }

    const activeChildrenCount = await prisma.materialCategory.count({
      where: {
        parentCategoryId: id,
        status: MaterialCategoryStatus.ACTIVE,
        deletedAt: null,
      },
    })
    if (activeChildrenCount > 0) {
      return {
        ok: false,
        error: `稼働中の子カテゴリが ${activeChildrenCount} 件存在するため、アーカイブできません。子カテゴリを先にアーカイブしてください`,
      }
    }

    const after = await prisma.materialCategory.update({
      where: { id },
      data: { status: MaterialCategoryStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "MaterialCategory",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/material-categories")
    revalidatePath(`/material-categories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 6. 復元
// =============================================================================
export async function restoreMaterialCategory(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.materialCategory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の素材カテゴリが見つかりません" }
    }
    if (before.status !== MaterialCategoryStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブされていないカテゴリは復元できません",
      }
    }

    if (before.parentCategoryId) {
      const parent = await prisma.materialCategory.findFirst({
        where: { id: before.parentCategoryId, companyId, deletedAt: null },
      })
      if (!parent) {
        return { ok: false, error: "親カテゴリが存在しないため復元できません" }
      }
      if (parent.status === MaterialCategoryStatus.ARCHIVED) {
        return {
          ok: false,
          error:
            "親カテゴリがアーカイブされているため復元できません。先に親カテゴリを復元してください",
        }
      }
    }

    const after = await prisma.materialCategory.update({
      where: { id },
      data: { status: MaterialCategoryStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "MaterialCategory",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/material-categories")
    revalidatePath(`/material-categories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 7. 紐付きチェック
// =============================================================================
export async function checkMaterialCategoryUsage(
  id: string,
): Promise<MaterialCategoryUsage> {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const category = await prisma.materialCategory.findFirst({
    where: { id, companyId },
  })
  if (!category) {
    throw new Error("素材カテゴリが見つかりません")
  }

  const [childrenCount, materialCount] = await Promise.all([
    prisma.materialCategory.count({
      where: { parentCategoryId: id, deletedAt: null },
    }),
    prisma.material.count({
      where: { categoryId: id, deletedAt: null },
    }),
  ])

  return {
    childrenCount,
    materialCount,
    totalRefs: childrenCount + materialCount,
  }
}

// =============================================================================
// 8. 物理削除（4 重ガード）
// =============================================================================
export async function deleteMaterialCategoryPermanently(
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
      select: { tenantType: true },
    })
    if (company?.tenantType !== "MASTER_ADMIN") {
      return {
        ok: false,
        error: "物理削除はマスター管理者のみ実行可能です",
      }
    }

    const existing = await prisma.materialCategory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "素材カテゴリが見つかりません" }
    }

    if (existing.status !== MaterialCategoryStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みの素材カテゴリのみ物理削除できます",
      }
    }

    if (confirmationName.trim() !== existing.categoryName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    const usage = await checkMaterialCategoryUsage(id)
    if (usage.totalRefs > 0) {
      return {
        ok: false,
        error: `子カテゴリ ${usage.childrenCount} 件 / Material ${usage.materialCount} 件 から参照されています`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.materialCategory.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "DELETE",
        entityType: "MaterialCategory",
        entityId: id,
        beforeData: {
          categoryCode: existing.categoryCode,
          categoryName: existing.categoryName,
          level: existing.level,
          status: existing.status,
        },
      },
    })

    revalidatePath("/material-categories")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
