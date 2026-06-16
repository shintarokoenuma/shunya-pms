import { z } from "zod"

/**
 * B-062 β 次PR: 資材×カラーウェイの調達カラー（BomItemColorway）バリデータ。
 * 仕様: docs/specs/product-overview-one-page-spec-confirmation-v0_4-2026-06-15.md §1-2 / §4
 * - product-colorway.ts の書式に合わせる。
 * - supplierColorCode は先方 C/#（結合キー）。空文字は「その資材×カラーウェイの C/# を消す」意図（actions 側で delete 判定）。
 * - supplierColorName は任意メモ。
 */

/**
 * 先方カラー品番の "C/#" 接頭辞を剥がして番号だけにする正規化。
 * "c/#099" "C/#099" "Ｃ／＃099" "#099" "# 099" "C/099" → "099"。
 * - 全角 Ｃ／＃ を半角化したのち、先頭の C/# マーカー（/ か # を必ず含む）と前後空白を除去。
 * - マーカーを含まない場合（"C99" など英字混じり番号）は中身を触らない＝接頭辞だけ除去。
 * - 冪等: 既に正規化済み（"099"）に再適用しても同じ結果。サーバ側を最終防衛線とする。
 */
export function normalizeSupplierColorCode(raw: string): string {
  const halfWidth = raw
    .replace(/Ｃ/g, "C")
    .replace(/ｃ/g, "c")
    .replace(/／/g, "/")
    .replace(/＃/g, "#")
    .trim()
  // 先頭: 任意の C → 任意空白 → ( "/" + 任意"#" | "#" ) → 任意空白 を除去（/ か # が必須）
  return halfWidth.replace(/^[cC]?\s*(?:\/\s*#?|#)\s*/, "").trim()
}

export const bomItemColorwayInputSchema = z.object({
  bomItemId: z.string().min(1, "資材明細 ID は必須です"),
  productColorwayId: z.string().min(1, "カラーウェイ ID は必須です"),
  supplierColorCode: z
    .string()
    .trim()
    .max(100, "100文字以内で入力してください")
    .default("")
    .transform((v) => normalizeSupplierColorCode(v)),
  supplierColorName: z
    .string()
    .trim()
    .max(100, "100文字以内で入力してください")
    .default(""),
})

export type BomItemColorwayInput = z.infer<typeof bomItemColorwayInputSchema>
