/**
 * B-027: 品番カルテ 絵型（服のスケッチ）の共有型（中立モジュール・"use server"/prisma 非依存）。
 * client component が "use server" の actions ファイルから型を import すると
 * ブラウザバンドルに @prisma/client が漏れるため、型はここに置いて decouple する（PR #85 の轍）。
 */

/** Product.sketchImages(Json) の1要素。GCS パスを保持し、表示時に署名URL化する。 */
export type ProductSketch = {
  gcsPath: string // 原本 gs://...
  thumbGcsPath: string // サムネ gs://...（生成失敗時は gcsPath と同じにフォールバック）
  caption?: string
  sortOrder: number
}

/** getProductSketchUrls の戻り（署名URL付き・表示用）。 */
export type ProductSketchView = {
  gcsPath: string
  url: string // 原本の署名URL（15分）
  thumbUrl: string // サムネの署名URL（15分）
  caption?: string
  sortOrder: number
}
