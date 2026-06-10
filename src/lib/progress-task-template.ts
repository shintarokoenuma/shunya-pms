import { Prisma, ProgressTaskType } from "@prisma/client"

/**
 * S-3: 進行チェックリストの SAMPLE phase 定型テンプレート（A-2＝ラウンド単位）。
 *
 * SampleProduction 作成時、および既存 SP の「チェックリストを生成」で使う。
 * PROCESSING は含めない（加工はチェックリスト画面から都度追加＝B-2、sortOrder 65 起点）。
 * "use server" を持たない純モジュールにすることで、actions（sample-productions / progress-tasks）
 * 双方から import できる。
 */

export type SampleTaskTemplateRow = {
  taskType: ProgressTaskType
  sortOrder: number
  /** FABRIC / TRIM のみ「発注済み ≠ 入荷済み」を別状態で持つため false 初期化。それ以外は null */
  isReceived: boolean | null
}

/** SAMPLE phase 定型 8 種（PROCESSING 除く）。表示は常に sortOrder ASC。 */
export const SAMPLE_TASK_TEMPLATE: readonly SampleTaskTemplateRow[] = [
  { taskType: ProgressTaskType.QUOTE, sortOrder: 10, isReceived: null },
  { taskType: ProgressTaskType.SPEC_LOCK, sortOrder: 20, isReceived: null },
  { taskType: ProgressTaskType.PATTERN, sortOrder: 30, isReceived: null },
  { taskType: ProgressTaskType.FABRIC, sortOrder: 40, isReceived: false },
  { taskType: ProgressTaskType.TRIM, sortOrder: 50, isReceived: false },
  { taskType: ProgressTaskType.SEWING, sortOrder: 60, isReceived: null },
  // PROCESSING 行は 65 起点で後から追加（B-2）
  { taskType: ProgressTaskType.INSPECTION, sortOrder: 70, isReceived: null },
  { taskType: ProgressTaskType.CLIENT_REVIEW, sortOrder: 80, isReceived: null },
]

/** PROCESSING 行の sortOrder 起点（SEWING(60) と INSPECTION(70) の間） */
export const PROCESSING_SORT_ORDER_BASE = 65

/**
 * S-4c-1(G2): 伝票駆動で status を自動算出（recomputeTaskStatus）する taskType 群。
 * 生成時に evidenceMode=AUTO_FROM_DOC を付与する。これ以外は MANUAL。
 * （D1: PATTERN/FABRIC/TRIM/SEWING/PROCESSING/BODY の6種）
 */
export const AUTO_FROM_DOC_TASK_TYPES: ReadonlySet<ProgressTaskType> = new Set([
  ProgressTaskType.PATTERN,
  ProgressTaskType.FABRIC,
  ProgressTaskType.TRIM,
  ProgressTaskType.SEWING,
  ProgressTaskType.PROCESSING,
  ProgressTaskType.BODY,
])

/**
 * SAMPLE 定型 8 行を createMany 用データに展開する。
 * createSampleProduction の同一 transaction 内、および generateTasksForRound から使う。
 */
export function buildSampleTaskRows(
  companyId: string,
  productId: string,
  sampleProductionId: string,
): Prisma.ProgressTaskCreateManyInput[] {
  return SAMPLE_TASK_TEMPLATE.map((t) => ({
    companyId,
    productId,
    sampleProductionId,
    taskType: t.taskType,
    phase: "SAMPLE",
    status: "NOT_STARTED",
    // S-4c-1(G2): 6種は伝票駆動の自動算出対象として AUTO_FROM_DOC を付与。
    evidenceMode: AUTO_FROM_DOC_TASK_TYPES.has(t.taskType)
      ? "AUTO_FROM_DOC"
      : "MANUAL",
    sortOrder: t.sortOrder,
    isReceived: t.isReceived,
  }))
}

/** 伝票で動く行＝「発注書を作る」ボタンを置く（S-3 は非活性）taskType 群 */
export const DOC_DRIVEN_TASK_TYPES: ReadonlySet<ProgressTaskType> = new Set([
  ProgressTaskType.PATTERN,
  ProgressTaskType.FABRIC,
  ProgressTaskType.TRIM,
  ProgressTaskType.SEWING,
  ProgressTaskType.PROCESSING,
])
