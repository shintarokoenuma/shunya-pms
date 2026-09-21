import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type { PdfImage, PdfSketchMeta } from "./sketch-image"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"

registerPdfFonts()

/** order-document.tsx の page の fontFamily と同じ値（NotoSansJP） */
const FONT_FAMILY = PDF_FONT_FAMILY

/**
 * JIS B4（257mm × 364mm）を pt で指定する。
 * react-pdf の size="B4" は ISO B4（250mm × 353mm）で、日本の B4 ではないため使わない。
 */
const B4_JIS: [number, number] = [728.5, 1031.8]

export type SketchProbeItem = {
  caption: string | null
  image: PdfImage | null
  meta: PdfSketchMeta
}

export type SketchProbeData = {
  productCode: string
  maxEdge: number
  quality: number
  items: SketchProbeItem[]
}

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: FONT_FAMILY, fontSize: 9 },
  title: { fontSize: 12, marginBottom: 8 },
  box: {
    height: 820,
    borderWidth: 0.5,
    borderColor: "#999999",
    justifyContent: "center",
    alignItems: "center",
  },
  img: { width: "100%", height: "100%", objectFit: "contain" },
  meta: { marginTop: 8, lineHeight: 1.5 },
})

function kb(n: number): string {
  return `${Math.round(n / 1024)}KB`
}

/** B-054 PR-3: 1ページ1枚で絵型を描き、下に形式・容量・処理時間を出す。★PR-4 で削除する。 */
export function SketchProbeDocument({ data }: { data: SketchProbeData }) {
  return (
    <Document>
      {data.items.map((it, i) => (
        <Page key={i} size={B4_JIS} style={styles.page}>
          <Text style={styles.title}>
            {`B-054 PR-3 技術検証 ― ${data.productCode}（${i + 1} / ${data.items.length}）`}
          </Text>
          <View style={styles.box}>
            {it.image ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf の Image は HTML の img ではなく alt を持たない
              <Image src={it.image} style={styles.img} />
            ) : (
              <Text>{`読めませんでした: ${it.meta.error ?? "不明"}`}</Text>
            )}
          </View>
          <Text style={styles.meta}>
            {`説明: ${it.caption ?? "（なし）"}\n` +
              `原本: ${it.meta.srcFormat ?? "?"} ${kb(it.meta.srcBytes)}　→　JPEG ${kb(it.meta.outBytes)}　${it.meta.width ?? "?"}×${it.meta.height ?? "?"}px　処理 ${it.meta.ms}ms\n` +
              `設定: 長辺 ${data.maxEdge}px・品質 ${data.quality}　用紙: JIS B4 257×364mm`}
          </Text>
        </Page>
      ))}
    </Document>
  )
}
