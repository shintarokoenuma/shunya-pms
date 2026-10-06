import { Font } from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { createMeasurer, type FontkitLike, type Measurer } from "./sewing-spec-layout"

/**
 * B-267: 描画と同じフォント（react-pdf の Font store に登録した NotoSansJP-Regular）で測る Measurer を作る。
 * サーバ専用（fonts.ts と同じくファイルから読む）。フォントは1回だけ読み、使い回す
 */
let cached: Promise<Measurer> | null = null

export function loadSewingSpecMeasurer(): Promise<Measurer> {
  if (!cached) {
    cached = (async () => {
      registerPdfFonts()
      const descriptor = { fontFamily: PDF_FONT_FAMILY, fontWeight: "normal" as const }
      await Font.load(descriptor)
      const data = (Font.getFont(descriptor) as { data?: unknown }).data
      if (!data) throw new Error("縫製仕様書のフォントを読み込めませんでした")
      return createMeasurer(data as FontkitLike)
    })()
  }
  return cached
}
