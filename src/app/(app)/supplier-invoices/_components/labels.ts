import type { CounterpartType, SupplierInvoiceMatchSource, SupplierInvoiceMatchStatus, SupplierInvoicePostingType } from "@prisma/client"

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

/** 金額の表示: JPY は ¥・整数、外貨は通貨コード＋小数2桁。外貨には「（円は未確定）」を添える（D-7） */
export function fmtAmount(amount: string | number | null | undefined, currency: string): string {
  if (amount == null || amount === "") return "—"
  const n = typeof amount === "number" ? amount : Number(amount)
  if (!Number.isFinite(n)) return String(amount)
  if (currency === "JPY") {
    const abs = Math.abs(Math.round(n)).toLocaleString("ja-JP")
    return n < 0 ? `−¥${abs}` : `¥${abs}`
  }
  return `${currency} ${n.toLocaleString("ja-JP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtNum(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—"
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n.toLocaleString("ja-JP", { maximumFractionDigits: 4 }) : String(v)
}

export function fmtYmdSlash(s: string | null | undefined): string {
  return s ? s.replace(/-/g, "/") : "—"
}
