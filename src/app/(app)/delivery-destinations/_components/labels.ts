import { DeliveryDestinationStatus } from "@prisma/client"

/**
 * Phase 1A-10: 納品先マスター ラベル定義
 *
 * - shunya-master-patterns.md v1.2 §4 / §8 の命名規約に従う
 * - Buyer と同じパターンで _LABELS / _BADGE_VARIANT / _OPTIONS を定義
 * - 共通モジュール（住所 / 国 / タイムゾーン）は re-export
 */

// =============================================================================
// 共通モジュールからの re-export
// =============================================================================
export { PREFECTURE_OPTIONS, type PrefectureOption } from "@/lib/constants/prefectures"
export { COUNTRY_OPTIONS, type CountryOption } from "@/lib/constants/countries"
export { TIMEZONE_OPTIONS, type TimezoneOption } from "@/lib/constants/timezones"

// =============================================================================
// ステータス
// =============================================================================
export const DELIVERY_DESTINATION_STATUS_LABELS: Record<
  DeliveryDestinationStatus,
  string
> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const DELIVERY_DESTINATION_STATUS_BADGE_VARIANT: Record<
  DeliveryDestinationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const DELIVERY_DESTINATION_STATUS_OPTIONS: {
  value: DeliveryDestinationStatus
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]
