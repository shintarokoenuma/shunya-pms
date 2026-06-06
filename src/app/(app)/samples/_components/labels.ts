import { SampleProductionStatus, SampleRound } from "@prisma/client"

/**
 * S-2: サンプル製作セット（SampleProduction）ラベル定義
 *
 * - shunya-master-patterns.md v1.2 §4 / S-1 products の命名規約に従う
 * - SampleProductionStatus は 10 値（ARCHIVED は無い。archive は deletedAt soft-delete で表現）
 * - SampleRound は 4 値（FIRST/SECOND/THIRD/ADDITIONAL）
 */

// =============================================================================
// ステータス：日本語ラベル
// =============================================================================
export const SAMPLE_STATUS_LABELS: Record<SampleProductionStatus, string> = {
  PLANNING: "企画中",
  PATTERN_IN_PROGRESS: "パターン作成中",
  MATERIAL_ORDERING: "材料手配中",
  SEWING_IN_PROGRESS: "縫製中",
  COMPLETED: "完成",
  IN_REVIEW: "クライアントレビュー中",
  REVISION_REQUESTED: "修正依頼あり",
  APPROVED: "承認済",
  REJECTED: "却下",
  CANCELLED: "キャンセル",
}

export const SAMPLE_STATUS_BADGE_VARIANT: Record<
  SampleProductionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  PLANNING: "outline",
  PATTERN_IN_PROGRESS: "default",
  MATERIAL_ORDERING: "default",
  SEWING_IN_PROGRESS: "default",
  COMPLETED: "default",
  IN_REVIEW: "default",
  REVISION_REQUESTED: "outline",
  APPROVED: "secondary",
  REJECTED: "destructive",
  CANCELLED: "destructive",
}

/** status 遷移 Select / フィルタ用（全 10 値） */
export const SAMPLE_STATUS_OPTIONS: {
  value: SampleProductionStatus
  label: string
}[] = (Object.keys(SAMPLE_STATUS_LABELS) as SampleProductionStatus[]).map(
  (value) => ({ value, label: SAMPLE_STATUS_LABELS[value] }),
)

// =============================================================================
// ラウンド
// =============================================================================
export const SAMPLE_ROUND_LABELS: Record<SampleRound, string> = {
  FIRST: "1st",
  SECOND: "2nd",
  THIRD: "3rd",
  ADDITIONAL: "追加",
}

export const SAMPLE_ROUND_BADGE_VARIANT: Record<
  SampleRound,
  "default" | "secondary" | "destructive" | "outline"
> = {
  FIRST: "default",
  SECOND: "secondary",
  THIRD: "secondary",
  ADDITIONAL: "outline",
}

export const SAMPLE_ROUND_OPTIONS: { value: SampleRound; label: string }[] = (
  Object.keys(SAMPLE_ROUND_LABELS) as SampleRound[]
).map((value) => ({ value, label: SAMPLE_ROUND_LABELS[value] }))
