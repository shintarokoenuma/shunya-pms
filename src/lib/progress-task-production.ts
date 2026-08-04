import { ProgressTaskType, WorkOrderType } from "@prisma/client"

/**
 * B-101 §3-2: PRODUCTION タスク → 照合する WorkOrderType。
 * progressTaskId は使わず productId + workCategory=PRODUCTION + workType で引く（案C 導出照合）。
 * FABRIC / TRIM は含めない（PO は仕入先単位で束ねられ生地/付属を区別できないため。
 * この2種は既存 recomputeTaskStatus が isReceived 経由で DONE 化する）。
 */
export const PRODUCTION_WO_TYPE_MAP: Partial<
  Record<ProgressTaskType, WorkOrderType>
> = {
  [ProgressTaskType.GRADING]: WorkOrderType.GRADING,
  [ProgressTaskType.CUTTING]: WorkOrderType.CUTTING,
  [ProgressTaskType.SEWING]: WorkOrderType.SEWING,
  [ProgressTaskType.FINISHING]: WorkOrderType.FINISHING,
  // PROCESSING は ProcessingType.workType を実行時に解決（マップに載せない）
}
