import { ProductCategoryStatus } from "@prisma/client"

// =============================================================================
// 共通モジュールからの re-export（Factory / Contractor と同じパターン）
// =============================================================================
// ProductCategory は連絡先・住所がないため、country / chat-tools / currencies /
// languages / payment 系は不要。共通モジュールからの re-export はなし。

// =============================================================================
// ステータス
// =============================================================================
export const PRODUCT_CATEGORY_STATUS_LABELS: Record<ProductCategoryStatus, string> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const PRODUCT_CATEGORY_STATUS_BADGE_VARIANT: Record<
  ProductCategoryStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const PRODUCT_CATEGORY_STATUS_OPTIONS: {
  value: ProductCategoryStatus
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]

// =============================================================================
// 階層レベル
// =============================================================================
export const PRODUCT_CATEGORY_LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: "大分類",
  2: "中分類",
  3: "小分類",
}

export const PRODUCT_CATEGORY_LEVEL_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "大分類（レベル 1）" },
  { value: 2, label: "中分類（レベル 2）" },
  { value: 3, label: "小分類（レベル 3）" },
]
