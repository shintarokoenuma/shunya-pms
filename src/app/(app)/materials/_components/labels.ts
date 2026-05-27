import { MaterialStatus, MaterialType } from "@prisma/client"

/**
 * Phase 1A-13a: 素材マスター ラベル定義
 *
 * - shunya-master-patterns.md v1.2 §4 / §8 の命名規約に従う
 * - MaterialStatus は 4 値（ModelCode と同じ構成、DISCONTINUED は destructive）
 * - MaterialType は 15 値。FABRIC は default（主役）、副資材は secondary や outline で
 *   視覚的にグルーピング
 */

// =============================================================================
// 共通モジュールからの re-export
// =============================================================================
export { CURRENCY_OPTIONS } from "@/lib/constants/currencies"

// =============================================================================
// ステータス
// =============================================================================
export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  ACTIVE: "稼働中",
  INACTIVE: "一時休止",
  DISCONTINUED: "廃番",
  ARCHIVED: "アーカイブ",
}

export const MATERIAL_STATUS_BADGE_VARIANT: Record<
  MaterialStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  INACTIVE: "outline",
  DISCONTINUED: "destructive",
  ARCHIVED: "secondary",
}

export const MATERIAL_STATUS_OPTIONS: {
  value: MaterialStatus
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "INACTIVE", label: "一時休止" },
  { value: "DISCONTINUED", label: "廃番" },
  { value: "ARCHIVED", label: "アーカイブ" },
]

// =============================================================================
// 素材タイプ（15 値）
// =============================================================================
export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  FABRIC: "生地",
  LINING: "裏地",
  INTERLINING: "芯地",
  ZIPPER: "ファスナー",
  BUTTON: "ボタン",
  THREAD: "糸",
  ELASTIC: "ゴム",
  TAPE: "テープ",
  LABEL: "ネーム",
  HANG_TAG: "下げ札",
  CARE_LABEL: "品質表示",
  PACKAGING_BAG: "袋",
  POLYBAG: "ポリ袋",
  BOX: "箱",
  OTHER: "その他",
}

/**
 * バッジの色分け：
 * - default（強調）: FABRIC（主役の生地）
 * - outline（控えめ）: LINING / INTERLINING（生地グループの脇役）
 * - secondary（薄塗り）: 副資材（ZIPPER 〜 BOX、OTHER）
 */
export const MATERIAL_TYPE_BADGE_VARIANT: Record<
  MaterialType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  FABRIC: "default",
  LINING: "outline",
  INTERLINING: "outline",
  ZIPPER: "secondary",
  BUTTON: "secondary",
  THREAD: "secondary",
  ELASTIC: "secondary",
  TAPE: "secondary",
  LABEL: "secondary",
  HANG_TAG: "secondary",
  CARE_LABEL: "secondary",
  PACKAGING_BAG: "secondary",
  POLYBAG: "secondary",
  BOX: "secondary",
  OTHER: "secondary",
}

export const MATERIAL_TYPE_OPTIONS: {
  value: MaterialType
  label: string
}[] = [
  { value: "FABRIC", label: "生地" },
  { value: "LINING", label: "裏地" },
  { value: "INTERLINING", label: "芯地" },
  { value: "ZIPPER", label: "ファスナー" },
  { value: "BUTTON", label: "ボタン" },
  { value: "THREAD", label: "糸" },
  { value: "ELASTIC", label: "ゴム" },
  { value: "TAPE", label: "テープ" },
  { value: "LABEL", label: "ネーム" },
  { value: "HANG_TAG", label: "下げ札" },
  { value: "CARE_LABEL", label: "品質表示" },
  { value: "PACKAGING_BAG", label: "袋" },
  { value: "POLYBAG", label: "ポリ袋" },
  { value: "BOX", label: "箱" },
  { value: "OTHER", label: "その他" },
]
