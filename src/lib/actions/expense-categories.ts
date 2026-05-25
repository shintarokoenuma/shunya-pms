"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  ExpenseCategoryStatus,
  type ExpenseType,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  expenseCategoryInputSchema,
  type ExpenseCategoryInput,
} from "@/lib/validators/expense-category"

/**
 * Phase 1A-8: 諸経費カテゴリマスター Server Actions
 *
 * 設計方針:
 * - ProductCategory（Phase 1A-7）の論理層をベースに、階層構造を抜いた簡略版
 * - 8 関数構成（list / get / create / update / archive / restore /
 *   checkUsage / deletePermanently）
 * - 階層チェック・循環参照防止・親アーカイブ判定なし（不要のため）
 * - 物理削除は 4 重ガード（MASTER_ADMIN + ARCHIVED + 名前一致 + 参照ゼロ）
 * - 全関数で auditLog 自動記録
 *
 * 参照元（usage チェックの対象）:
 * - QuotationCostBreakdown.expenseCategoryId（見積もり原価明細）
 *   Phase 1B（見積もりエンジン）着手時に他の参照が増えれば適宜追加
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type ExpenseCategoryUsage = {
  quotationCostBreakdownCount: number
  totalRefs: number
}

// =============================================================================
// Decimal 変換ヘルパー
// validator は number | null で返すので Prisma.Decimal に変換する
// =============================================================================
function toDecimalOrNull(v: number | null): Prisma.Decimal | null {
  if (v === null) return null
  return new Prisma.Decimal(v)
}

// =============================================================================
// 認証ヘルパー（actions 内で共通利用）
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
export type ListExpenseCategoriesParams = {
  q?: string
  status?: ExpenseCategoryStatus
  expenseType?: ExpenseType
  page?: number
  pageSize?: number
}

export type ExpenseCategoryListItem = Prisma.ExpenseCategoryGetPayload<{
  select: {
    id: true
    expenseCode: true
    expenseName: true
    expenseNameEn: true
    expenseType: true
    standardAmount: true
    currency: true
    calculationType: true
    status: true
    createdAt: true
    updatedAt: true
  }
}>

export async function listExpenseCategories(
  params: ListExpenseCategoriesParams = {},
): Promise<
  ActionResult<{
    items: ExpenseCategoryListItem[]
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

    const where: Prisma.ExpenseCategoryWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (params.status) where.status = params.status
    if (params.expenseType) where.expenseType = params.expenseType
    if (q.length > 0) {
      where.OR = [
        { expenseCode: { contains: q, mode: "insensitive" } },
        { expenseName: { contains: q, mode: "insensitive" } },
        { expenseNameEn: { contains: q, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.expenseCategory.findMany({
        where,
        select: {
          id: true,
          expenseCode: true,
          expenseName: true,
          expenseNameEn: true,
          expenseType: true,
          standardAmount: true,
          currency: true,
          calculationType: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ expenseType: "asc" }, { expenseCode: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.expenseCategory.count({ where }),
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
// 2. 詳細取得
// =============================================================================
export async function getExpenseCategory(id: string) {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const row = await prisma.expenseCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!row) {
      return { ok: false as const, error: "諸経費カテゴリが見つかりません" }
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
// 3. 新規作成
// =============================================================================
export async function createExpenseCategory(
  input: ExpenseCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = expenseCategoryInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // コード重複の事前チェック（親切なエラーメッセージのため）
    const dup = await prisma.expenseCategory.findFirst({
      where: {
        companyId: sess.companyId,
        expenseCode: data.expenseCode,
        deletedAt: null,
      },
    })
    if (dup) {
      return {
        ok: false,
        error: `コード "${data.expenseCode}" は既に使用されています`,
      }
    }

    const created = await prisma.expenseCategory.create({
      data: {
        companyId: sess.companyId,
        expenseCode: data.expenseCode,
        expenseName: data.expenseName,
        expenseNameEn: data.expenseNameEn || null,
        expenseType: data.expenseType,
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
        entityType: "ExpenseCategory",
        entityId: created.id,
        afterData: {
          expenseCode: created.expenseCode,
          expenseName: created.expenseName,
          expenseType: created.expenseType,
          status: created.status,
        },
      },
    })

    revalidatePath("/expense-categories")
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
export async function updateExpenseCategory(
  id: string,
  input: ExpenseCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = expenseCategoryInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.expenseCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "諸経費カテゴリが見つかりません" }
    }

    // コード変更時のみ重複チェック
    if (existing.expenseCode !== data.expenseCode) {
      const dup = await prisma.expenseCategory.findFirst({
        where: {
          companyId: sess.companyId,
          expenseCode: data.expenseCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (dup) {
        return {
          ok: false,
          error: `コード "${data.expenseCode}" は既に使用されています`,
        }
      }
    }

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: {
        expenseCode: data.expenseCode,
        expenseName: data.expenseName,
        expenseNameEn: data.expenseNameEn || null,
        expenseType: data.expenseType,
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
        entityType: "ExpenseCategory",
        entityId: id,
        beforeData: {
          expenseCode: existing.expenseCode,
          expenseName: existing.expenseName,
          expenseType: existing.expenseType,
          status: existing.status,
        },
        afterData: {
          expenseCode: updated.expenseCode,
          expenseName: updated.expenseName,
          expenseType: updated.expenseType,
          status: updated.status,
        },
      },
    })

    revalidatePath("/expense-categories")
    revalidatePath(`/expense-categories/${id}`)
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
export async function archiveExpenseCategory(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.expenseCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "諸経費カテゴリが見つかりません" }
    }
    if (existing.status === ExpenseCategoryStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブ済みです" }
    }

    await prisma.expenseCategory.update({
      where: { id },
      data: { status: ExpenseCategoryStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ExpenseCategory",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: ExpenseCategoryStatus.ARCHIVED },
      },
    })

    revalidatePath("/expense-categories")
    revalidatePath(`/expense-categories/${id}`)
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
export async function restoreExpenseCategory(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.expenseCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "諸経費カテゴリが見つかりません" }
    }
    if (existing.status === ExpenseCategoryStatus.ACTIVE) {
      return { ok: false, error: "既に稼働中です" }
    }

    await prisma.expenseCategory.update({
      where: { id },
      data: { status: ExpenseCategoryStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ExpenseCategory",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: ExpenseCategoryStatus.ACTIVE },
      },
    })

    revalidatePath("/expense-categories")
    revalidatePath(`/expense-categories/${id}`)
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
// =============================================================================
export async function checkExpenseCategoryUsage(
  id: string,
): Promise<ActionResult<ExpenseCategoryUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.expenseCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "諸経費カテゴリが見つかりません" }
    }

    const quotationCostBreakdownCount =
      await prisma.quotationCostBreakdown.count({
        where: { expenseCategoryId: id },
      })

    return {
      ok: true,
      data: {
        quotationCostBreakdownCount,
        totalRefs: quotationCostBreakdownCount,
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
// 8. 物理削除(4 重ガード)
// =============================================================================
export async function deleteExpenseCategoryPermanently(
  id: string,
  confirmationName: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // ガード 1: MASTER_ADMIN 権限
    if (sess.tenantType !== "MASTER_ADMIN") {
      return {
        ok: false,
        error: "物理削除はマスター管理者のみ実行可能です",
      }
    }

    const existing = await prisma.expenseCategory.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "諸経費カテゴリが見つかりません" }
    }

    // ガード 2: ARCHIVED 状態
    if (existing.status !== ExpenseCategoryStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みのカテゴリのみ物理削除できます",
      }
    }

    // ガード 3: 確認名一致
    if (confirmationName.trim() !== existing.expenseName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    // ガード 4: 参照ゼロ
    const usage = await checkExpenseCategoryUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return {
        ok: false,
        error: `紐付くデータ（見積もり原価明細 ${usage.data.quotationCostBreakdownCount} 件）があるため削除できません`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.expenseCategory.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "ExpenseCategory",
        entityId: id,
        beforeData: {
          expenseCode: existing.expenseCode,
          expenseName: existing.expenseName,
          expenseType: existing.expenseType,
          status: existing.status,
        },
      },
    })

    revalidatePath("/expense-categories")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
