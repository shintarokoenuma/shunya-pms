import type { PatternWorkType } from "@prisma/client"

/**
 * B-054/B-146 PR-2: 型紙の記録（PatternVersion）の共有型と表示名（中立モジュール）。
 * client component が "use server" の actions から型を import しないための置き場所（product-sketch.ts と同形）。
 * ★version（v1/v2…）は内部の採番で、画面には出さない（D-12: 主役は受領日と種別）。
 */

export type PatternVersionView = {
  id: string
  modelCodeId: string
  receivedAt: string | null // ISO（Date は Server→Client で直列化できないため）
  workType: PatternWorkType
  hasGrading: boolean
  gradingSizes: string[]
  revisionNotes: string | null
  driveFileUrl: string | null
  contractorId: string | null
  contractorName: string | null
  createdAt: string
}

/** PatternWorkType の表示名（新規 / 修正 / グレーディング追加 / グレーディング修正 / 別モデルからコピー） */
export const PATTERN_WORK_TYPE_LABELS: Record<PatternWorkType, string> = {
  NEW: "新規",
  REVISION: "修正",
  GRADING: "グレーディング追加",
  RE_GRADING: "グレーディング修正",
  COPY: "別モデルからコピー",
}

export const PATTERN_WORK_TYPE_OPTIONS: { value: PatternWorkType; label: string }[] = (
  Object.keys(PATTERN_WORK_TYPE_LABELS) as PatternWorkType[]
).map((value) => ({ value, label: PATTERN_WORK_TYPE_LABELS[value] }))
