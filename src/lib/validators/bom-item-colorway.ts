import { z } from "zod"

/**
 * B-062 β 次PR: 資材×カラーウェイの調達カラー（BomItemColorway）バリデータ。
 * 仕様: docs/specs/product-overview-one-page-spec-confirmation-v0_4-2026-06-15.md §1-2 / §4
 * - product-colorway.ts の書式に合わせる。
 * - supplierColorCode は先方 C/#（結合キー）。空文字は「その資材×カラーウェイの C/# を消す」意図（actions 側で delete 判定）。
 * - supplierColorName は任意メモ。
 */

export const bomItemColorwayInputSchema = z.object({
  bomItemId: z.string().min(1, "資材明細 ID は必須です"),
  productColorwayId: z.string().min(1, "カラーウェイ ID は必須です"),
  supplierColorCode: z
    .string()
    .trim()
    .max(100, "100文字以内で入力してください")
    .default(""),
  supplierColorName: z
    .string()
    .trim()
    .max(100, "100文字以内で入力してください")
    .default(""),
})

export type BomItemColorwayInput = z.infer<typeof bomItemColorwayInputSchema>
