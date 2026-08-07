import { DeliveryNoteStatus } from "@prisma/client"

/**
 * B-108 §8: 納品書（DeliveryNote）ラベル定義。
 * enum は9値あるが、v1 の UI が扱うのは DRAFT / SHIPPED / DELIVERED / CANCELLED の4値のみ。
 * ラベルは網羅型で全9値を持つ（鉄則: Record<enum, string>）。選択肢だけ4値に絞る。
 */
export const DELIVERY_NOTE_STATUS_LABELS: Record<DeliveryNoteStatus, string> = {
  DRAFT: "ドラフト",
  PENDING_APPROVAL: "承認待ち",
  APPROVED: "承認済み",
  SHIPPED: "出荷済み",
  IN_TRANSIT: "配送中",
  DELIVERED: "納品完了",
  RECEIVED: "受領確認済み",
  RETURNED: "返品",
  CANCELLED: "キャンセル",
}

export const DELIVERY_NOTE_STATUS_BADGE_VARIANT: Record<
  DeliveryNoteStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  PENDING_APPROVAL: "outline",
  APPROVED: "default",
  SHIPPED: "default",
  IN_TRANSIT: "default",
  DELIVERED: "secondary",
  RECEIVED: "secondary",
  RETURNED: "destructive",
  CANCELLED: "destructive",
}

/** §8: v1 の UI で選べる4値のみ。 */
export const DELIVERY_NOTE_STATUS_OPTIONS: {
  value: DeliveryNoteStatus
  label: string
}[] = [
  { value: "DRAFT", label: "ドラフト" },
  { value: "SHIPPED", label: "出荷済み" },
  { value: "DELIVERED", label: "納品完了" },
  { value: "CANCELLED", label: "キャンセル" },
]
