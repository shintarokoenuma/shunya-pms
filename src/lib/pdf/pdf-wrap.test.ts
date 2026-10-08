/**
 * B-268 帳票共通の折り返し（pdf-wrap.ts・sewing-spec-layout.ts の D-4）の検証（テストランナー非依存・DB 非接続）。
 * vitest/jest が無いため assert（throw）で書く。手動実行:
 *   npx tsx src/lib/pdf/pdf-wrap.test.ts
 *
 * 文字幅は同梱の全字版フォント（NotoSansJP-Regular）を react-pdf の Font store 経由で読んで測る（loadPdfMeasurer）。
 * 対象: wrapText（D-3 の入口）・splitLongUnit（D-4）・NO_HEAD の長音（D-12）・各帳票の文字幅の定数
 */

import { loadPdfMeasurer } from "./pdf-measure"
import { splitLongUnit, tokenizeForWrap } from "./sewing-spec-layout"
import {
  A4_CONTENT_W,
  DELIVERY_TEXT_W,
  INVOICE_TEXT_W,
  ORDER_TEXT_W,
  QUOTATION_TEXT_W,
  colTextWidth,
  pdfWrapOf,
  wrapAfterLabel,
} from "./pdf-wrap"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}
const near = (a: number, b: number) => Math.abs(a - b) < 0.01

