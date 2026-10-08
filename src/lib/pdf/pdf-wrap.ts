import { loadPdfMeasurer } from "./pdf-measure"
import { NO_BREAK_CALLBACK, type Measurer } from "./sewing-spec-layout"

/**
 * B-268 D-1〜D-3: 発注書・見積書・請求書・納品書の明細を、縫製仕様書と同じ規則（D-10 英数字のかたまりを折らない・
 * D-12 禁則・D-13 1文字だけの行を作らない）で先に行に分け、"\n" でつないで「折らせない」Text（NO_BREAK_CALLBACK）に渡す。
 * 列の幅は、各帳票のページ幅・ページ余白・列の %・セルの左右余白から pt で求め、ここに定数として置く（描画の見た目は変えない）
 */
export { NO_BREAK_CALLBACK }

/** A4 縦（react-pdf の size="A4"）の幅と、各帳票の左右余白（paddingHorizontal 36） */
export const A4_W = 595.28
export const A4_PAD_H = 36
export const A4_CONTENT_W = A4_W - A4_PAD_H * 2 // 523.28
/** 測りと描画のわずかな差を吸収する余裕（B-267 の textWidthOf と同じ 0.5pt） */
export const WRAP_SAFETY = 0.5

/** 列の %（表の幅＝本文の幅）とセルの左右余白（paddingHorizontal）から、文字が入る幅（pt） */
export function colTextWidth(contentW: number, pct: number, padH: number): number {
  return (contentW * pct) / 100 - padH * 2 - WRAP_SAFETY
}

/** 発注書・作業発注書（order-document.tsx）: 品名 24%・品番 15%・C# 15%・余白 4。対象品番ブロックは宛先枠 48% の中の枠（padding 4・border 0.5） */
export const ORDER_TEXT_W = {
  name: colTextWidth(A4_CONTENT_W, 24, 4),
  code: colTextWidth(A4_CONTENT_W, 15, 4),
  color: colTextWidth(A4_CONTENT_W, 15, 4),
  target: (A4_CONTENT_W * 48) / 100 - 4 * 2 - 0.5 * 2 - WRAP_SAFETY,
}
/** 見積書・量産見積書（quotation-document.tsx・pe-quotation-document.tsx）: 品名 52%・別枠の項目 72%・余白 4 */
export const QUOTATION_TEXT_W = {
  name: colTextWidth(A4_CONTENT_W, 52, 4),
  label: colTextWidth(A4_CONTENT_W, 72, 4),
}
/** 請求書（invoice-document.tsx）: 伝票番号 15%・品番/品名 35%・色・サイズ 14%・余白 3 */
export const INVOICE_TEXT_W = {
  doc: colTextWidth(A4_CONTENT_W, 15, 3),
  name: colTextWidth(A4_CONTENT_W, 35, 3),
  color: colTextWidth(A4_CONTENT_W, 14, 3),
}
/** 納品書（delivery-note-document.tsx）: 品番 22%・品名 28%（金額なしは 48%）・色 14%・サイズ 8%・余白 3。受注番号の行は表題の右の枠（幅は内容次第のため、表題と取消の札のぶんを引いた保守的な値） */
export const DELIVERY_TEXT_W = {
  code: colTextWidth(A4_CONTENT_W, 22, 3),
  name: colTextWidth(A4_CONTENT_W, 28, 3),
  nameWide: colTextWidth(A4_CONTENT_W, 48, 3),
  color: colTextWidth(A4_CONTENT_W, 14, 3),
  size: colTextWidth(A4_CONTENT_W, 8, 3),
  soLine: A4_CONTENT_W - 150,
}

/** 帳票の部品に渡す折り返し: text は行を "\n" でつないだ文字列を返す（fontSize の既定は 9） */
export type PdfWrap = {
  text: (text: string, textWidthPt: number, fontSize?: number) => string
  widthOf: Measurer["widthOf"]
}

export function pdfWrapOf(m: Measurer): PdfWrap {
  return { text: m.wrapText, widthOf: m.widthOf }
}

export async function loadPdfWrap(): Promise<PdfWrap> {
  return pdfWrapOf(await loadPdfMeasurer())
}

/**
 * 見出し付きの行（「品名: 〜」）: 見出しを含めて行に分け、見出しの後ろだけを返す（描画側は見出しを別の Text で前に置く）。
 * 先頭の行は必ず見出しで始まるので、その分を切る。万一そうでなければ値をそのまま返す（折り方は react-pdf 任せになるだけ）
 */
export function wrapAfterLabel(wrap: PdfWrap, label: string, value: string, textWidthPt: number, fontSize?: number): string {
  const t = wrap.text(label + value, textWidthPt, fontSize)
  return t.startsWith(label) ? t.slice(label.length) : value
}
