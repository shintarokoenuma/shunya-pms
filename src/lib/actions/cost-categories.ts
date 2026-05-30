"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  CostCategoryStatus,
  type ExternalCostCategory,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  costCategoryInputSchema,
  type CostCategoryInput,
} from "@/lib/validators/cost-category"

/**
 * Phase 1A-16: 原価費目マスター (CostCategory) Server Actions
 *
 * 設計方針:
 * - 8 関数構成 (list / get / create / update / archive / restore /
 *   checkUsage / deletePermanently)
 * - 2 階層 (Lv1 予約 4 行 = ExternalCostCategory / Lv2 葉ノード)
 * - Lv1 の追加は禁止 (予約 4 行のみ、シードで投入)
 * - externalCategory は Lv2 では親から自動継承 (サーバー側で derive)
 * - isSystemReserved = true の行は archive / 物理削除 / categoryCode / level /
 *   parentCategoryId / externalCategory の変更を禁止 (名称・英名のみ編集可)
 * - 物理削除は 4 重ガード (MASTER_ADMIN + ARCHIVED + 名前一致 + 参照ゼロ) +
 *   isSystemReserved ガード
 * - 全関数で auditLog 自動記録
 *
 * 参照元 (usage チェックの対象):
 * - 子カテゴリ (Lv2)
 * - QuotationCostBreakdown.expenseCategoryId
 *   (Phase 1A-16 では列名 expense_category_id のまま維持。Phase 1B で改名予定)
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type CostCategoryUsage = {
  childrenCount: number
  quotationCostBreakdownCount: number
  totalRefs: number
}

// =============================================================================
// Decimal 変換ヘルパー
// =============================================================================
function toDecimalOrNull(v: number | null): Prisma.Decimal | null {
  if (v === null) return null
  return new Prisma.Decimal(v)
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
// 1. 一覧取得
// =============================================================================
export type ListCostCategoriesParams = {
  q?: string
  status?: CostCategoryStatus
  externalCategory?: ExternalCostCategory
  parentCategoryId?: string
  level?: 1 | 2
  page?: number
  pageSize?: number
}

export type CostCategoryListItem = Prisma.CostCategoryGetPayload<{
  select: {
    id: true
    categoryCode: true
    categoryName: true
    categoryNameEn: true
    parentCategoryId: true
    level: true
    externalCategory: true
    isSystemReserved: true
    standardAmount: true
    currency: true
    calculationType: true
    status: true
    createdAt: true
    updatedAt: true
    parent: {
      select: {
        id: true
        categoryCode: true
        categoryName: true
      }
    }
  }
}>

export async function listCostCategories(
  params: ListCostCategoriesParams = {},
): Promise<
  ActionResult<{
    items: CostCategoryListItem[]
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

    const where: Prisma.CostCategoryWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (params.status) where.status = params.status
    if (params.externalCategory) where.externalCategory = params.externalCategory
    if (params.parentCategoryId) where.parentCategoryId = params.parentCategoryId
    if (params.level) where.level = params.level
    if (q.length > 0) {
      where.OR = [
        { categoryCode: { contains: q, mode: "insensitive" } },
        { categoryName: { contains: q, mode: "insensitive" } },
        { categoryNameEn: { contains: q, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.costCategory.findMany({
        where,
        select: {
          id: true,
          categoryCode: true,
          categoryName: true,
          categoryNameEn: true,
          parentCategoryId: true,
          level: true,
          externalCategory: true,
          isSystemReserved: true,
          standardAmount: true,
          currency: true,
          calculationType: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          parent: {
            select: {
              id: true,
              categoryCode: true,
              categoryName: true,
            },
          },
        },
        orderBy: [
          { externalCategory: "asc" },
          { level: "asc" },
          { categoryCode: "asc" },
        ],
        skip,
        take: pageSize,
      }),
      prisma.costCategory.count({ where }),
    ])

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
// 親候補取得 (Lv2 作成 / 編集フォーム用、Lv1 4 行を返す)
// =============================================================================
export async function listCostCategoryParentCandidates() {
  const sess = await requireSession()
  if (!sess.ok) return []

  return prisma.costCategory.findMany({
    where: {
      companyId: sess.companyId,
      deletedAt: null,
      level: 1,
      status: CostCategoryStatus.ACTIVE,
    },
    orderBy: [{ externalCategory: "asc" }, { categoryCode: "asc" }],
    select: {
      id: true,
      categoryCode: true,
      categoryName: true,
      level: true,
      externalCategory: true,
    },
  })
}

// =============================================================================
// 2. 詳細取得
// =============================================================================
export async function getCostCategory(id: string) {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const row = await prisma.costCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: {
        parent: {
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
            externalCategory: true,
          },
        },
        children: {
          where: { deletedAt: null },
          orderBy: { categoryCode: "asc" },
          select: {
            id: true,
            categoryCode: true,
            categoryName: true,
            status: true,
          },
        },
      },
    })
    if (!row) {
      return { ok: false as const, error: "原価費目が見つかりません" }
    }
    return { ok: true as const, data: row }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "詳細取得に失敗しました",
    }
  }
}

// =============================================================================
// 3. 新規作成 (Lv2 のみ。Lv1 は予約 4 行で固定、追加不可)
// =============================================================================
export async function createCostCategory(
  input: CostCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = costCategoryInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // Lv1 の追加は禁止 (予約 4 行のみ)
    if (data.level === 1) {
      return {
        ok: false,
        error:
          "Lv1 (大分類) は予約 4 行のみで、新規追加できません。Lv2 (小分類) として作成してください",
      }
    }

    // Lv2: 親の存在と Lv1 制約を確認、externalCategory を親から継承
    if (!data.parentCategoryId) {
      return { ok: false, error: "親カテゴリは必須です" }
    }
    const parent = await prisma.costCategory.findFirst({
      where: {
        id: data.parentCategoryId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true, level: true, externalCategory: true, status: true },
    })
    if (!parent) {
      return { ok: false, error: "指定された親カテゴリが見つかりません" }
    }
    if (parent.level !== 1) {
      return { ok: false, error: "親カテゴリは Lv1 (大分類) でなければなりません" }
    }
    if (parent.status !== CostCategoryStatus.ACTIVE) {
      return {
        ok: false,
        error: "親カテゴリがアーカイブされているため作成できません",
      }
    }

    // コード重複チェック
    const dup = await prisma.costCategory.findFirst({
      where: {
        companyId: sess.companyId,
        categoryCode: data.categoryCode,
        deletedAt: null,
      },
    })
    if (dup) {
      return {
        ok: false,
        error: `コード "${data.categoryCode}" は既に使用されています`,
      }
    }

    const created = await prisma.costCategory.create({
      data: {
        companyId: sess.companyId,
        categoryCode: data.categoryCode,
        categoryName: data.categoryName,
        categoryNameEn: data.categoryNameEn || null,
        parentCategoryId: parent.id,
        level: 2,
        externalCategory: parent.externalCategory, // 親から継承 (固定)
        isSystemReserved: false,
        standardAmount: toDecimalOrNull(data.standardAmount),
        currency: data.currency,
        calculationType: data.calculationType,
        notes: data.notes || null,
        status: data.status,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "CostCategory",
        entityId: created.id,
        afterData: {
          categoryCode: created.categoryCode,
          categoryName: created.categoryName,
          level: created.level,
          externalCategory: created.externalCategory,
          parentCategoryId: created.parentCategoryId,
          status: created.status,
        },
      },
    })

    revalidatePath("/cost-categories")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新
// =============================================================================
export async function updateCostCategory(
  id: string,
  input: CostCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = costCategoryInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.costCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "原価費目が見つかりません" }
    }

    // 予約行 (isSystemReserved) は名称・英名のみ編集可
    if (existing.isSystemReserved) {
      if (data.categoryCode !== existing.categoryCode) {
        return {
          ok: false,
          error: "システム予約行のコードは変更できません",
        }
      }
      if (data.level !== existing.level) {
        return {
          ok: false,
          error: "システム予約行の階層レベルは変更できません",
        }
      }
      if (data.externalCategory !== existing.externalCategory) {
        return {
          ok: false,
          error: "システム予約行の大分類は変更できません",
        }
      }
      if ((data.parentCategoryId ?? null) !== existing.parentCategoryId) {
        return {
          ok: false,
          error: "システム予約行の親カテゴリは変更できません",
        }
      }
      if (data.status !== existing.status) {
        return {
          ok: false,
          error: "システム予約行のステータスは変更できません",
        }
      }
    }

    // 階層整合性
    let derivedExternalCategory = existing.externalCategory
    let derivedParentCategoryId: string | null = existing.parentCategoryId
    if (!existing.isSystemReserved) {
      if (data.level === 1) {
        // Lv1 への変更は禁止 (Lv1 は予約のみ、追加不可)
        if (existing.level !== 1) {
          return {
            ok: false,
            error: "既存の Lv2 を Lv1 (予約行) に変更することはできません",
          }
        }
      } else if (data.level === 2) {
        if (!data.parentCategoryId) {
          return { ok: false, error: "親カテゴリは必須です" }
        }
        const parent = await prisma.costCategory.findFirst({
          where: {
            id: data.parentCategoryId,
            companyId: sess.companyId,
            deletedAt: null,
          },
          select: { id: true, level: true, externalCategory: true, status: true },
        })
        if (!parent) {
          return { ok: false, error: "指定された親カテゴリが見つかりません" }
        }
        if (parent.level !== 1) {
          return {
            ok: false,
            error: "親カテゴリは Lv1 (大分類) でなければなりません",
          }
        }
        if (parent.status !== CostCategoryStatus.ACTIVE) {
          return {
            ok: false,
            error: "親カテゴリがアーカイブされているため更新できません",
          }
        }
        derivedExternalCategory = parent.externalCategory // 親から継承
        derivedParentCategoryId = parent.id
      }
    }

    // コード変更時のみ重複チェック
    if (data.categoryCode !== existing.categoryCode) {
      const dup = await prisma.costCategory.findFirst({
        where: {
          companyId: sess.companyId,
          categoryCode: data.categoryCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (dup) {
        return {
          ok: false,
          error: `コード "${data.categoryCode}" は既に使用されています`,
        }
      }
    }

    const updated = await prisma.costCategory.update({
      where: { id },
      data: {
        categoryCode: data.categoryCode,
        categoryName: data.categoryName,
        categoryNameEn: data.categoryNameEn || null,
        parentCategoryId: derivedParentCategoryId,
        level: data.level,
        externalCategory: derivedExternalCategory,
        standardAmount: toDecimalOrNull(data.standardAmount),
        currency: data.currency,
        calculationType: data.calculationType,
        notes: data.notes || null,
        status: data.status,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "CostCategory",
        entityId: id,
        beforeData: {
          categoryCode: existing.categoryCode,
          categoryName: existing.categoryName,
          level: existing.level,
          externalCategory: existing.externalCategory,
          parentCategoryId: existing.parentCategoryId,
          status: existing.status,
        },
        afterData: {
          categoryCode: updated.categoryCode,
          categoryName: updated.categoryName,
          level: updated.level,
          externalCategory: updated.externalCategory,
          parentCategoryId: updated.parentCategoryId,
          status: updated.status,
        },
      },
    })

    revalidatePath("/cost-categories")
    revalidatePath(`/cost-categories/${id}`)
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
export async function archiveCostCategory(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.costCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "原価費目が見つかりません" }
    }

    // 予約行は archive 不可
    if (existing.isSystemReserved) {
      return {
        ok: false,
        error: "システム予約行はアーカイブできません",
      }
    }

    if (existing.status === CostCategoryStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブ済みです" }
    }

    // Lv1 の場合: 稼働中の子カテゴリがあれば拒否
    if (existing.level === 1) {
      const activeChildrenCount = await prisma.costCategory.count({
        where: {
          parentCategoryId: id,
          status: CostCategoryStatus.ACTIVE,
          deletedAt: null,
        },
      })
      if (activeChildrenCount > 0) {
        return {
          ok: false,
          error: `稼働中の子カテゴリが ${activeChildrenCount} 件存在するため、アーカイブできません`,
        }
      }
    }

    await prisma.costCategory.update({
      where: { id },
      data: { status: CostCategoryStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "CostCategory",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: CostCategoryStatus.ARCHIVED },
      },
    })

    revalidatePath("/cost-categories")
    revalidatePath(`/cost-categories/${id}`)
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
export async function restoreCostCategory(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.costCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "原価費目が見つかりません" }
    }
    if (existing.status === CostCategoryStatus.ACTIVE) {
      return { ok: false, error: "既に稼働中です" }
    }

    // Lv2 復元時: 親が ACTIVE か確認
    if (existing.level === 2 && existing.parentCategoryId) {
      const parent = await prisma.costCategory.findFirst({
        where: {
          id: existing.parentCategoryId,
          companyId: sess.companyId,
          deletedAt: null,
        },
      })
      if (!parent) {
        return { ok: false, error: "親カテゴリが存在しないため復元できません" }
      }
      if (parent.status === CostCategoryStatus.ARCHIVED) {
        return {
          ok: false,
          error:
            "親カテゴリがアーカイブされているため復元できません。先に親カテゴリを復元してください",
        }
      }
    }

    await prisma.costCategory.update({
      where: { id },
      data: { status: CostCategoryStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "CostCategory",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: CostCategoryStatus.ACTIVE },
      },
    })

    revalidatePath("/cost-categories")
    revalidatePath(`/cost-categories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 7. 紐付き確認
// =============================================================================
export async function checkCostCategoryUsage(
  id: string,
): Promise<ActionResult<CostCategoryUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.costCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "原価費目が見つかりません" }
    }

    const [childrenCount, quotationCostBreakdownCount] = await Promise.all([
      prisma.costCategory.count({
        where: { parentCategoryId: id, deletedAt: null },
      }),
      // Phase 1A-16 では QCB.expense_category_id 列をそのまま参照
      // (Phase 1B で costCategoryId に改名予定)
      prisma.quotationCostBreakdown.count({
        where: { expenseCategoryId: id },
      }),
    ])

    return {
      ok: true,
      data: {
        childrenCount,
        quotationCostBreakdownCount,
        totalRefs: childrenCount + quotationCostBreakdownCount,
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
// 8. 物理削除 (4 重ガード + isSystemReserved)
// =============================================================================
export async function deleteCostCategoryPermanently(
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

    const existing = await prisma.costCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "原価費目が見つかりません" }
    }

    // 追加ガード: 予約行は物理削除不可
    if (existing.isSystemReserved) {
      return {
        ok: false,
        error: "システム予約行は物理削除できません",
      }
    }

    // ガード 2: ARCHIVED
    if (existing.status !== CostCategoryStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みのカテゴリのみ物理削除できます",
      }
    }

    // ガード 3: 確認名一致
    if (confirmationName.trim() !== existing.categoryName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    // ガード 4: 参照ゼロ
    const usage = await checkCostCategoryUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return {
        ok: false,
        error: `子カテゴリ ${usage.data.childrenCount} 件 / 見積もり原価明細 ${usage.data.quotationCostBreakdownCount} 件 から参照されています`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.costCategory.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "CostCategory",
        entityId: id,
        beforeData: {
          categoryCode: existing.categoryCode,
          categoryName: existing.categoryName,
          level: existing.level,
          externalCategory: existing.externalCategory,
          status: existing.status,
        },
      },
    })

    revalidatePath("/cost-categories")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
