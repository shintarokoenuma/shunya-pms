import type { Badge } from "@/components/ui/badge"
import type { ComponentProps } from "react"
import {
  SalesOrderStatus,
  OrderSourceType,
  SkuMoqStatus,
} from "@prisma/client"

type BadgeVariant = ComponentProps<typeof Badge>["variant"]

// =============================================================================
// SalesOrderStatus（受注 spec v1.0 §0/R-6 により意味を割り当て直した文言）
// =============================================================================
export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  TENTATIVE: "入力途中",
  CONFIRMED: "確定受注",
  IN_PRODUCTION: "量産中",
  PARTIAL_DELIVERED: "一部納品",
  DELIVERED: "全納品",
  COMPLETED: "完了",
  CANCELLED: "キャンセル",
  ON_HOLD: "保留",
}

export const SALES_ORDER_STATUS_BADGE_VARIANT: Record<
  SalesOrderStatus,
  BadgeVariant
> = {
  TENTATIVE: "outline",
  CONFIRMED: "default",
  IN_PRODUCTION: "secondary",
  PARTIAL_DELIVERED: "secondary",
  DELIVERED: "secondary",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  ON_HOLD: "outline",
}

export const SALES_ORDER_STATUS_OPTIONS: { value: SalesOrderStatus; label: string }[] =
  (Object.keys(SALES_ORDER_STATUS_LABELS) as SalesOrderStatus[]).map((v) => ({
    value: v,
    label: SALES_ORDER_STATUS_LABELS[v],
  }))

// =============================================================================
// OrderSourceType（受注ソース・11値）
// =============================================================================
export const ORDER_SOURCE_TYPE_LABELS: Record<OrderSourceType, string> = {
  ORDER_PAGE: "オーダーページ",
  SAAGARA_V2: "saagara V2",
  EMAIL: "メール",
  PDF_DOCUMENT: "PDF",
  EXCEL_FILE: "Excel",
  PAPER_DOCUMENT: "紙（スキャン）",
  PHONE: "電話",
  CHAT: "チャット",
  EXHIBITION: "展示会",
  DIRECT_VISIT: "直接来社",
  OTHER: "その他",
}

export const ORDER_SOURCE_TYPE_OPTIONS: { value: OrderSourceType; label: string }[] =
  (Object.keys(ORDER_SOURCE_TYPE_LABELS) as OrderSourceType[]).map((v) => ({
    value: v,
    label: ORDER_SOURCE_TYPE_LABELS[v],
  }))

// =============================================================================
// SkuMoqStatus（SKU 別 MOQ 判定・7値・人が選ぶだけ）
// =============================================================================
export const SKU_MOQ_STATUS_LABELS: Record<SkuMoqStatus, string> = {
  NOT_DETERMINED: "未判定",
  MEETS_MOQ: "MOQ達成",
  BELOW_MOQ_PRODUCE: "MOQ未達・増産で生産",
  BELOW_MOQ_PRICE_UP: "MOQ未達・単価UPで生産",
  EXCLUDED: "量産から除外",
  NO_ORDERS: "受注なし",
  PENDING_DECISION: "相談中",
}

export const SKU_MOQ_STATUS_OPTIONS: { value: SkuMoqStatus; label: string }[] = (
  Object.keys(SKU_MOQ_STATUS_LABELS) as SkuMoqStatus[]
).map((v) => ({ value: v, label: SKU_MOQ_STATUS_LABELS[v] }))
