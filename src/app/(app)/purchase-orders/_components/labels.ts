import { PurchaseOrderStatus, BillingClassification } from "@prisma/client"

/**
 * S-4b-1: 仕入先発注（PO）ラベル定義
 */

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "ドラフト",
  PENDING_APPROVAL: "承認待ち",
  APPROVED: "承認済み",
  SENT: "送付済み",
  ACKNOWLEDGED: "仕入先確認済み",
  IN_PRODUCTION: "生産中",
  SHIPPED: "出荷済み",
  RECEIVED: "検収済み",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
  ON_HOLD: "保留",
}

export const PURCHASE_ORDER_STATUS_BADGE_VARIANT: Record<
  PurchaseOrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  PENDING_APPROVAL: "outline",
  APPROVED: "default",
  SENT: "default",
  ACKNOWLEDGED: "default",
  IN_PRODUCTION: "default",
  SHIPPED: "default",
  RECEIVED: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  ON_HOLD: "outline",
}

export const PURCHASE_ORDER_STATUS_OPTIONS: {
  value: PurchaseOrderStatus
  label: string
}[] = (Object.keys(PURCHASE_ORDER_STATUS_LABELS) as PurchaseOrderStatus[]).map(
  (value) => ({ value, label: PURCHASE_ORDER_STATUS_LABELS[value] }),
)

export const BILLING_CLASSIFICATION_LABELS: Record<
  BillingClassification,
  string
> = {
  INDIVIDUAL_BILLING: "個別売り立て",
  UNIT_PRICE_INCLUDED: "製品単価インクルード",
}

export const BILLING_CLASSIFICATION_OPTIONS: {
  value: BillingClassification
  label: string
}[] = [
  { value: "INDIVIDUAL_BILLING", label: "個別売り立て" },
  { value: "UNIT_PRICE_INCLUDED", label: "製品単価インクルード" },
]
