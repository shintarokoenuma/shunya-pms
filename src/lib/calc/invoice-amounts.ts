import type { TaxClassification, TaxRoundingMode } from "@prisma/client"
import { applyTaxRounding } from "./tax-rounding"

/**
 * B-109 PR-2c: 合計請求書の金額（純関数・ブリーフ §4-4「金額の計算」）。
 * - 消費税は請求書1枚につき税率ごとに1回だけ端数処理する（D-22）。明細ごと・納品書ごとには丸めない。
 * - 端数処理はその時点のクライアントの設定（D-23・D-35）。
 * - 非課税（EXEMPT / NON_TAXABLE / OUT_OF_SCOPE / ZERO_RATED）は税額 0。合計は明細から導出し列に持たない（D-32）。
 * - 当月お買上げ額（subtotal）は非課税の行も含む税抜合計。
 * - totalAmount = 繰越金額 + 当月お買上げ額 + 消費税等（今回御請求額・D-29）。マイナスも許す（D-26）。
 */
export type InvoiceAmountItem = {
  subtotal: number
  taxClassification: TaxClassification
}

export type InvoiceAmounts = {
  taxableAmount10: number
  taxAmount10: number
  taxableAmount8: number
  taxAmount8: number
  nonTaxableAmount: number
  subtotal: number
  totalTaxAmount: number
  previousBalanceAmount: number
  paymentReceivedAmount: number
  carriedForwardAmount: number
  totalAmount: number
}

export const TAX_RATE_PERCENT: Record<TaxClassification, number> = {
  STANDARD_10: 10,
  REDUCED_8: 8,
  EXEMPT: 0,
  NON_TAXABLE: 0,
  OUT_OF_SCOPE: 0,
  ZERO_RATED: 0,
}

function taxOf(taxable: number, ratePercent: number, mode: TaxRoundingMode): number {
  // 整数円 × 税率 の浮動小数の誤差（…9999）で切り捨てが1円ずれないよう、6桁で正規化してから端数処理する
  const raw = Math.round(((taxable * ratePercent) / 100) * 1e6) / 1e6
  return applyTaxRounding(raw, mode)
}

export function computeInvoiceAmounts(
  items: InvoiceAmountItem[],
  mode: TaxRoundingMode,
  previousBalanceAmount: number,
  paymentReceivedAmount: number,
): InvoiceAmounts {
  let taxableAmount10 = 0
  let taxableAmount8 = 0
  let nonTaxableAmount = 0
  for (const it of items) {
    if (it.taxClassification === "STANDARD_10") taxableAmount10 += it.subtotal
    else if (it.taxClassification === "REDUCED_8") taxableAmount8 += it.subtotal
    else nonTaxableAmount += it.subtotal
  }
  const taxAmount10 = taxOf(taxableAmount10, 10, mode)
  const taxAmount8 = taxOf(taxableAmount8, 8, mode)
  const subtotal = taxableAmount10 + taxableAmount8 + nonTaxableAmount
  const totalTaxAmount = taxAmount10 + taxAmount8
  const carriedForwardAmount = previousBalanceAmount - paymentReceivedAmount
  const totalAmount = carriedForwardAmount + subtotal + totalTaxAmount
  return {
    taxableAmount10,
    taxAmount10,
    taxableAmount8,
    taxAmount8,
    nonTaxableAmount,
    subtotal,
    totalTaxAmount,
    previousBalanceAmount,
    paymentReceivedAmount,
    carriedForwardAmount,
    totalAmount,
  }
}
