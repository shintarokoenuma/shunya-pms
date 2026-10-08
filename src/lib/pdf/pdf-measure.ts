import { Font } from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { createMeasurer, type FontkitLike, type Measurer } from "./sewing-spec-layout"

/**
 * B-268 D-3: 描画と同じフォント（react-pdf の Font store に登録した NotoSansJP-Regular）で測る Measurer を作る（帳票共通）。
 * B-267 の loadSewingSpecMeasurer（縫製仕様書専用の名前）を一般の名前にしたもの。中身は同じ。
 * サーバ専用（fonts.ts と同じくファイルから読む）。フォントは1回だけ読み、使い回す
 */
let cached: Promise<Measurer> | null = null

export function loadPdfMeasurer(): Promise<Measurer> {
  if (!cached) {
    cached = (async () => {
      registerPdfFonts()
      const descriptor = { fontFamily: PDF_FONT_FAMILY, fontWeight: "normal" as const }
      await Font.load(descriptor)
      const data = (Font.getFont(descriptor) as { data?: unknown }).data
      if (!data) throw new Error("PDF のフォントを読み込めませんでした")
      return createMeasurer(data as FontkitLike)
    })()
  }
  return cached
}
