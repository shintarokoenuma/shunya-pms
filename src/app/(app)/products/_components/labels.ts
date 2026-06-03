import { ProductStatus } from "@prisma/client"

/**
 * S-1: 品番カルテ（Product）ラベル定義
 *
 * - shunya-master-patterns.md v1.2 §4 / §8 の命名規約に従う
 * - ProductStatus は 13 値（サンプル系 4 / 量産系 6 + CANCELLED / ON_HOLD / ARCHIVED）
 *   バッジ色は「進行中＝default」「異常終端＝destructive」「保留・終端＝secondary/outline」で見分け
 * - サンプル系（PLANNING / SAMPLE_REQUESTED / SAMPLE_IN_PROGRESS / SAMPLE_APPROVED）が S-1 主要遷移
 */

// =============================================================================
// ステータス（ProductStatus 13 値）
// =============================================================================
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  PLANNING: "企画中",
  SAMPLE_REQUESTED: "サンプル依頼受付",
  SAMPLE_IN_PROGRESS: "サンプル製作中",
  SAMPLE_APPROVED: "サンプル承認済",
  ORDERING_PERIOD: "受注期間中",
  ORDER_CONFIRMED: "受注確定",
  MASS_PRODUCTION: "量産中",
  INSPECTION: "検品中",
  DELIVERED: "納品済",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
  ON_HOLD: "保留中",
  ARCHIVED: "アーカイブ",
}

export const PRODUCT_STATUS_BADGE_VARIANT: Record<
  ProductStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  // サンプル系（進行中）
  PLANNING: "default",
  SAMPLE_REQUESTED: "default",
  SAMPLE_IN_PROGRESS: "default",
  SAMPLE_APPROVED: "default",
  // 量産系（進行中）
  ORDERING_PERIOD: "default",
  ORDER_CONFIRMED: "default",
  MASS_PRODUCTION: "default",
  INSPECTION: "default",
  DELIVERED: "default",
  // 正常終端
  COMPLETED: "secondary",
  // 異常終端
  CANCELLED: "destructive",
  // 一時状態
  ON_HOLD: "outline",
  ARCHIVED: "secondary",
}

export const PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string }[] =
  [
    { value: "PLANNING", label: "企画中" },
    { value: "SAMPLE_REQUESTED", label: "サンプル依頼受付" },
    { value: "SAMPLE_IN_PROGRESS", label: "サンプル製作中" },
    { value: "SAMPLE_APPROVED", label: "サンプル承認済" },
    { value: "ORDERING_PERIOD", label: "受注期間中" },
    { value: "ORDER_CONFIRMED", label: "受注確定" },
    { value: "MASS_PRODUCTION", label: "量産中" },
    { value: "INSPECTION", label: "検品中" },
    { value: "DELIVERED", label: "納品済" },
    { value: "COMPLETED", label: "完了" },
    { value: "CANCELLED", label: "キャンセル" },
    { value: "ON_HOLD", label: "保留中" },
    { value: "ARCHIVED", label: "アーカイブ" },
  ]

// =============================================================================
// ModelCode モード
// =============================================================================
export const MODEL_CODE_MODE_LABELS: Record<"existing" | "new", string> = {
  existing: "既存のモデルコードから選ぶ",
  new: "新規モデルコードを発番する",
}
