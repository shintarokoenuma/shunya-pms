"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  ProcessingTypeStatus,
  WorkOrderType,
  type ProcessingType,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  processingTypeBaseSchema,
  type ProcessingTypeInput,
} from "@/lib/validators/processing-type"

/**
 * S-3a: 加工種別（ProcessingType）Server Actions
 *
 * 設計方針（master-patterns v1.2 §5 / Buyer・DeliveryDestination を precedent）:
 * - 8 操作: list / get / create / update / archive / restore / checkUsage / deletePermanently
 * - code は自動採番 `PRC-{連番3桁}`（companyId 単位）。create 時に transaction 内で確定・衝突リトライ
 *   （ModelCode の採番を precedent に）。連番は deletedAt 済みも含めて計算（連続性のため）。
 * - 物理削除は 4 重ガード（MASTER_ADMIN + ARCHIVED + 確認名 + 参照0）。
 * - 参照（usage）対象は将来 ProgressTask(processingTypeId)。S-3 未実装のため現状 0 件。
 * ※ enum AiProcessingType（AI処理種別）とは無関係。
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type ProcessingTypeUsage = {
  // 将来 ProgressTask(taskType=PROCESSING) が processingTypeId で参照する
  progressTaskCount: number
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
// 採番ヘルパー（PRC-{連番3桁}・companyId 単位・deletedAt 込み）
// =============================================================================
const CODE_PREFIX = "PRC-"

type ProcessingTypeFinder = {
  findFirst: (args: {
    where: { companyId: string; code: { startsWith: string } }
    orderBy: { code: "desc" }
    select: { code: true }
  }) => Promise<{ code: string } | null>
}

async function computeNextProcessingTypeCode(
  finder: ProcessingTypeFinder,
  companyId: string,
): Promise<string> {
  const last = await finder.findFirst({
    where: { companyId, code: { startsWith: CODE_PREFIX } },
    orderBy: { code: "desc" },
    select: { code: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.code.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${CODE_PREFIX}${String(nextNum).padStart(3, "0")}`
}

/** UI のプレビュー専用：次の加工種別コードを返す（保存時に再計算・確定）。 */
export async function generateNextProcessingTypeCodePreview(): Promise<
  ActionResult<{ preview: string }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const preview = await computeNextProcessingTypeCode(
      prisma.processingType,
      sess.companyId,
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
export type ListProcessingTypesParams = {
  q?: string
  status?: ProcessingTypeStatus
  workType?: WorkOrderType
  page?: number
  pageSize?: number
}

export type ProcessingTypeListItem = Pick<
  ProcessingType,
  | "id"
  | "code"
  | "name"
  | "workType"
  | "nameEn"
  | "sortOrder"
  | "status"
  | "createdAt"
  | "updatedAt"
>

export async function listProcessingTypes(
  params: ListProcessingTypesParams = {},
): Promise<
  ActionResult<{
    items: ProcessingTypeListItem[]
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

    const where: Prisma.ProcessingTypeWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (params.status) where.status = params.status
    if (params.workType) where.workType = params.workType
    if (q.length > 0) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { nameEn: { contains: q, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.processingType.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          workType: true,
          nameEn: true,
          sortOrder: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.processingType.count({ where }),
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
export async function getProcessingType(id: string) {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const row = await prisma.processingType.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!row) {
      return { ok: false as const, error: "加工種別が見つかりません" }
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
// 3. 新規作成（PRC-NNN 自動採番・衝突リトライ）
// =============================================================================
const CREATE_MAX_RETRIES = 3

export async function createProcessingType(
  input: ProcessingTypeInput,
): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = processingTypeBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    let created: { id: string; code: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const code = await computeNextProcessingTypeCode(
            tx.processingType,
            sess.companyId,
          )
          return tx.processingType.create({
            data: {
              companyId: sess.companyId,
              code,
              name: data.name,
              workType: data.workType,
              nameEn: data.nameEn || null,
              description: data.description || null,
              sortOrder: data.sortOrder,
              status: data.status,
            },
            select: { id: true, code: true },
          })
        })
        break
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue // code unique 衝突：再試行
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
        entityType: "ProcessingType",
        entityId: created.id,
        afterData: {
          code: created.code,
          name: data.name,
          workType: data.workType,
          status: data.status,
        },
      },
    })

    revalidatePath("/processing-types")
    return { ok: true, data: { id: created.id, code: created.code } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新（code は immutable）
// =============================================================================
export async function updateProcessingType(
  id: string,
  input: ProcessingTypeInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = processingTypeBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.processingType.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "加工種別が見つかりません" }
    }

    const updated = await prisma.processingType.update({
      where: { id },
      data: {
        // code は immutable（送らない）
        name: data.name,
        workType: data.workType,
        nameEn: data.nameEn || null,
        description: data.description || null,
        sortOrder: data.sortOrder,
        status: data.status,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ProcessingType",
        entityId: id,
        beforeData: {
          code: existing.code,
          name: existing.name,
          workType: existing.workType,
          nameEn: existing.nameEn,
          description: existing.description,
          sortOrder: existing.sortOrder,
          status: existing.status,
        },
        afterData: {
          code: updated.code,
          name: updated.name,
          workType: updated.workType,
          nameEn: updated.nameEn,
          description: updated.description,
          sortOrder: updated.sortOrder,
          status: updated.status,
        },
      },
    })

    revalidatePath("/processing-types")
    revalidatePath(`/processing-types/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. アーカイブ（status=ARCHIVED）
// =============================================================================
export async function archiveProcessingType(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.processingType.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true },
    })
    if (!existing) {
      return { ok: false, error: "加工種別が見つかりません" }
    }
    if (existing.status === ProcessingTypeStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブ済みです" }
    }

    await prisma.processingType.update({
      where: { id },
      data: { status: ProcessingTypeStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ProcessingType",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: ProcessingTypeStatus.ARCHIVED },
      },
    })

    revalidatePath("/processing-types")
    revalidatePath(`/processing-types/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 6. 復元（status=ACTIVE）
// =============================================================================
export async function restoreProcessingType(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.processingType.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true },
    })
    if (!existing) {
      return { ok: false, error: "加工種別が見つかりません" }
    }
    if (existing.status === ProcessingTypeStatus.ACTIVE) {
      return { ok: false, error: "既に稼働中です" }
    }

    await prisma.processingType.update({
      where: { id },
      data: { status: ProcessingTypeStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ProcessingType",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: ProcessingTypeStatus.ACTIVE },
      },
    })

    revalidatePath("/processing-types")
    revalidatePath(`/processing-types/${id}`)
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
//    将来 ProgressTask(processingTypeId) を数える。S-3 未実装のため現状 0。
// =============================================================================
export async function checkProcessingTypeUsage(
  id: string,
): Promise<ActionResult<ProcessingTypeUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.processingType.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "加工種別が見つかりません" }
    }

    // ProgressTask は S-3 で追加予定。現状は参照モデルが無いため 0。
    const progressTaskCount = 0

    return {
      ok: true,
      data: { progressTaskCount, totalRefs: progressTaskCount },
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
export async function deleteProcessingTypePermanently(
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

    const existing = await prisma.processingType.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "加工種別が見つかりません" }
    }

    // ガード 2: ARCHIVED
    if (existing.status !== ProcessingTypeStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みの加工種別のみ物理削除できます",
      }
    }

    // ガード 3: 確認名一致（name で確認）
    if (confirmationName.trim() !== existing.name) {
      return { ok: false, error: "確認名が一致しません" }
    }

    // ガード 4: 参照ゼロ
    const usage = await checkProcessingTypeUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return {
        ok: false,
        error: `この加工種別は ${usage.data.progressTaskCount} 件の進行タスクから参照されています。`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.processingType.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "ProcessingType",
        entityId: id,
        beforeData: {
          code: existing.code,
          name: existing.name,
          status: existing.status,
        },
      },
    })

    revalidatePath("/processing-types")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
