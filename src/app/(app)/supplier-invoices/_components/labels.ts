import type { CounterpartType, SupplierInvoiceMatchSource, SupplierInvoiceMatchStatus, SupplierInvoicePostingType } from "@prisma/client"
import { formatMoney, formatQuantity } from "@/lib/supplier-invoice/format"

/** B-212 PR-1: 仕入請求書の画面の語 */
export const POSTING_TYPE_LABELS: Record<SupplierInvoicePostingType, string> = {
  COUNTED: "計上",
  REFERENCE: "参照",
}

export const MATCH_STATUS_LABELS: Record<SupplierInvoiceMatchStatus, string> = {
  MATCHED: "一致",
  RULE_PENDING: "要確認",
  UNMATCHED: "未一致",
  NO_PRODUCT: "品番なし",
}

export const MATCH_SOURCE_LABELS: Record<SupplierInvoiceMatchSource, string> = {
  CLIENT_PRODUCT_CODE: "先方品番",
  PRODUCT_CODE: "社内品番",
  PATTERN_NUMBER: "パターンナンバー",
  RULE: "覚えた対応",
  MANUAL: "人が選択",
}

/** 当て方の札: 「自動一致：先方品番」「要確認：覚えた対応」「未一致」「品番なし」 */
export function matchBadgeLabel(status: SupplierInvoiceMatchStatus, source: SupplierInvoiceMatchSource | null): string {
  if (status === "MATCHED") return source === "MANUAL" ? "一致：人が選択" : source === "RULE" ? "一致：覚えた対応（確認済み）" : `自動一致：${source ? MATCH_SOURCE_LABELS[source] : ""}`
  if (status === "RULE_PENDING") return "要確認：覚えた対応"
  return MATCH_STATUS_LABELS[status]
}

export const MATCH_BADGE_VARIANT: Record<SupplierInvoiceMatchStatus, "default" | "secondary" | "destructive" | "outline"> = {
  MATCHED: "secondary",
  RULE_PENDING: "default",
  UNMATCHED: "destructive",
  NO_PRODUCT: "outline",
}

export const COUNTERPART_TYPE_LABELS: Record<Extract<CounterpartType, "SUPPLIER" | "FACTORY" | "CONTRACTOR" | "OTHER">, string> = {
  SUPPLIER: "仕入先",
  FACTORY: "工場",
  CONTRACTOR: "外注先",
  OTHER: "相手先なし",
}

/**
 * 金額（金額税抜・単価・書類の税抜／消費税／税込）の表示: JPY は ¥＋小数なし、外貨は通貨コード＋小数 2 桁（FIX-1）。
 * 文字列のまま整形する（Decimal を Number にしない）。確認画面・一覧・詳細で同じものを使う。外貨には画面側で「（円は未確定）」を添える（D-7）
 */
export function fmtAmount(amount: string | null | undefined, currency: string): string {
  return formatMoney(amount, currency)
}

/** 数量の表示: 末尾の 0 を落として 3 桁区切り（文字列のまま） */
export function fmtNum(v: string | null | undefined): string {
  return formatQuantity(v)
}

export function fmtYmdSlash(s: string | null | undefined): string {
  return s ? s.replace(/-/g, "/") : "—"
}
