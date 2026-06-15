import type { ProductColorwayStatusValue } from "@/lib/validators/product-colorway"

/** B-062 β: 製品カラーウェイ ステータスラベル（colors の labels.ts に倣う）。 */
export const PRODUCT_COLORWAY_STATUS_LABELS: Record<
  ProductColorwayStatusValue,
  string
> = {
  ACTIVE: "稼働中",
  ARCHIVED: "アーカイブ",
}

export const PRODUCT_COLORWAY_STATUS_BADGE_VARIANT: Record<
  ProductColorwayStatusValue,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  ARCHIVED: "secondary",
}
