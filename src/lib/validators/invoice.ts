import { z } from "zod"
import { InvoiceStatus, TaxClassification } from "@prisma/client"

/**
 * B-109 PR-2c: 合計請求書（Invoice / InvoiceItem）バリデータ。
 * 設計: docs/specs/b-109-pr2-implementation-brief-2026-09-23.md §4-4 / addendum v0.9 §2-2
 * - invoiceNumber は自動採番（INV-{年}-{4桁}・保存時確定）。validator 非対象。
 * - 明細は納品書明細（deliveryNoteItemId）の選択だけを受け、金額はサーバで納品書から写す。
 * - 税区分は行ごと（既定 STANDARD_10・非課税は NON_TAXABLE・D-32）。
 * - 前回御請求額は「直前の請求書が無いときだけ」使う（あればサーバが直前の今回御請求額で上書き）。
 */

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付は yyyy-MM-dd で入力してください")

const optionalString = (max: number) =>
  z
    .string()
    .max(max, `${max}文字以内で入力してください`)
    .nullable()
    .default(null)
    .transform((v) => (v === "" || v === null ? null : v))

const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" ? null : v))

/** 明細で選べる税区分（v1）。8% は器として受けるが UI は 10% / 非課税 の2つ。 */
export const INVOICE_ITEM_TAX_CLASSIFICATIONS = [
  TaxClassification.STANDARD_10,
  TaxClassification.REDUCED_8,
  TaxClassification.NON_TAXABLE,
] as const

export const invoiceItemPickSchema = z.object({
  deliveryNoteItemId: z.string().min(1),
  taxClassification: z
    .enum(INVOICE_ITEM_TAX_CLASSIFICATIONS)
    .default(TaxClassification.STANDARD_10),
})

/** 前回御請求額（任意・整数円・マイナス可。空/null → null＝0 扱い） */
const balanceField = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : NaN
  })
  .refine((v) => v === null || Number.isInteger(v), "前回御請求額は整数で入力してください")
  .nullable()
  .default(null)

export const invoiceCreateSchema = z
  .object({
    clientId: z.string().min(1, "クライアントを選択してください"),
    periodStart: ymd,
    periodEnd: ymd,
    paymentDueDate: ymd,
    previousBalanceAmount: balanceField,
    /** 再発行の元（取消した請求書の id）。無ければ null */
    replacesInvoiceId: optionalRelationId,
    internalNotes: optionalString(10000),
    /** 当月お買上げ額が 0 でも繰越があれば作れるため 0 件を許す */
    items: z.array(invoiceItemPickSchema).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.periodStart > v.periodEnd) {
      ctx.addIssue({
        code: "custom",
        message: "期間の始まりは終わりより前の日付にしてください",
        path: ["periodStart"],
      })
    }
    const ids = v.items.map((i) => i.deliveryNoteItemId)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "同じ明細が重複しています",
        path: ["items"],
      })
    }
  })

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>

export const invoiceCandidateQuerySchema = z
  .object({
    clientId: z.string().min(1, "クライアントを選択してください"),
    periodStart: ymd,
    periodEnd: ymd,
  })
  .refine((v) => v.periodStart <= v.periodEnd, {
    message: "期間の始まりは終わりより前の日付にしてください",
    path: ["periodStart"],
  })

export type InvoiceCandidateQuery = z.infer<typeof invoiceCandidateQuerySchema>

export const invoiceListParamsSchema = z.object({
  q: z.string().default(""),
  status: z.nativeEnum(InvoiceStatus).optional(),
  clientId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export type InvoiceListParams = z.infer<typeof invoiceListParamsSchema>

/** D-30: v1 の状態は3値。enum は変えない。 */
export const INVOICE_STATUS_UI_VALUES: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.CANCELLED,
]

/** 状態遷移（DRAFT → SENT / CANCELLED、SENT → CANCELLED）。SENT 以降は書き換えない。 */
export const INVOICE_STATUS_TRANSITIONS: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
  DRAFT: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
  SENT: [InvoiceStatus.CANCELLED],
}
