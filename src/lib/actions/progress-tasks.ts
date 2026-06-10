"use server"

import { revalidatePath } from "next/cache"
import {
  ProgressTaskStatus,
  ProgressTaskType,
  WorkOrderStatus,
  type ProgressTask,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  buildSampleTaskRows,
  PROCESSING_SORT_ORDER_BASE,
} from "@/lib/progress-task-template"
import {
  updateTaskStatusSchema,
  updateTaskSchema,
  addProcessingTasksSchema,
  type UpdateTaskInput,
} from "@/lib/validators/progress-task"

/**
 * S-3: 進行チェックリスト（ProgressTask）Server Actions
 *
 * 設計方針（S-3a 論理層 ＋ S-2 生成 transaction の写経・採番なし・生成系が主役）:
 * - SAMPLE 定型8種は SampleProduction 作成時に自動生成（A-2。createSampleProduction 側のフック）。
 *   本ファイルの generateTasksForRound は既存 SP の救済生成（冪等ガードつき）。
 * - PROCESSING 行は ProcessingType マスター参照で都度追加/削除（B-2）。
 * - status は全行手動チェック（evidenceMode は MANUAL 固定・触らない）。
 * - linked系FK は持たない。recomputeTaskStatus は空殻（S-4 縫い代）。
 * - companyId スコープ必須・soft delete 対応・物理削除は 4 重ガード。
 */

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
    tenantType: session.user.tenantType,
  }
}

// =============================================================================
// マスター参照（加工追加モーダル用 ACTIVE な ProcessingType）
// =============================================================================
export type ProcessingTypeOption = { id: string; code: string; name: string }

export async function listActiveProcessingTypesForSelect(): Promise<
  ProcessingTypeOption[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []
  const rows = await prisma.processingType.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, code: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  })
  return rows
}

// =============================================================================
// 1. 一覧（そのラウンドのタスク。PROCESSING 行は ProcessingType 名を manual join）
// =============================================================================
export type ProgressTaskItem = ProgressTask & {
  processingTypeName: string | null
}

export async function listTasks(params: {
  sampleProductionId: string
}): Promise<ActionResult<{ items: ProgressTaskItem[] }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const rows = await prisma.progressTask.findMany({
      where: {
        companyId: sess.companyId,
        sampleProductionId: params.sampleProductionId,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })

    const ptIds = [
      ...new Set(
        rows
          .map((r) => r.processingTypeId)
          .filter((v): v is string => !!v),
      ),
    ]
    const ptMap = new Map<string, string>()
    if (ptIds.length > 0) {
      const pts = await prisma.processingType.findMany({
        where: { id: { in: ptIds }, companyId: sess.companyId },
        select: { id: true, name: true },
      })
      for (const p of pts) ptMap.set(p.id, p.name)
    }

    const items: ProgressTaskItem[] = rows.map((r) => ({
      ...r,
      processingTypeName: r.processingTypeId
        ? ptMap.get(r.processingTypeId) ?? null
        : null,
    }))

    return { ok: true, data: { items } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "一覧取得に失敗しました",
    }
  }
}

// =============================================================================
// 2. 単票取得
// =============================================================================
export async function getTask(id: string) {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const row = await prisma.progressTask.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!row) return { ok: false as const, error: "タスクが見つかりません" }
    return { ok: true as const, data: row }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "取得に失敗しました",
    }
  }
}

