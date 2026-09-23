import type { InvoiceAmounts } from "@/lib/calc/invoice-amounts"
import { fmtYen } from "./labels"

/**
 * addendum v0.9 §2-3: 金額の8行（この順・この語）。
 *   前回御請求額 / 御入金額 / 繰越金額 ← 罫線 / 10.0%対象 / 非課税 / 当月お買上げ額 ← 罫線 / 消費税等 / 今回御請求額（太字・上に二重線）
 * - 8%（REDUCED_8）の行は、その税区分の明細があるときだけ出す。
 */
function Row({
  label,
  value,
  className = "",
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-6 py-1 ${className}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${value < 0 ? "text-red-700" : ""}`}>{fmtYen(value)}</span>
    </div>
  )
}

export function InvoiceAmountsBlock({
  amounts,
  showReduced8,
}: {
  amounts: Pick<
    InvoiceAmounts,
    | "previousBalanceAmount"
    | "paymentReceivedAmount"
    | "carriedForwardAmount"
    | "taxableAmount10"
    | "taxableAmount8"
    | "nonTaxableAmount"
    | "subtotal"
    | "totalTaxAmount"
    | "totalAmount"
  >
  showReduced8: boolean
}) {
  return (
    <div className="text-sm">
      <Row label="前回御請求額" value={amounts.previousBalanceAmount} />
      <Row label="御入金額" value={amounts.paymentReceivedAmount} />
      <Row label="繰越金額" value={amounts.carriedForwardAmount} className="border-b" />
      <Row label="10.0%対象" value={amounts.taxableAmount10} />
      {showReduced8 && <Row label="8.0%対象" value={amounts.taxableAmount8} />}
      <Row label="非課税" value={amounts.nonTaxableAmount} />
      <Row label="当月お買上げ額" value={amounts.subtotal} className="border-b" />
      <Row label="消費税等" value={amounts.totalTaxAmount} />
      <div className="mt-1 flex items-center justify-between gap-6 border-t-4 border-double pt-2 text-base font-semibold">
        <span>今回御請求額</span>
        <span className={`tabular-nums ${amounts.totalAmount < 0 ? "text-red-700" : ""}`}>
          {fmtYen(amounts.totalAmount)}
        </span>
      </div>
    </div>
  )
}
