import { z } from "zod"

/**
 * B-202 PR-3: 品番カルテ メモ（Comment）のバリデータ。
 * 仕様: docs/specs/b-202-product-karte-one-screen-spec-confirmation-v1_0-2026-09-12.md D-7
 * - content は trim・1〜2000文字。空は拒否。
 * - productId / commentId は uuid（sample-revision.ts の書き方に合わせる）。
 */
const content = z
  .string()
  .trim()
  .min(1, "メモを入力してください")
  .max(2000, "2000文字以内で入力してください")

export const createProductCommentSchema = z.object({
  productId: z.string().uuid("品番の指定が不正です"),
  content,
})

export const updateProductCommentSchema = z.object({
  productId: z.string().uuid("品番の指定が不正です"),
  commentId: z.string().uuid("メモの指定が不正です"),
  content,
})

export const deleteProductCommentSchema = z.object({
  productId: z.string().uuid("品番の指定が不正です"),
  commentId: z.string().uuid("メモの指定が不正です"),
})
