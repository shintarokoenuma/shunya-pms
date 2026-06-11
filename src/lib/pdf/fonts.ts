import path from "node:path"
import { Font } from "@react-pdf/renderer"

/**
 * S-4c-2: 発注書 PDF 用フォント登録（Noto Sans JP・OFL）。
 * サーバ専用。Railway は `next start` 起動でリポジトリの src/ が cwd 配下に残るため、
 * process.cwd() 起点の絶対パスで .ttf を読む（standalone 出力は使っていない）。
 */
export const PDF_FONT_FAMILY = "NotoSansJP"

let registered = false

export function registerPdfFonts() {
  if (registered) return
  const dir = path.join(process.cwd(), "src", "assets", "fonts")
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(dir, "NotoSansJP-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(dir, "NotoSansJP-Bold.ttf"), fontWeight: "bold" },
    ],
  })
  // CJK の改行（禁則の簡易版）。日本語は単語境界が無いため文字単位で折り返す。
  Font.registerHyphenationCallback((word) => Array.from(word))
  registered = true
}
