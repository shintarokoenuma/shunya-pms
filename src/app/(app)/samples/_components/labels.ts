import {
  SampleProductionStatus,
  SampleRound,
  SampleRevisionType,
  RevisionRequestor,
} from "@prisma/client"
import {
  SAMPLE_REVISION_STATUSES,
  type SampleRevisionStatus,
} from "@/lib/validators/sample-revision"

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

// =============================================================================
// B-130 PR-C1: 修正記録（SampleRevision）
// =============================================================================

/** 修正タイプ（SampleRevisionType・9値すべて） */
export const SAMPLE_REVISION_TYPE_LABELS: Record<SampleRevisionType, string> = {
  DESIGN: "デザイン変更",
  PATTERN: "パターン修正",
  MATERIAL: "素材変更",
  COLOR: "色変更",
  SIZE: "サイズ調整",
  STITCHING: "縫製方法",
  FIT: "フィット感",
  DETAILS: "ディテール",
  OTHER: "その他",
}

export const SAMPLE_REVISION_TYPE_OPTIONS: {
  value: SampleRevisionType
  label: string
}[] = (Object.keys(SAMPLE_REVISION_TYPE_LABELS) as SampleRevisionType[]).map(
  (value) => ({ value, label: SAMPLE_REVISION_TYPE_LABELS[value] }),
)

/** 修正依頼元（RevisionRequestor・5値すべて。schema コメントの3値記載は誤り） */
export const REVISION_REQUESTOR_LABELS: Record<RevisionRequestor, string> = {
  CLIENT: "クライアント依頼",
  INTERNAL: "社内判断",
  FACTORY: "工場側の指摘",
  DESIGNER: "デザイナー",
  PATTERN_MAKER: "パタンナー",
}

export const REVISION_REQUESTOR_OPTIONS: {
  value: RevisionRequestor
  label: string
}[] = (Object.keys(REVISION_REQUESTOR_LABELS) as RevisionRequestor[]).map(
  (value) => ({ value, label: REVISION_REQUESTOR_LABELS[value] }),
)

/** 修正記録の状態（アプリ層 2値・DB は VarChar） */
export const SAMPLE_REVISION_STATUS_LABELS: Record<SampleRevisionStatus, string> = {
  PENDING: "未対応",
  COMPLETED: "対応済",
}

export const SAMPLE_REVISION_STATUS_OPTIONS: {
  value: SampleRevisionStatus
  label: string
}[] = SAMPLE_REVISION_STATUSES.map((value) => ({
  value,
  label: SAMPLE_REVISION_STATUS_LABELS[value],
}))
