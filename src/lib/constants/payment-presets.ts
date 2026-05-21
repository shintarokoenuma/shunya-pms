/**
 * 取引条件プリセット（共通モジュール）
 *
 * Phase 1A-3-extra で確定した4種類のプリセット。
 * Client / Supplier / Factory / Contractor で共通使用。
 *
 * paymentMonthOffset: 1=翌月、2=翌々月
 * paymentDay: 1-31、31=月末
 * closingDay: 1-31、31=月末
 */

export type PaymentPreset = {
  label: string
  closingDay: number
  paymentMonthOffset: number
  paymentDay: number
}

export const PAYMENT_PRESETS: PaymentPreset[] = [
  { label: "月末締翌月末払", closingDay: 31, paymentMonthOffset: 1, paymentDay: 31 },
  { label: "月末締翌々月末払", closingDay: 31, paymentMonthOffset: 2, paymentDay: 31 },
  { label: "20日締翌月末払", closingDay: 20, paymentMonthOffset: 1, paymentDay: 31 },
  { label: "20日締翌月10日払", closingDay: 20, paymentMonthOffset: 1, paymentDay: 10 },
]
