import { z } from "zod"

/**
 * B-202 PR-2（addendum v0.5 D-22）: 絵型 caption 更新のバリデータ。
 * - caption は trim・最大50文字（暫定値）。空文字は「caption なし」＝ undefined に変換する。
 * - productId / gcsPath は action 側で companyId スコープの品番と配列要素を突き合わせる（ここでは形だけ）。
 */
export const updateProductSketchCaptionSchema = z.object({
  productId: z.string().min(1, "品番 id は必須です"),
  gcsPath: z.string().min(1, "絵型の指定が不正です"),
  caption: z
    .string()
    .trim()
    .max(50, "50文字以内で入力してください")
    .transform((v) => (v === "" ? undefined : v)),
})

export type UpdateProductSketchCaptionInput = z.input<
  typeof updateProductSketchCaptionSchema
>
