import { z } from "zod"

/**
 * Phase 1A-13c: 色マスター（Color）バリデータ
 *
 * 設計方針（spec 2026-06-01 v1.0 / PR-2 ブリーフ）:
 * - colorNumber は 2 桁数字「00」〜「99」。`@@unique([companyId, colorNumber])`
 * - "00" は「カラー未定（マルチ/プリント）」専用予約値。cmyk/hex は空文字を許可
 * - "00" 以外は cmyk が "C.M.Y.K"（各 0-100）形式、hex が "#RRGGBB" を必須
 * - hueGroup / toneStep / sortOrder はフォーム入力させず、actions 層で
 *   colorNumber から自動算出する（hueGroup=parseInt(n[0]), toneStep=parseInt(n[1]),
 *   sortOrder=parseInt(n)）。validator では受け取らない
 * - status は VarChar(20)（schema 確定）。MaterialCategory のような enum 化はしない
 */

// =============================================================================
// 共通ヘルパー
// =============================================================================
const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

const CMYK_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/
const COLOR_NUMBER_PATTERN = /^\d{2}$/
const COLOR_NUMBER_UNDEFINED = "00"

export const COLOR_STATUS_VALUES = ["ACTIVE", "ARCHIVED"] as const
export type ColorStatusValue = (typeof COLOR_STATUS_VALUES)[number]

// =============================================================================
// 色本体スキーマ
// =============================================================================
export const colorInputSchema = z
  .object({
    colorNumber: z
      .string()
      .trim()
      .min(1, "色番号は必須です")
      .regex(COLOR_NUMBER_PATTERN, "色番号は 2 桁の数字（00〜99）で入力してください"),
    colorName: z
      .string()
      .trim()
      .min(1, "色名は必須です")
      .max(100, "100文字以内で入力してください"),
    colorNameEn: optionalString(100), // 輸出下げ札・貿易書類向け（任意・空可→create/update で空は null 化）
    cmyk: z.string().trim().max(20, "20文字以内で入力してください").default(""),
    hex: z.string().trim().max(7, "7文字以内で入力してください").default(""),
    impression: optionalString(100),
    status: z.enum(COLOR_STATUS_VALUES).default("ACTIVE"),
  })
  .superRefine((data, ctx) => {
    const isUndefinedColor = data.colorNumber === COLOR_NUMBER_UNDEFINED

    // cmyk: "00" 以外は形式必須、各成分 0-100
    if (isUndefinedColor) {
      // 「00」は空文字も値ありも許可（空でも DB の NOT NULL は満たす）
    } else {
      if (data.cmyk === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CMYK は必須です（C.M.Y.K 形式、各 0〜100）",
          path: ["cmyk"],
        })
      } else if (!CMYK_PATTERN.test(data.cmyk)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CMYK の形式が不正です（例: 100.85.0.40、各 0〜100）",
          path: ["cmyk"],
        })
      } else {
        const parts = data.cmyk.split(".").map((s) => Number(s))
        if (parts.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "CMYK の各値は 0 以上 100 以下で入力してください",
            path: ["cmyk"],
          })
        }
      }
    }

    // hex: "00" 以外は #RRGGBB 必須
    if (isUndefinedColor) {
      // 空文字も値ありも許可
    } else {
      if (data.hex === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "HEX は必須です（#RRGGBB 形式）",
          path: ["hex"],
        })
      } else if (!HEX_PATTERN.test(data.hex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "HEX の形式が不正です（例: #001799）",
          path: ["hex"],
        })
      }
    }
  })

export type ColorFormValues = z.input<typeof colorInputSchema>
export type ColorInput = z.infer<typeof colorInputSchema>

// =============================================================================
// 一覧検索パラメータ
// =============================================================================
export const colorListParamsSchema = z.object({
  q: z.string().optional().default(""),
  status: z.enum(COLOR_STATUS_VALUES).optional(),
  hueGroup: z.coerce.number().int().min(0).max(9).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ColorListParams = z.infer<typeof colorListParamsSchema>

// =============================================================================
// colorNumber → hueGroup / toneStep / sortOrder の算出（actions 層から使う）
// =============================================================================
export function deriveColorIndices(colorNumber: string): {
  hueGroup: number
  toneStep: number
  sortOrder: number
} {
  if (!COLOR_NUMBER_PATTERN.test(colorNumber)) {
    throw new Error(`Invalid colorNumber "${colorNumber}" — must be 2-digit numeric`)
  }
  return {
    hueGroup: parseInt(colorNumber[0], 10),
    toneStep: parseInt(colorNumber[1], 10),
    sortOrder: parseInt(colorNumber, 10),
  }
}

export const COLOR_NUMBER_UNDEFINED_VALUE = COLOR_NUMBER_UNDEFINED
