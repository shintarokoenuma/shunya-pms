import type { TextilePatternTypeStatusValue } from "@/lib/validators/textile-pattern-type"

/**
 * Phase 1A-13d: 柄種別マスター ラベル定義
 *
 * - status は VarChar(20) 文字列。Color / MaterialCategory と同じく enum 化しない
 * - 種別ラベルの辞書は不要 (typeName がそのまま表示名)
 */

export const TEXTILE_PATTERN_TYPE_STATUS_LABELS: Record<
  TextilePatternTypeStatusValue,
  string
> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const TEXTILE_PATTERN_TYPE_STATUS_BADGE_VARIANT: Record<
  TextilePatternTypeStatusValue,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const TEXTILE_PATTERN_TYPE_STATUS_OPTIONS: {
  value: TextilePatternTypeStatusValue
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]
