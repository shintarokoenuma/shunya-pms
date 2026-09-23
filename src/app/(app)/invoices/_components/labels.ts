import { InvoiceStatus, PaymentMethod, TaxClassification } from "@prisma/client"

/**
 * B-109 PR-2c: 請求（Invoice）・入金（Payment）のラベル定義。
 * 画面の語は addendum v0.9 §2 のとおり。ラベルは網羅型（Record<enum, string>）で全値を持ち、選択肢だけ絞る。
 */
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "ドラフト",
  PENDING_APPROVAL: "承認待ち",
  APPROVED: "承認済み",
  SENT: "送付済み",
  ACKNOWLEDGED: "先方受領",
  PARTIALLY_PAID: "一部入金",
  PAID: "入金済み",
  OVERDUE: "期限超過",
  CANCELLED: "取消",
  REFUNDED: "返金済み",
  WRITTEN_OFF: "貸倒処理",
}

export const INVOICE_STATUS_BADGE_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  PENDING_APPROVAL: "outline",
  APPROVED: "secondary",
  SENT: "default",
  ACKNOWLEDGED: "secondary",
  PARTIALLY_PAID: "secondary",
  PAID: "secondary",
  OVERDUE: "destructive",
  CANCELLED: "destructive",
  REFUNDED: "secondary",
  WRITTEN_OFF: "secondary",
}

/** D-30: v1 の状態は3つだけ */
export const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "DRAFT", label: "ドラフト" },
  { value: "SENT", label: "送付済み" },
  { value: "CANCELLED", label: "取消" },
]

export const TAX_CLASSIFICATION_LABELS: Record<TaxClassification, string> = {
  STANDARD_10: "10%",
  REDUCED_8: "8%（軽減）",
  EXEMPT: "免税",
  NON_TAXABLE: "非課税",
  OUT_OF_SCOPE: "不課税",
  ZERO_RATED: "ゼロ税率",
}

/** 明細で選べる税区分（v1 は 10% / 非課税・D-32） */
export const INVOICE_ITEM_TAX_OPTIONS: { value: TaxClassification; label: string }[] = [
  { value: "STANDARD_10", label: "10%" },
  { value: "NON_TAXABLE", label: "非課税" },
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "銀行振込",
  WIRE_TRANSFER_TT: "T/T送金",
  LETTER_OF_CREDIT: "L/C",
  CASH: "現金",
  CREDIT_CARD: "クレジットカード",
  CHECK: "小切手",
  PAYPAL: "PayPal",
  WISE: "Wise",
  OTHER: "その他",
}

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "BANK_TRANSFER", label: "銀行振込" },
  { value: "CASH", label: "現金" },
  { value: "CREDIT_CARD", label: "クレジットカード" },
  { value: "CHECK", label: "小切手" },
  { value: "OTHER", label: "その他" },
]

/** ¥1,234 / マイナスは −¥1,234 */
export function fmtYen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—"
  const abs = Math.abs(n).toLocaleString("ja-JP")
  return n < 0 ? `−¥${abs}` : `¥${abs}`
}

/** yyyy-MM-dd → yyyy/MM/dd */
export function fmtYmd(s: string | null | undefined): string {
  if (!s) return "—"
  return s.replace(/-/g, "/")
}
