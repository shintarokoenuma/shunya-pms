import { MaterialCategoryStatus } from "@prisma/client"

/**
 * Phase 1A-15: 素材カテゴリマスター ラベル定義
 *
 * - shunya-master-patterns.md v1.2 §4 / §8 の命名規約に従う
 * - ProductCategory（Phase 1A-7/14）と同パターン
 */

// =============================================================================
// ステータス
// =============================================================================
export const MATERIAL_CATEGORY_STATUS_LABELS: Record<
  MaterialCategoryStatus,
  string
> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const MATERIAL_CATEGORY_STATUS_BADGE_VARIANT: Record<
  MaterialCategoryStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const MATERIAL_CATEGORY_STATUS_OPTIONS: {
  value: MaterialCategoryStatus
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]

// =============================================================================
// 階層レベル
// =============================================================================
export const MATERIAL_CATEGORY_LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: "大分類",
  2: "中分類",
  3: "小分類",
}

export const MATERIAL_CATEGORY_LEVEL_OPTIONS: {
  value: 1 | 2 | 3
  label: string
}[] = [
  { value: 1, label: "大分類（レベル 1）" },
  { value: 2, label: "中分類（レベル 2）" },
  { value: 3, label: "小分類（レベル 3）" },
]
