import { ProcessingTypeStatus } from "@prisma/client"

/**
 * S-3a: 加工種別（ProcessingType）ラベル定義
 * master-patterns §4 / Buyer・DeliveryDestination のステータス統一色に準拠（2値）。
 */

export const PROCESSING_TYPE_STATUS_LABELS: Record<
  ProcessingTypeStatus,
  string
> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const PROCESSING_TYPE_STATUS_BADGE_VARIANT: Record<
  ProcessingTypeStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}

export const PROCESSING_TYPE_STATUS_OPTIONS: {
  value: ProcessingTypeStatus
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]
