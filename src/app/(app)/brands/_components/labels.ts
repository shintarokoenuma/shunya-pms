import { BrandStatus } from "@prisma/client"

export const BRAND_STATUS_LABEL: Record<BrandStatus, string> = {
  ACTIVE: "稼働中",
  PAUSED: "休止中",
  ARCHIVED: "アーカイブ",
}

export const BRAND_STATUS_BADGE_VARIANT: Record<BrandStatus, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "outline",
  ARCHIVED: "secondary",
}
