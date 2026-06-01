import type { ColorStatusValue } from "@/lib/validators/color"

/**
 * Phase 1A-13c: 色マスター ラベル定義
 *
 * - status は VarChar(20) 文字列。MaterialCategory のような enum 化はしない
 * - HUE_GROUP_LABELS は colorNumber 十の位 (0-9) と色相系統の対応表
 */

// =============================================================================
// ステータス
// =============================================================================
export const COLOR_STATUS_LABELS: Record<ColorStatusValue, string> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const COLOR_STATUS_BADGE_VARIANT: Record<
  ColorStatusValue,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const COLOR_STATUS_OPTIONS: { value: ColorStatusValue; label: string }[] =
  [
    { value: "ACTIVE", label: "稼働中" },
    { value: "ARCHIVED", label: "アーカイブ" },
  ]

// =============================================================================
// 色相系統（colorNumber 十の位）
// =============================================================================
export const HUE_GROUP_LABELS: Record<number, string> = {
  0: "グレー（明）",
  1: "レッド",
  2: "オレンジ",
  3: "イエロー",
  4: "グリーン",
  5: "ブルー",
  6: "パープル",
  7: "ピンク",
  8: "ブラウン",
  9: "グレー（暗）",
}

export const HUE_GROUP_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "0: グレー（明）" },
  { value: 1, label: "1: レッド" },
  { value: 2, label: "2: オレンジ" },
  { value: 3, label: "3: イエロー" },
  { value: 4, label: "4: グリーン" },
  { value: 5, label: "5: ブルー" },
  { value: 6, label: "6: パープル" },
  { value: 7, label: "7: ピンク" },
  { value: 8, label: "8: ブラウン" },
  { value: 9, label: "9: グレー（暗）" },
]
