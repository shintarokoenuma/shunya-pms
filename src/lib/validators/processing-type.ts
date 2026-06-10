import { z } from "zod"
import { ProcessingTypeStatus, WorkOrderType } from "@prisma/client"

/**
 * S-3a: 加工種別（ProcessingType）バリデータ
 *
 * 設計方針（master-patterns / Buyer・DeliveryDestination を precedent）:
 * - code（PRC-001 形式）は自動採番。フォーム入力させない＝validator 非対象。
 * - status は 2 値（ACTIVE / ARCHIVED）。
 * - sortOrder は任意・整数・既定 0。
 * ※ enum AiProcessingType（AI処理種別）とは無関係。
 */

const requiredString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}は必須です`)
    .max(max, `${max}文字以内で入力してください`)

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

/** 並び順（任意・整数・既定 0）。number 入力は文字列で来るため union で受ける。 */
const sortOrderField = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === "" || v === undefined) return 0
    return typeof v === "number" ? v : Number(v)
  })
  .refine((v) => Number.isInteger(v), "並び順は整数で入力してください")
  .default(0)

export const processingTypeBaseSchema = z.object({
  // code は自動採番のため含めない
  name: requiredString(255, "名称"),
  // 大分類（発注種別・必須）。WO 起票時にこの値をコピーする。
  workType: z.nativeEnum(WorkOrderType, {
    message: "大分類（発注種別）は必須です",
  }),
  nameEn: optionalString(255),
  description: optionalString(10000),
  sortOrder: sortOrderField,
  status: z.nativeEnum(ProcessingTypeStatus).default(ProcessingTypeStatus.ACTIVE),
})

export type ProcessingTypeFormValues = z.input<typeof processingTypeBaseSchema>
export type ProcessingTypeInput = z.infer<typeof processingTypeBaseSchema>

export const createProcessingTypeSchema = processingTypeBaseSchema
export const updateProcessingTypeSchema = processingTypeBaseSchema

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================
export const listProcessingTypesQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z.nativeEnum(ProcessingTypeStatus).optional(),
  workType: z.nativeEnum(WorkOrderType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListProcessingTypesQuery = z.input<
  typeof listProcessingTypesQuerySchema
>
export type ListProcessingTypesParams = z.infer<
  typeof listProcessingTypesQuerySchema
>
