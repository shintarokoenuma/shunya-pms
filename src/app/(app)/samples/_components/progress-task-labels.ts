import { ProgressTaskType, ProgressTaskStatus } from "@prisma/client"

/**
 * S-3: 進行チェックリスト（ProgressTask）ラベル定義
 * processing-types の labels.ts を写経。
 */

export const PROGRESS_TASK_TYPE_LABELS: Record<ProgressTaskType, string> = {
  QUOTE: "見積もり",
  SPEC_LOCK: "デザイン・仕様確定",
  PATTERN: "パターン作成",
  FABRIC: "生地手配",
  TRIM: "付属手配",
  SEWING: "縫製依頼",
  PROCESSING: "加工",
  INSPECTION: "検品",
  CLIENT_REVIEW: "先方提出・評価",
  GRADING: "グレーディング",
  SHIPPING: "出荷明細",
  DELIVERY: "納品書",
  INVOICE: "請求書",
}

export const PROGRESS_TASK_STATUS_LABELS: Record<ProgressTaskStatus, string> = {
  NOT_STARTED: "未着手",
  IN_PROGRESS: "進行中",
  DONE: "完了",
  BLOCKED: "ブロック",
  SKIPPED: "スキップ",
}

export const PROGRESS_TASK_STATUS_BADGE_VARIANT: Record<
  ProgressTaskStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "default",
  DONE: "secondary",
  BLOCKED: "destructive",
  SKIPPED: "outline",
}

export const PROGRESS_TASK_STATUS_OPTIONS: {
  value: ProgressTaskStatus
  label: string
}[] = [
  { value: "NOT_STARTED", label: "未着手" },
  { value: "IN_PROGRESS", label: "進行中" },
  { value: "DONE", label: "完了" },
  { value: "BLOCKED", label: "ブロック" },
  { value: "SKIPPED", label: "スキップ" },
]
