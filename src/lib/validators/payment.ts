import { z } from "zod"
import { PaymentMethod } from "@prisma/client"

/**
 * B-109 PR-2c: クライアント単位の入金（Payment・D-25）バリデータ。
 * 設計: ブリーフ §4-5 / addendum v0.9 §2-4
 * - 入れるのは 入金日・金額・方法・摘要 の4つだけ。
 * - paymentNumber は自動採番（PAY-{年}-{4桁}）。validator 非対象。
 * - 請求書への紐付け（relatedInvoiceIds / InvoicePayment）はしない。
 */

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "入金日は yyyy-MM-dd で入力してください")

/** v1 の UI で選べる方法。ラベルは enum 全値を持つ（labels.ts）。 */
export const PAYMENT_METHOD_UI_VALUES: PaymentMethod[] = [
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CASH,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.CHECK,
  PaymentMethod.OTHER,
]

export const clientPaymentCreateSchema = z.object({
  clientId: z.string().min(1, "クライアントが指定されていません"),
  paymentDate: ymd,
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number(v)))
    .refine(
      (v) => Number.isInteger(v) && v > 0,
      "金額は1円以上の整数で入力してください",
    ),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  description: z
    .string()
    .max(1000, "1000文字以内で入力してください")
    .nullable()
    .default(null)
    .transform((v) => (v === "" || v === null ? null : v.trim() || null)),
})

export type ClientPaymentCreateInput = z.infer<typeof clientPaymentCreateSchema>

/** B-225（D-2）: 入金の取消。理由は必須（1〜200文字）。金額・日付は受けない（取消＋再入力・D-1）。 */
export const clientPaymentCancelSchema = z.object({
  id: z.string().min(1, "入金が指定されていません"),
  reason: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length >= 1, "取消の理由を入力してください")
    .refine((v) => v.length <= 200, "取消の理由は200文字以内で入力してください"),
})

export type ClientPaymentCancelInput = z.infer<typeof clientPaymentCancelSchema>