let passed = 0
;(async () => {
  const m = await loadPdfMeasurer()
  const wrap = pdfWrapOf(m)
  const lines = (text: string, w: number, fs?: number) => wrap.text(text, w, fs).split("\n")

  // ① 文字幅の定数（A4 595.28 − 36×2 = 523.28）
  {
    assert(near(A4_CONTENT_W, 523.28), `①-1 本文の幅 ${A4_CONTENT_W}`)
    assert(near(colTextWidth(523.28, 24, 4), 523.28 * 0.24 - 8 - 0.5), "①-2 colTextWidth = 列% − 余白×2 − 0.5")
    assert(near(ORDER_TEXT_W.name, 117.0872), `①-3 発注書 品名 ${ORDER_TEXT_W.name}`)
    assert(near(ORDER_TEXT_W.code, 69.992) && near(ORDER_TEXT_W.color, 69.992), "①-4 発注書 品番・C#")
    assert(near(ORDER_TEXT_W.target, 241.6744), `①-5 対象品番ブロック ${ORDER_TEXT_W.target}`)
    assert(near(QUOTATION_TEXT_W.name, 263.6056) && near(QUOTATION_TEXT_W.label, 368.2616), "①-6 見積書")
    assert(near(INVOICE_TEXT_W.doc, 71.992) && near(INVOICE_TEXT_W.name, 176.648) && near(INVOICE_TEXT_W.color, 66.7592), "①-7 請求書")
    assert(
      near(DELIVERY_TEXT_W.code, 108.6216) && near(DELIVERY_TEXT_W.name, 140.0184) && near(DELIVERY_TEXT_W.nameWide, 244.6744) &&
        near(DELIVERY_TEXT_W.color, 66.7592) && near(DELIVERY_TEXT_W.size, 35.3624) && near(DELIVERY_TEXT_W.soLine, 373.28),
      "①-8 納品書",
    )
    passed++
  }

  // ② 「4.4オンス ドライTシャツ 00300-ACT」を狭い幅で: 「00300-ACT」が1行の中に残る
  {
    const text = "4.4オンス ドライTシャツ 00300-ACT"
    const w = m.widthOf("ドライTシャツ 00300-ACT") - 1 // 全部は入らない・「00300-ACT」は入る
    const ls = lines(text, w)
    assert(ls.length >= 2, `②-1 2行以上: ${JSON.stringify(ls)}`)
    assert(ls.some((l) => l.includes("00300-ACT")), `②-2 00300-ACT が割れない: ${JSON.stringify(ls)}`)
    assert(ls.some((l) => l.includes("4.4")), `②-3 4.4 が割れない: ${JSON.stringify(ls)}`)
    assert(ls.join("") === text, "②-4 文字は欠けない")
    passed++
  }

  // ③ 「ワイドパンツ100枚」を狭い幅で: 「100」が割れない
  {
    const text = "ワイドパンツ100枚"
    const w = m.widthOf(text) - 1
    const ls = lines(text, w)
    assert(ls.length === 2, `③-1 2行: ${JSON.stringify(ls)}`)
    assert(ls.some((l) => l.includes("100")), `③-2 100 が割れない: ${JSON.stringify(ls)}`)
    assert(ls[1] === "100枚", `③-3 最後の「枚」は 100 とつながる（D-13）: ${JSON.stringify(ls)}`)
    passed++
  }

  // ④ 「SO-2026-0002」: 幅に入るなら割れない
  {
    const text = "SO-2026-0002"
    assert(lines(text, m.widthOf(text) + 2).length === 1, "④-1 幅に入れば1行")
    assert(lines(text, INVOICE_TEXT_W.doc).length === 1, "④-2 請求書の伝票番号の欄（71.99pt）に1行で入る")
    const ls = lines(`前受金充当（${text}）`, m.widthOf(`前受金充当（${text}）`) - 1)
    assert(ls.some((l) => l.includes(text)), `④-3 文の中でも割れない: ${JSON.stringify(ls)}`)
    passed++
  }

  // ⑤ 「AVANI X AND コラボ ベーカー生地パッチワーク表地」: 「ー」で始まる行が無い（D-12・B-268 で NO_HEAD に追加）。
  //    幅は 5 文字分（45pt＋改行の字送り 9pt）以上で試す。それより狭いと「ベー」が1単位ごと幅を超え、安全策で文字に分かれる（D-10 の安全策・対象外）
  {
    const text = "AVANI X AND コラボ ベーカー生地パッチワーク表地"
    assert(tokenizeForWrap("ベーカー").join("|") === "ベー|カー", `⑤-1 ー は前の字にくっつく: ${tokenizeForWrap("ベーカー").join("|")}`)
    const full = m.widthOf(text)
    let checked = 0
    for (let w = full - 1; w > 54; w -= 3) {
      for (const l of lines(text, w)) {
        assert(!l.startsWith("ー"), `⑤-2 幅 ${w.toFixed(1)} で「ー」が行頭: ${JSON.stringify(lines(text, w))}`)
        assert(!/^[ァィゥェォッャュョぁぃぅぇぉっゃゅょ]/.test(l), `⑤-3 小書きの仮名が行頭: ${JSON.stringify(l)}`)
      }
      checked++
    }
    assert(checked > 10, "⑤-4 幅を変えて十分に試した")
    passed++
  }

  // ⑥ 「BORDER-2026-SPRING-01」を入らない幅で: 「-」の直後で折れる（D-4）
  {
    const text = "BORDER-2026-SPRING-01"
    const w = m.widthOf("BORDER-2026-SPRING") // 全部は入らない・BORDER-2026- は入る
    const ls = lines(text, w)
    assert(ls.length === 2 && ls[0] === "BORDER-2026-" && ls[1] === "SPRING-01", `⑥-1 区切りの直後で折れる: ${JSON.stringify(ls)}`)
    const ls2 = lines(text, ORDER_TEXT_W.code, 7)
    assert(ls2.join("") === text && ls2.every((l) => l.endsWith("-") || l === ls2[ls2.length - 1]), `⑥-2 発注書の D/# の欄（7pt）: ${JSON.stringify(ls2)}`)
    // / と _ も区切り（最後の行以外は改行の字送り widthOf("\n") ぶんを引いて詰めるので、その分を足した幅で試す）
    const w3 = m.widthOf("AB/CD_") + m.widthOf("\n") + 0.5
    assert(lines("AB/CD_EF", w3).join("|") === "AB/CD_|EF", `⑥-3 / と _ も区切り: ${lines("AB/CD_EF", w3).join("|")}`)
    const parts = splitLongUnit("AB-CD/EF_GH", 10, (s) => s.length)
    assert(parts.join("|") === "AB-|CD/|EF_|GH", `⑥-4 splitLongUnit は区切りを前の部分の末尾に残す: ${parts.join("|")}`)
    assert(splitLongUnit("AB-CD", 100, (s) => s.length).join("|") === "AB-CD", "⑥-5 幅に入る単位は分けない")
    passed++
  }

  // ⑦ 「-」を含まない長い英数字（30 文字）を入らない幅で: 文字の間で折れる（安全策）
  {
    const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123"
    const w = m.widthOf("ABCDEFGHIJKL")
    const ls = lines(text, w)
    assert(ls.length >= 2 && ls.join("") === text && ls.every((l) => l.length > 0), `⑦-1 文字の間で折れて欠けない: ${JSON.stringify(ls)}`)
    assert(ls.every((l) => m.widthOf(l) <= w), "⑦-2 どの行も幅に入る")
    passed++
  }

  // ⑧ 見出し付きの行（発注書の対象品番ブロック）: 見出しの後ろだけが返り、先頭行は見出しと合わせて幅に入る
  {
    const label = "品名: "
    const value = "リネン開襟シャツ ロングネームのテスト（27SS）"
    const w = m.widthOf(label + value) - 1
    const rest = wrapAfterLabel(wrap, label, value, w)
    const ls = rest.split("\n")
    assert(ls.length === 2 && ls.join("") === value, `⑧-1 見出しを除いた値が2行: ${JSON.stringify(ls)}`)
    assert(m.widthOf(label + ls[0]) <= w, "⑧-2 先頭行は見出しを含めて幅に入る")
    assert(wrapAfterLabel(wrap, label, "短い", 500) === "短い", "⑧-3 入るならそのまま")
    passed++
  }

  // ⑨ 空・短い値
  {
    assert(wrap.text("", 100) === "", "⑨-1 空は空")
    assert(wrap.text("—", 100) === "—", "⑨-2 —")
    assert(wrap.text("C/#D300", ORDER_TEXT_W.color) === "C/#D300", "⑨-3 C# はそのまま")
    passed++
  }

  console.log(`pdf-wrap.test.ts: ${passed} groups passed`)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
