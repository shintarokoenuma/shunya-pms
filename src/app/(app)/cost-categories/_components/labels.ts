import {
  CostCategoryStatus,
  CalculationType,
  ExternalCostCategory,
} from "@prisma/client"

/**
 * Phase 1A-16: 原価費目マスター (CostCategory) ラベル定義
 *
 * - shunya-master-patterns.md の命名規約に従う
 * - 共通モジュール re-export は CURRENCY_OPTIONS のみ
 * - ExternalCostCategory (大分類 4 値) のラベルを定義
 */

// =============================================================================
// 共通モジュールからの re-export
// =============================================================================
export { CURRENCY_OPTIONS } from "@/lib/constants/currencies"

// =============================================================================
// ステータス
// =============================================================================
export const COST_CATEGORY_STATUS_LABELS: Record<CostCategoryStatus, string> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const COST_CATEGORY_STATUS_BADGE_VARIANT: Record<
  CostCategoryStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const COST_CATEGORY_STATUS_OPTIONS: {
  value: CostCategoryStatus
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]

// =============================================================================
// 大分類 (ExternalCostCategory: 4 値、Lv1 予約)
// =============================================================================
export const EXTERNAL_COST_CATEGORY_LABELS: Record<
  ExternalCostCategory,
  string
> = {
  MATERIAL: "材料費",
  SEWING: "縫製費",
  PROCESSING: "加工費",
  OVERHEAD: "諸経費",
}

export const EXTERNAL_COST_CATEGORY_OPTIONS: {
  value: ExternalCostCategory
  label: string
}[] = [
  { value: "MATERIAL", label: "材料費" },
  { value: "SEWING", label: "縫製費" },
  { value: "PROCESSING", label: "加工費" },
  { value: "OVERHEAD", label: "諸経費" },
]

// =============================================================================
// 計算方法 (CalculationType: 3 値)
// =============================================================================
export const CALCULATION_TYPE_LABELS: Record<CalculationType, string> = {
  FIXED: "固定額",
  PER_UNIT: "単価 × 数量",
  PERCENTAGE: "売上の％",
}

export const CALCULATION_TYPE_DESCRIPTIONS: Record<CalculationType, string> = {
  FIXED: "数量によらず一律の金額（例: パターン代 ¥30,000）",
  PER_UNIT: "数量に比例した金額（例: 検品費 ¥50/枚）",
  PERCENTAGE: "売上額に対する％（例: ロイヤリティ 3%）",
}

export const CALCULATION_TYPE_OPTIONS: {
  value: CalculationType
  label: string
}[] = [
  { value: "FIXED", label: "固定額" },
  { value: "PER_UNIT", label: "単価 × 数量" },
  { value: "PERCENTAGE", label: "売上の％" },
]