// =============================================================================
// 3. ラウンド単位 定型生成（A-2・既存 SP 救済。冪等ガードつき）
// =============================================================================
export async function generateTasksForRound(
  sampleProductionId: string,
): Promise<ActionResult<{ generated: number }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const sp = await prisma.sampleProduction.findFirst({
      where: { id: sampleProductionId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productId: true },
    })
    if (!sp) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    // 冪等ガード：既に SAMPLE 定型がある場合は重複生成しない
    const existing = await prisma.progressTask.count({
      where: {
        companyId: sess.companyId,
        sampleProductionId,
        phase: "SAMPLE",
        deletedAt: null,
      },
    })
    if (existing > 0) {
      return { ok: true, data: { generated: 0 } }
    }

    const rows = buildSampleTaskRows(sess.companyId, sp.productId, sampleProductionId)
    await prisma.progressTask.createMany({ data: rows })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "ProgressTask",
        entityId: sampleProductionId,
        afterData: { generated: rows.length, sampleProductionId },
      },
    })

    revalidatePath(`/samples/${sampleProductionId}`)
    return { ok: true, data: { generated: rows.length } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "生成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 加工行の追加（B-2・ProcessingType マスター参照）
// =============================================================================
export async function addProcessingTasks(
  sampleProductionId: string,
  processingTypeIds: string[],
): Promise<ActionResult<{ added: number }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = addProcessingTasksSchema.safeParse({ processingTypeIds })
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }

    const sp = await prisma.sampleProduction.findFirst({
      where: { id: sampleProductionId, companyId: sess.companyId, deletedAt: null },
      select: { id: true, productId: true },
    })
    if (!sp) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    // 指定された ProcessingType が自社・有効か検証
    const valid = await prisma.processingType.findMany({
      where: {
        id: { in: parsed.data.processingTypeIds },
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true },
    })
    const validIds = valid.map((v) => v.id)
    if (validIds.length === 0) {
      return { ok: false, error: "有効な加工種別が指定されていません" }
    }

    // PROCESSING 行の sortOrder 起点（既存 PROCESSING 件数ぶん後ろにずらす）
    const existingProcessing = await prisma.progressTask.count({
      where: {
        companyId: sess.companyId,
        sampleProductionId,
        taskType: ProgressTaskType.PROCESSING,
        deletedAt: null,
      },
    })

    const rows = validIds.map((processingTypeId, i) => ({
      companyId: sess.companyId,
      productId: sp.productId,
      sampleProductionId,
      taskType: ProgressTaskType.PROCESSING,
      phase: "SAMPLE" as const,
      status: ProgressTaskStatus.NOT_STARTED,
      // S-4c-1(G2): PROCESSING は伝票駆動の自動算出対象
      evidenceMode: "AUTO_FROM_DOC" as const,
      processingTypeId,
      sortOrder: PROCESSING_SORT_ORDER_BASE + existingProcessing + i,
    }))
    await prisma.progressTask.createMany({ data: rows })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "ProgressTask",
        entityId: sampleProductionId,
        afterData: { addedProcessing: validIds.length, processingTypeIds: validIds },
      },
    })

    revalidatePath(`/samples/${sampleProductionId}`)
    return { ok: true, data: { added: validIds.length } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "加工の追加に失敗しました",
    }
  }
}

// =============================================================================
// 5. 手動チェック（status 更新。DONE 化で checkedByUserId/checkedAt 記録）
// =============================================================================
export async function updateTaskStatus(
  id: string,
  input: { status: ProgressTaskStatus },
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = updateTaskStatusSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: "ステータスが不正です" }
    }
    const nextStatus = parsed.data.status

    const existing = await prisma.progressTask.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true, sampleProductionId: true },
    })
    if (!existing) {
      return { ok: false, error: "タスクが見つかりません" }
    }

    await prisma.progressTask.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(nextStatus === ProgressTaskStatus.DONE
          ? { checkedByUserId: sess.userId, checkedAt: new Date() }
          : {}),
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "STATUS_CHANGE",
        entityType: "ProgressTask",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: nextStatus },
      },
    })

    if (existing.sampleProductionId) {
      revalidatePath(`/samples/${existing.sampleProductionId}`)
    }
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ステータス更新に失敗しました",
    }
  }
}

