import { z } from "zod"

/**
 * Phase 1A-13d: 柄種別マスター（TextilePatternType）バリデータ
 *
 * 設計方針（spec v0.2 2026-06-01 / PR-2 ブリーフ）:
 * - typeCode は英大文字・数字・アンダースコアの 1〜10 文字、`@@unique([companyId, typeCode])`
 * - status は VarChar(20)（schema 確定）。Color / MaterialCategory と同じく enum 化しない
 * - sortOrder は任意（フォーム未指定時は actions 層で末尾＝既存最大 + 10 を補完）
 * - 純カテゴリマスターのため、superRefine による条件付き分岐は不要
 */

// =============================================================================
// 共通ヘルパー
// =============================================================================
const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

export const TEXTILE_PATTERN_TYPE_STATUS_VALUES = [
  "ACTIVE",
  "ARCHIVED",
] as const
export type TextilePatternTypeStatusValue =
  (typeof TEXTILE_PATTERN_TYPE_STATUS_VALUES)[number]

const TYPE_CODE_PATTERN = /^[A-Z0-9_]{1,10}$/

// =============================================================================
// 柄種別本体スキーマ
// =============================================================================
export const textilePatternTypeInputSchema = z.object({
  typeCode: z
    .string()
    .trim()
    .min(1, "柄種別コードは必須です")
    .max(10, "10文字以内で入力してください")
    .regex(
      TYPE_CODE_PATTERN,
      "英大文字・数字・アンダースコアのみ使用できます",
    ),
  typeName: z
    .string()
    .trim()
    .min(1, "柄種別名は必須です")
    .max(100, "100文字以内で入力してください"),
  description: optionalString(500),
  // sortOrder は任意 (空欄を許可)。actions 層で末尾採番にフォールバックする
  sortOrder: z
    .union([z.string(), z.number(), z.null()])
    .transform((v) => {
      if (v === "" || v === null || v === undefined) return null
      const n = typeof v === "number" ? v : Number(v)
      return Number.isFinite(n) ? Math.trunc(n) : null
    })
    .refine((v) => v === null || v >= 0, "0以上の整数で入力してください")
    .nullable()
    .default(null),
  status: z
    .enum(TEXTILE_PATTERN_TYPE_STATUS_VALUES)
    .default("ACTIVE"),
})

export type TextilePatternTypeFormValues = z.input<
  typeof textilePatternTypeInputSchema
>
export type TextilePatternTypeInput = z.infer<
  typeof textilePatternTypeInputSchema
>

// =============================================================================
// 一覧検索パラメータ
// =============================================================================
export const textilePatternTypeListParamsSchema = z.object({
  q: z.string().optional().default(""),
  status: z.enum(TEXTILE_PATTERN_TYPE_STATUS_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type TextilePatternTypeListParams = z.infer<
  typeof textilePatternTypeListParamsSchema
>
