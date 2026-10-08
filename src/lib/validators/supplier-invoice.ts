import { z } from "zod"

/**
 * B-212 PR-1（P1-D6〜P1-D8）: 仕入先・工場の請求書のバリデータ。
 * - 取り込みは CSV の文字（csvText）をそのまま受け、サーバで読み直して検証する（画面の検証に頼らない）。
 *   画面で人が直した内容は「書類の鍵（key）＋行番号」で指す choices として受ける
 * - 金額・日付など読み取った値は直せない（直すときは取消して取り込み直す・B-225 と同じ考え方）
 */

export const COUNTERPART_TYPE_VALUES = ["SUPPLIER", "FACTORY", "CONTRACTOR", "OTHER"] as const
const counterpartType = z.enum(COUNTERPART_TYPE_VALUES)
const optionalId = z.string().nullable().default(null).transform((v) => (v === "" ? null : v))

export const supplierInvoiceCsvPreviewSchema = z.object({
  csvText: z.string().min(1, "CSV が空です"),
  fileName: z.string().max(255).default(""),
})
export type SupplierInvoiceCsvPreviewInput = z.infer<typeof supplierInvoiceCsvPreviewSchema>

export const supplierInvoiceLineChoiceSchema = z.object({
  lineNo: z.number().int(),
  /** 人が選んだ品番（null なら選んでいない） */
  productId: optionalId,
  /** 「品番なし」にした */
  noProduct: z.boolean().default(false),
  costCategoryId: optionalId,
  /** 覚えた対応で当てた行を人が「確認済み」にした */
  confirmed: z.boolean().default(false),
})

export const supplierInvoiceDocumentChoiceSchema = z.object({
  key: z.string().min(1),
  /** 取り込まない（重複など） */
  skip: z.boolean().default(false),
  counterpartType: counterpartType.optional(),
  counterpartId: optionalId,
  /** 人が相手先を選び直した（覚えた対応を作る） */
  counterpartChosen: z.boolean().default(false),
  /** 覚えた対応で当てた相手先を人が確認した */
  counterpartConfirmed: z.boolean().default(false),
  lines: z.array(supplierInvoiceLineChoiceSchema).default([]),
})

export const supplierInvoiceImportSchema = z.object({
  csvText: z.string().min(1, "CSV が空です"),
  fileName: z.string().max(255).default(""),
  documents: z.array(supplierInvoiceDocumentChoiceSchema).default([]),
})
export type SupplierInvoiceImportInput = z.infer<typeof supplierInvoiceImportSchema>
export type SupplierInvoiceDocumentChoice = z.infer<typeof supplierInvoiceDocumentChoiceSchema>
export type SupplierInvoiceLineChoice = z.infer<typeof supplierInvoiceLineChoiceSchema>

export const supplierInvoiceLineUpdateSchema = z.object({
  lineId: z.string().min(1),
  productId: optionalId,
  noProduct: z.boolean().default(false),
  costCategoryId: optionalId,
})
export type SupplierInvoiceLineUpdateInput = z.infer<typeof supplierInvoiceLineUpdateSchema>

export const supplierInvoiceCounterpartUpdateSchema = z.object({
  id: z.string().min(1),
  counterpartType,
  counterpartId: optionalId,
})
export type SupplierInvoiceCounterpartUpdateInput = z.infer<typeof supplierInvoiceCounterpartUpdateSchema>

export const supplierInvoiceConfirmSchema = z.object({
  id: z.string().min(1),
  /** 省略すれば書類の中の要確認の行すべて */
  lineIds: z.array(z.string().min(1)).optional(),
})
export type SupplierInvoiceConfirmInput = z.infer<typeof supplierInvoiceConfirmSchema>

/** 取消（論理削除）。理由は必須（1〜200文字）。金額・日付は受けない（取消＋取り込み直し） */
export const supplierInvoiceCancelSchema = z.object({
  id: z.string().min(1, "書類が指定されていません"),
  reason: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length >= 1, "取消の理由を入力してください")
    .refine((v) => v.length <= 200, "取消の理由は200文字以内で入力してください"),
})
export type SupplierInvoiceCancelInput = z.infer<typeof supplierInvoiceCancelSchema>
