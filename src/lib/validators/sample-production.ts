import { z } from "zod"
import { SampleProductionStatus, SampleRound } from "@prisma/client"

/**
 * S-2: サンプル製作セット（SampleProduction）バリデータ
 *
 * 設計方針（仕様議事録 v1.0 2026-06-06 §5）:
 * - SP番号（sampleNumber）は自動採番（`SP-{西暦4桁}-{連番4桁}`）。validator 非対象。
 * - roundOrder / sampleRound も自動決定（parentSampleId の有無＋親の roundOrder から）。validator 非対象。
 * - status は新規=PLANNING 固定。遷移は changeSampleStatus（フォームでは扱わない）。
 * - parentSampleId は「修正サンプル作成」導線から内部的に渡る（通常フォームの可視項目ではない）。
 * - product リレーション宣言が schema に無いため、productId は文字列 FK として扱う（join は actions 層）。
 */

// =============================================================================
// 共通バリデーション
// =============================================================================
const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

/** 任意の関連 ID（"" は null 化）。User / 親SP 等の FK 用 */
const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" ? null : v))

/** 任意の日付文字列（"" は null）。Date への変換は actions 層で行う */
const optionalDateString = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" || v === null ? null : v))

/**
 * 製作数（任意・空可）。サンプル時点では枚数未定のことがあるため空欄を許す。
 * - 空文字 "" / null / undefined → null（既定 1 はここでは入れず actions/DB の @default に委ねる）
 * - 値が入っている場合のみ「1以上の整数」を検証
 * 型は number | null。
 */
const sampleQuantityField = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === "" || v === undefined) return null
    return typeof v === "number" ? v : Number(v)
  })
  .refine(
    (v) => v === null || (Number.isInteger(v) && v >= 1),
    "製作数は1以上の整数で入力してください（未定なら空欄可）",
  )
  .nullable()
  .default(null)

// =============================================================================
// 採番フォーマット（参照用）
// =============================================================================
/** `SP-{西暦4桁}-{連番4桁}` 形式 */
export const SAMPLE_NUMBER_FORMAT_HINT = "SP-{西暦}-{連番4桁}"

// =============================================================================
// 本体スキーマ（編集可能フィールドのみ）
// =============================================================================
export const sampleProductionBaseSchema = z.object({
  // 対象品番（必須・immutable：更新では変更しない）
  productId: z.string().min(1, "対象品番は必須です"),
  // 修正系譜の親（「修正サンプル作成」導線から内部的に渡る。通常は null）
  parentSampleId: optionalRelationId,

  // 基本情報
  title: optionalString(255),
  description: optionalString(10000),
  sampleQuantity: sampleQuantityField,

  // 予定日
  plannedStartDate: optionalDateString,
  plannedCompletionDate: optionalDateString,

  // 担当者
  assignedToUserId: optionalRelationId,

  // メモ
  internalNotes: optionalString(10000),
})

export type SampleProductionFormValues = z.input<
  typeof sampleProductionBaseSchema
>
export type SampleProductionInput = z.infer<typeof sampleProductionBaseSchema>

export const createSampleProductionSchema = sampleProductionBaseSchema
export const updateSampleProductionSchema = sampleProductionBaseSchema

// =============================================================================
// status 遷移用スキーマ
// =============================================================================
export const changeSampleStatusSchema = z.object({
  status: z.nativeEnum(SampleProductionStatus),
})
export type ChangeSampleStatusInput = z.infer<typeof changeSampleStatusSchema>

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================
export const listSampleProductionsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  productId: z.string().optional(),
  status: z.nativeEnum(SampleProductionStatus).optional(),
  sampleRound: z.nativeEnum(SampleRound).optional(),
  assignedToUserId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListSampleProductionsQuery = z.input<
  typeof listSampleProductionsQuerySchema
>
export type ListSampleProductionsParams = z.infer<
  typeof listSampleProductionsQuerySchema
>