// =============================================================================
// 6. 付随情報の更新（notes / isReceived / assignee）
// =============================================================================
export async function updateTask(
  id: string,
  input: UpdateTaskInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = updateTaskSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.progressTask.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, sampleProductionId: true },
    })
    if (!existing) {
      return { ok: false, error: "タスクが見つかりません" }
    }

    await prisma.progressTask.update({
      where: { id },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.isReceived !== undefined ? { isReceived: data.isReceived } : {}),
        ...(data.assigneeType !== undefined
          ? { assigneeType: data.assigneeType }
          : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ProgressTask",
        entityId: id,
        afterData: { ...data },
      },
    })

    // S-4c-1: 入荷済みチェックの変更は AUTO_FROM_DOC タスクの DONE 化を誘発しうる
    if (data.isReceived !== undefined) {
      await recomputeTaskStatus(id)
    }

    if (existing.sampleProductionId) {
      revalidatePath(`/samples/${existing.sampleProductionId}`)
    }
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// 7. 加工行の取り消し（誤追加・soft delete。PROCESSING 行のみ）
// =============================================================================
export async function removeProcessingTask(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.progressTask.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, taskType: true, sampleProductionId: true },
    })
    if (!existing) {
      return { ok: false, error: "タスクが見つかりません" }
    }
    if (existing.taskType !== ProgressTaskType.PROCESSING) {
      return { ok: false, error: "加工タスクのみ取り消せます" }
    }

    await prisma.progressTask.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "ProgressTask",
        entityId: id,
        afterData: { deletedAt: new Date().toISOString(), reason: "removeProcessingTask" },
      },
    })

    if (existing.sampleProductionId) {
      revalidatePath(`/samples/${existing.sampleProductionId}`)
    }
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "取り消しに失敗しました",
    }
  }
}

// =============================================================================
// 8. 紐付き確認（S-4 縫い代。S-3 では伝票参照が無いため常に未使用）
// =============================================================================
export type ProgressTaskUsage = { linkedDocCount: number; totalRefs: number }

export async function checkUsage(
  id: string,
): Promise<ActionResult<ProgressTaskUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const existing = await prisma.progressTask.findFirst({
      where: { id, companyId: sess.companyId },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "タスクが見つかりません" }
    }
    // S-4 で伝票側 progressTaskId を逆引きして数える。現状は参照無し。
    return { ok: true, data: { linkedDocCount: 0, totalRefs: 0 } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "参照確認に失敗しました",
    }
  }
}

// =============================================================================
// 9. 物理削除（4 重ガード）
// =============================================================================
export async function deletePermanently(
  id: string,
  confirmToken: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // ガード 1: MASTER_ADMIN
    if (sess.tenantType !== "MASTER_ADMIN") {
      return { ok: false, error: "物理削除はマスター管理者のみ実行可能です" }
    }

    // ガード 2: companyId 一致
    const existing = await prisma.progressTask.findFirst({
      where: { id, companyId: sess.companyId },
      select: { id: true, taskType: true },
    })
    if (!existing) {
      return { ok: false, error: "タスクが見つかりません" }
    }

    // ガード 3: 確認トークン（タスク id 一致）
    if (confirmToken.trim() !== existing.id) {
      return { ok: false, error: "確認トークンが一致しません" }
    }

    // ガード 4: 未使用（S-4 で伝票参照を見る）
    const usage = await checkUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return { ok: false, error: "伝票から参照されているため削除できません" }
    }

    await runWithoutTenantContext(async () => {
      await prisma.progressTask.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "ProgressTask",
        entityId: id,
        beforeData: { taskType: existing.taskType },
      },
    })

    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}

