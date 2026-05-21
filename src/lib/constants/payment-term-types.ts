import { PaymentTermType } from "@prisma/client"

/**
 * 取引条件タイプ（共通モジュール）
 *
 * Client / Supplier / Factory / Contractor で共通使用。
 *
 * Prisma の PaymentTermType enum:
 * - MONTHLY_CLOSING:  月末締め払い
 * - DEPOSIT_COD:      デポジット + COD（着金確認後出荷）
 * - ADVANCE_PAYMENT:  前払い
 * - CASH_ON_DELIVERY: 代引き
 * - LETTER_OF_CREDIT: L/C
 * - CUSTOM:           カスタム条件
 */

export const PAYMENT_TERM_TYPE_OPTIONS: Array<{
  value: PaymentTermType
  label: string
}> = [
  { value: "DEPOSIT_COD", label: "デポジット + COD（推奨）" },
  { value: "MONTHLY_CLOSING", label: "月末締め払い" },
  { value: "ADVANCE_PAYMENT", label: "前払い" },
  { value: "CASH_ON_DELIVERY", label: "代引き" },
  { value: "LETTER_OF_CREDIT", label: "L/C（信用状）" },
  { value: "CUSTOM", label: "カスタム条件" },
]

export const PAYMENT_TERM_TYPE_LABELS: Record<PaymentTermType, string> = {
  MONTHLY_CLOSING: "月末締め払い",
  DEPOSIT_COD: "デポジット + COD",
  ADVANCE_PAYMENT: "前払い",
  CASH_ON_DELIVERY: "代引き",
  LETTER_OF_CREDIT: "L/C",
  CUSTOM: "カスタム条件",
}
