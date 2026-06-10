import { WorkOrderStatus, WorkOrderCategory } from "@prisma/client"

/**
 * S-4b-2: 作業発注（WO）ラベル定義
 */

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  DRAFT: "ドラフト",
  PENDING_APPROVAL: "承認待ち",
  APPROVED: "承認済み",
  SENT: "送付済み",
  ACKNOWLEDGED: "受領確認済み",
  IN_PRODUCTION: "生産中",
  QUALITY_CHECK: "検品中",
  SHIPPED: "出荷済み",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
  ON_HOLD: "保留",
}

export const WORK_ORDER_STATUS_BADGE_VARIANT: Record<
  WorkOrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  PENDING_APPROVAL: "outline",
  APPROVED: "default",
  SENT: "default",
  ACKNOWLEDGED: "default",
  IN_PRODUCTION: "default",
  QUALITY_CHECK: "default",
  SHIPPED: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  ON_HOLD: "outline",
}

export const WORK_ORDER_STATUS_OPTIONS: {
  value: WorkOrderStatus
  label: string
}[] = (Object.keys(WORK_ORDER_STATUS_LABELS) as WorkOrderStatus[]).map(
  (value) => ({ value, label: WORK_ORDER_STATUS_LABELS[value] }),
)

export const WORK_ORDER_CATEGORY_LABELS: Record<WorkOrderCategory, string> = {
  PRODUCTION: "量産",
  SAMPLE: "サンプル",
  PATTERN: "パターン",
  GRADING: "グレーディング",
  REWORK: "やり直し",
  ADDITIONAL: "追加発注",
}

export const WORK_ORDER_CATEGORY_OPTIONS: {
  value: WorkOrderCategory
  label: string
}[] = (Object.keys(WORK_ORDER_CATEGORY_LABELS) as WorkOrderCategory[]).map(
  (value) => ({ value, label: WORK_ORDER_CATEGORY_LABELS[value] }),
)

export {
  BILLING_CLASSIFICATION_LABELS,
  BILLING_CLASSIFICATION_OPTIONS,
} from "../../purchase-orders/_components/labels"