// =============================================================================
// 10. status 自動再計算（S-3 は空殻・S-4 で実装が入る縫い代）
// =============================================================================
/**
 * S-4c-1(G1/G2): 紐づく live 伝票（PO/WO）を見て status を「前進のみ」で自動更新する。
 *
 * 不変条件・方針:
 * - SKIPPED は終端（不触）。BLOCKED も人の判断として不触（S-4c v1.0 では BLOCKED 未記載のため
 *   forward-only の安全側＝触らないと解釈。v1.1 で調整余地）。
 * - evidenceMode=AUTO_FROM_DOC のタスクのみ対象（MANUAL は据え置き）。
 * - 降格は一切しない（伝票が消えてもタスクは戻さない）。
 * - WO 系(PATTERN/SEWING/PROCESSING/GRADING): live WO>=1 で NOT_STARTED→IN_PROGRESS、
 *   live WO 全件 COMPLETED で →DONE。
 * - PO 系(FABRIC/TRIM/BODY): live PO>=1 で NOT_STARTED→IN_PROGRESS、完了は isReceived(手動)が正→DONE。
 * - 親アクションの成功後に呼ぶ補助。失敗しても親を巻き込まないよう内部で握りつぶす。
 */
const WO_DRIVEN_TASK_TYPES: ReadonlySet<ProgressTaskType> = new Set([
  ProgressTaskType.PATTERN,
  ProgressTaskType.SEWING,
  ProgressTaskType.PROCESSING,
  ProgressTaskType.GRADING,
])
const PO_DRIVEN_TASK_TYPES: ReadonlySet<ProgressTaskType> = new Set([
  ProgressTaskType.FABRIC,
  ProgressTaskType.TRIM,
  ProgressTaskType.BODY,
])

export async function recomputeTaskStatus(taskId: string): Promise<void> {
  try {
    const task = await prisma.progressTask.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        taskType: true,
        status: true,
        isReceived: true,
        evidenceMode: true,
        sampleProductionId: true,
      },
    })
    if (!task) return
    // 不変条件: 終端/人の判断は不触
    if (
      task.status === ProgressTaskStatus.SKIPPED ||
      task.status === ProgressTaskStatus.BLOCKED
    ) {
      return
    }
    if (task.evidenceMode !== "AUTO_FROM_DOC") return

    let next: ProgressTaskStatus = task.status

    if (WO_DRIVEN_TASK_TYPES.has(task.taskType)) {
      const wos = await prisma.workOrder.findMany({
        where: {
          companyId: task.companyId,
          progressTaskId: taskId,
          deletedAt: null,
        },
        select: { status: true },
      })
      if (wos.length >= 1) {
        if (task.status === ProgressTaskStatus.NOT_STARTED) {
          next = ProgressTaskStatus.IN_PROGRESS
        }
        if (
          wos.every((w) => w.status === WorkOrderStatus.COMPLETED) &&
          task.status !== ProgressTaskStatus.DONE
        ) {
          next = ProgressTaskStatus.DONE
        }
      }
    } else if (PO_DRIVEN_TASK_TYPES.has(task.taskType)) {
      const poCount = await prisma.purchaseOrder.count({
        where: {
          companyId: task.companyId,
          progressTaskId: taskId,
          deletedAt: null,
        },
      })
      if (poCount >= 1 && task.status === ProgressTaskStatus.NOT_STARTED) {
        next = ProgressTaskStatus.IN_PROGRESS
      }
      // 完了は入荷済み（手動）が正。発注済み≠入荷済み。
      if (task.isReceived === true && task.status !== ProgressTaskStatus.DONE) {
        next = ProgressTaskStatus.DONE
      }
    }

    if (next === task.status) return

    await prisma.progressTask.update({
      where: { id: taskId },
      data: {
        status: next,
        ...(next === ProgressTaskStatus.DONE
          ? { checkedAt: new Date() }
          : {}),
      },
    })
    await prisma.auditLog.create({
      data: {
        companyId: task.companyId,
        action: "STATUS_CHANGE",
        entityType: "ProgressTask",
        entityId: taskId,
        beforeData: { status: task.status, auto: true },
        afterData: { status: next, auto: true },
      },
    })
    if (task.sampleProductionId) {
      revalidatePath(`/samples/${task.sampleProductionId}`)
    }
  } catch {
    // 自動算出の失敗は親アクションを巻き込まない（forward-only の補助処理）
    return
  }
}
