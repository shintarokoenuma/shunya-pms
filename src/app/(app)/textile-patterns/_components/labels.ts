import type { TextilePatternStatusValue } from "@/lib/types/textile-pattern"

/**
 * B-066: 柄マスター ラベル定義。status は VarChar(20) 文字列・enum 化しない。
 */

export const TEXTILE_PATTERN_STATUS_LABELS: Record<
  TextilePatternStatusValue,
  string
> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const TEXTILE_PATTERN_STATUS_BADGE_VARIANT: Record<
  TextilePatternStatusValue,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const TEXTILE_PATTERN_STATUS_OPTIONS: {
  value: TextilePatternStatusValue
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]
