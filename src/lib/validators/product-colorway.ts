import { z } from "zod"

/**
 * B-062 β: 製品カラーウェイ（ProductColorway）バリデータ。
 * 仕様: docs/specs/product-overview-one-page-spec-confirmation-v0_4-2026-06-15.md §2
 * - color.ts / colors.ts の流儀に合わせる（status は VarChar(20) 文字列・enum 化しない）。
 * - colorwayCode は品番内ユニーク（@@unique([productId, colorwayCode]) は actions 層で重複チェック）。
 * - colorId は B-063 で追加（Color マスターへの緩い参照・任意・null 可。00 カラー未定 含め未選択でも保存可）。
 * - colorHex は任意・空 or #RRGGBB（colorId 未選択でも手入力だけで従来通り保存できる経路は維持）。
 */

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/

export const PRODUCT_COLORWAY_STATUS_VALUES = ["ACTIVE", "ARCHIVED"] as const
export type ProductColorwayStatusValue =
  (typeof PRODUCT_COLORWAY_STATUS_VALUES)[number]

export const productColorwayInputSchema = z.object({
  colorwayCode: z
    .string()
    .trim()
    .min(1, "カラーウェイ記号は必須です")
    .max(50, "50文字以内で入力してください"),
  colorwayName: z
    .string()
    .trim()
    .min(1, "カラーウェイ名は必須です")
    .max(100, "100文字以内で入力してください"),
  colorHex: z
    .string()
    .trim()
    .max(7, "7文字以内で入力してください")
    .default("")
    .refine((v) => v === "" || HEX_PATTERN.test(v), {
      message: "HEX の形式が不正です（例: #001799）",
    }),
  sortOrder: z.coerce.number().int().min(0).default(0),
  status: z.enum(PRODUCT_COLORWAY_STATUS_VALUES).default("ACTIVE"),
  // Color マスターへの緩い参照（任意・空/未選択は null 正規化）
  colorId: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  // B-066-③: TextilePattern への緩い参照（任意・null=従来単色。色との排他はしない）
  patternId: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
})

export type ProductColorwayFormValues = z.input<typeof productColorwayInputSchema>
export type ProductColorwayInput = z.infer<typeof productColorwayInputSchema>
