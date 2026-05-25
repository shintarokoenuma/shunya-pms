import { BuyerStatus } from "@prisma/client"

/**
 * Phase 1A-11: バイヤーマスター ラベル定義
 *
 * - shunya-master-patterns.md v1.2 §4 / §8 の命名規約に従う
 *   - _LABELS: バッジ等の表示用 Record
 *   - _OPTIONS: Select 用 Array
 *   - _BADGE_VARIANT: shadcn Badge variant マッピング（§4 ステータスバッジ統一色）
 * - 共通モジュールは re-export（住所 4 分割 UI のため PREFECTURE_OPTIONS / COUNTRY_OPTIONS）
 */

// =============================================================================
// 共通モジュールからの re-export
// =============================================================================
export { PREFECTURE_OPTIONS, type PrefectureOption } from "@/lib/constants/prefectures"
export { COUNTRY_OPTIONS, type CountryOption } from "@/lib/constants/countries"

// =============================================================================
// ステータス
// =============================================================================
export const BUYER_STATUS_LABELS: Record<BuyerStatus, string> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const BUYER_STATUS_BADGE_VARIANT: Record<
  BuyerStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const BUYER_STATUS_OPTIONS: {
  value: BuyerStatus
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]
