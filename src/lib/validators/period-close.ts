import { z } from "zod"

/**
 * B-109 PR-6（B-123）: 締め（PeriodClose）のバリデータ。
 * - 取引先の種類は CounterpartType のうち CLIENT / SUPPLIER / FACTORY / CONTRACTOR だけ（P6-D2）。
 * - 月は "YYYY-MM"。期間はサーバで取引先の closingDay から出す（P6-D4）。
 * - 解除の理由は必須（空白だけも不可・P6-D9）。
 */
export const PERIOD_CLOSE_COUNTERPART_VALUES = ["CLIENT", "SUPPLIER", "FACTORY", "CONTRACTOR"] as const

const counterpartType = z.enum(PERIOD_CLOSE_COUNTERPART_VALUES)

const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "月は YYYY-MM で指定してください")

/** 一覧の状態の絞り込み（すべて＝省略） */
export const PERIOD_CLOSE_STATE_VALUES = ["open", "closed", "reopened"] as const
export type PeriodCloseState = (typeof PERIOD_CLOSE_STATE_VALUES)[number]

export const periodCloseListSchema = z.object({
  month: yearMonth,
  counterpartType,
  state: z.enum(PERIOD_CLOSE_STATE_VALUES).optional(),
})
export type PeriodCloseListInput = z.infer<typeof periodCloseListSchema>

export const closePeriodSchema = z.object({
  counterpartType,
  counterpartId: z.string().min(1, "取引先が指定されていません"),
  month: yearMonth,
})
export type ClosePeriodInput = z.infer<typeof closePeriodSchema>

export const reopenPeriodSchema = z.object({
  id: z.string().min(1, "締めの記録が指定されていません"),
  reason: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length >= 1, "解除の理由を入力してください")
    .refine((v) => v.length <= 500, "解除の理由は500文字以内で入力してください"),
})
export type ReopenPeriodInput = z.infer<typeof reopenPeriodSchema>
