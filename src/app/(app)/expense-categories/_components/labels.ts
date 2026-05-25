import {
  ExpenseCategoryStatus,
  ExpenseType,
  CalculationType,
} from "@prisma/client"

/**
 * Phase 1A-8: 諸経費カテゴリマスター ラベル定義
 *
 * - shunya-master-patterns.md の命名規約に従う
 *   - _LABELS: バッジ等の表示用 Record
 *   - _OPTIONS: Select 用 Array
 *   - _BADGE_VARIANT: shadcn Badge variant マッピング
 * - 共通モジュール re-export は CURRENCY_OPTIONS のみ
 *   （standardAmount の通貨選択用）
 * - 連絡先・住所・言語等は不要なため、country / chat-tools /
 *   languages / payment 系の re-export はなし
 */

// =============================================================================
// 共通モジュールからの re-export
// =============================================================================
export { CURRENCY_OPTIONS } from "@/lib/constants/currencies"

// =============================================================================
// ステータス
// =============================================================================
export const EXPENSE_CATEGORY_STATUS_LABELS: Record<
  ExpenseCategoryStatus,
  string
> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const EXPENSE_CATEGORY_STATUS_BADGE_VARIANT: Record<
  ExpenseCategoryStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const EXPENSE_CATEGORY_STATUS_OPTIONS: {
  value: ExpenseCategoryStatus
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]

// =============================================================================
// 費用種別（ExpenseType: 16 値）
// =============================================================================
export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  // 製造関連
  PATTERN_FEE: "パターン代",
  GRADING_FEE: "グレーディング代",
  SAMPLE_FEE: "サンプル代",
  INSPECTION_FEE: "検品費",
  // 加工関連
  PROCESSING_FEE: "加工費（特殊）",
  PRINTING_FEE: "プリント費",
  EMBROIDERY_FEE: "刺繍費",
  WASHING_FEE: "洗い費",
  // 輸送・通関関連
  TRANSPORT_FEE: "輸送費",
  CUSTOMS_FEE: "通関費",
  TARIFF: "関税",
  IMPORT_TAX: "輸入消費税",
  STORAGE_FEE: "倉庫保管費",
  // その他
  PHOTOGRAPHY_FEE: "撮影費",
  RENTAL_FEE: "レンタル費",
  OTHER: "その他",
}

/**
 * Select 用の選択肢
 * 業務上のグルーピング順に並べる（製造 → 加工 → 輸送 → その他）
 */
export const EXPENSE_TYPE_OPTIONS: {
  value: ExpenseType
  label: string
}[] = [
  // 製造関連
  { value: "PATTERN_FEE", label: "パターン代" },
  { value: "GRADING_FEE", label: "グレーディング代" },
  { value: "SAMPLE_FEE", label: "サンプル代" },
  { value: "INSPECTION_FEE", label: "検品費" },
  // 加工関連
  { value: "PROCESSING_FEE", label: "加工費（特殊）" },
  { value: "PRINTING_FEE", label: "プリント費" },
  { value: "EMBROIDERY_FEE", label: "刺繍費" },
  { value: "WASHING_FEE", label: "洗い費" },
  // 輸送・通関関連
  { value: "TRANSPORT_FEE", label: "輸送費" },
  { value: "CUSTOMS_FEE", label: "通関費" },
  { value: "TARIFF", label: "関税" },
  { value: "IMPORT_TAX", label: "輸入消費税" },
  { value: "STORAGE_FEE", label: "倉庫保管費" },
  // その他
  { value: "PHOTOGRAPHY_FEE", label: "撮影費" },
  { value: "RENTAL_FEE", label: "レンタル費" },
  { value: "OTHER", label: "その他" },
]

// =============================================================================
// 計算方法（CalculationType: 3 値）
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
