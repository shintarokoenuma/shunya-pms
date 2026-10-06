/**
 * B-267 縫製仕様書 PDF の「全文で折り返す」計算（sewing-spec-layout.ts）の検証（テストランナー非依存・DB 非接続）。
 * vitest/jest が無いため assert（throw）で書く。手動実行:
 *   npx tsx src/lib/pdf/sewing-spec-layout.test.ts
 *
 * 文字幅は同梱の全字版フォント（src/assets/fonts/NotoSansJP-Regular.ttf）を react-pdf の Font store 経由で読んで測る。
 * 対象: tokenizeForWrap（D-10・D-12・D-13）・breakIntoLines / countLines（行を先に決める）・planSewingPages（D-3〜D-8・D-11）
 */

import {
  ACC_W,
  MAIN_ACCESSORY_ROWS_MAX,
  SPEC_VALUE_W,
  NO_BREAK_CALLBACK,
  breakIntoLines,
  planSewingPages,
  tokenizeForWrap,
  type PlanAccessoryRow,
  type PlanInput,
  type PlanInstruction,
  type PlannedPage,
} from "./sewing-spec-layout"
import { loadSewingSpecMeasurer } from "./sewing-spec-measure"
import { inflateSync } from "node:zlib"
import React from "react"
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { PDF_FONT_FAMILY } from "./fonts"
import { CELL_PAD_H, FULL_LINE_HEIGHT, TABLE_FONT_SIZE } from "./sewing-spec-layout"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

/**
 * 描画した行数を数える（試作と同じ方法の node 版・1ページの PDF 用）: react-pdf（pdfkit）は run ごとに
 * q … 1 0 0 1 dx dy cm … BT … TJ … ET … Q を出し、位置は cm の積み重ねで決まる。q/Q/cm を追って
 * BT ごとの y を求め、その種類を数える（同じ行の run は y が同じ）。ページに Text が1つだけのときに使う
 */
function renderedLineCount(pdf: Buffer): number {
  const s = pdf.toString("latin1")
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    let txt: string
    try {
      txt = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1")
    } catch {
      continue
    }
    if (!/\bBT\b/.test(txt)) continue
    const ops = txt.split(/\s+/)
    const stack: number[] = []
    let y = 0
    const ys = new Set<number>()
    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i]
      if (op === "q") stack.push(y)
      else if (op === "Q") y = stack.pop() ?? y
      else if (op === "cm" && i >= 6) {
        const d = Number(ops[i - 3])
        const f = Number(ops[i - 1])
        y = d < 0 ? f - y : y + f
      } else if (op === "BT") ys.add(Math.round(y * 100) / 100)
    }
    return ys.size
  }
  return 0
}

const LABELS = [
  "ネーム位置", "洗濯ネーム位置", "仕上げ方法", "製品後加工", "下げ札", "裏", "糸", "ステッチ（番手）", "柄合わせ", "差し込み", "生地方向",
]
const KEYS = [
  "namePosition", "careLabelPosition", "finishingMethod", "postProcessing", "hangTag", "lining", "thread", "stitch", "patternMatching", "insertion", "fabricDirection",
]
const LONG_JP =
  "身頃と袖は本縫い 1.0cm で縫い合わせ、縫い代は2枚一緒にロックをかけて後ろ身頃側へ倒す。裾は三つ折りにして 1.5cm のステッチ、前立ては接着芯 ST-2210-W を貼ってから 0.1cm のコバステッチを入れる。糸は地色 #60 を2本取り。"

function instructions(n: number, value: string): PlanInstruction[] {
  return KEYS.slice(0, n).map((key, i) => ({ key, label: LABELS[i], value }))
}
function row(spec: string, colors: string[] = []): PlanAccessoryRow {
  return { part: "前立て", itemCode: "HT-ETB-27SS", spec, colors, usage: "1 枚", supplier: "ナイトウ繊維" }
}
function input(partial: Partial<PlanInput>): PlanInput {
  return {
    instructions: instructions(3, "CB衿ぐり付け〜3.0cm下"),
    accessories: [row("第2ボタンに糸ループで取り付け"), row("前立て裏に貼る"), row("両脇")],
    colorwayNames: ["BLACK", "WHITE"],
    skuMatrix: null,
    pages: [{ kind: "sewing", quantityMode: "wo-total-only", sketchCount: 1 }],
    ...partial,
  }
}
type Main = Extract<PlannedPage, { kind: "sewing-main" }>
type Cont = Extract<PlannedPage, { kind: "sewing-cont" }>
const mains = (pages: PlannedPage[]) => pages.filter((p): p is Main => p.kind === "sewing-main")
const conts = (pages: PlannedPage[]) => pages.filter((p): p is Cont => p.kind === "sewing-cont")

;(async () => {
  const m = await loadSewingSpecMeasurer()

  // ① tokenizeForWrap（D-10）
  {
    // 「下」が最後の1文字だと D-13 で「3.0cm」とつながるので、最後に2文字を足して確かめる
    const t1 = tokenizeForWrap("CB衿ぐり付け〜3.0cm下まで")
    assert(t1.includes("3.0cm") && t1.includes("CB") && t1.includes("衿"), `①-1 3.0cm が1つのかたまり: ${JSON.stringify(t1)}`)
    assert(JSON.stringify(tokenizeForWrap("CB衿ぐり付け〜3.0cm下").slice(-1)) === JSON.stringify(["3.0cm下"]), "①-1b 最後の1文字は英数字のかたまりともつなぐ（D-13）")
    assert(JSON.stringify(tokenizeForWrap("HT-ETB-27SS")) === JSON.stringify(["HT-ETB-27SS"]), "①-2 品番は1つのかたまり")
    assert(JSON.stringify(tokenizeForWrap("a\nb")) === JSON.stringify(["a", "\n", "b"]), "①-3 改行は1文字として残る")
    assert(JSON.stringify(tokenizeForWrap("")) === "[]", "①-4 空文字は空")
    // かたまりが幅より長いときだけ文字で折る（D-10 の安全策）
    const ls5 = breakIntoLines("ABCDEFGHIJKLMNOP", 30, (s) => m.widthOf(s))
    assert(ls5.length > 1 && ls5.every((l) => m.widthOf(l) <= 30), `①-5 幅より長いかたまりは文字の間で折る: ${JSON.stringify(ls5)}`)
    assert(JSON.stringify(breakIntoLines("AB", 30, (s) => m.widthOf(s))) === JSON.stringify(["AB"]), "①-5b 幅に入るかたまりは割らない")
    assert(JSON.stringify(breakIntoLines("本縫い 1.0cm で", 30, (s) => m.widthOf(s))).includes("1.0cm"), "①-6 かたまりの途中では折らない")
    // D-12 禁則: 行頭に来てはいけない字は直前に、行末に来てはいけない字は直後にくっつく
    const t7 = tokenizeForWrap("本縫い 1.0cm で縫い合わせ。糸は地色 #60）")
    assert(!t7.includes("。") && t7.includes("せ。"), `①-7 「。」は直前にくっつく: ${JSON.stringify(t7)}`)
    // 「#」は英数字のかたまりの先頭になれない（D-10 の正規表現）ので「#」「60）」に分かれる。「）」は「60」にくっつく
    assert(!t7.includes("）") && t7.includes("60）"), `①-7b 「）」は英数字のかたまりにもくっつく: ${JSON.stringify(t7)}`)
    const t8 = tokenizeForWrap("資材部（担当 山田）、本社")
    assert(!t8.includes("（") && t8.includes("（担"), `①-8 「（」は直後にくっつく: ${JSON.stringify(t8)}`)
    assert(t8.includes("田）、"), `①-8b 「）、」は続けて直前にくっつく: ${JSON.stringify(t8)}`)
    const t9 = tokenizeForWrap("あ\n。い（\nう")
    // 改行の直後の「。」は前にくっつかない。改行の直前の「（」は後ろにくっつかず、D-13 で前の「い」とつながる
    assert(t9.includes("\n") && t9.includes("。") && t9.includes("い（"), `①-9 改行の前後では禁則でくっつけない: ${JSON.stringify(t9)}`)
    // D-13: 最後の単位が1文字なら前の単位とつなぐ（改行の直前も）
    const t10 = tokenizeForWrap("シャツ折り")
    assert(t10[t10.length - 1] === "折り", `①-10 最後の1文字は前とつなぐ: ${JSON.stringify(t10)}`)
    const t11 = tokenizeForWrap("タンブラー中温\n乾燥")
    assert(t11.includes("中温") && t11[t11.length - 1] === "乾燥", `①-11 改行の直前でも同じ: ${JSON.stringify(t11)}`)
    assert(JSON.stringify(tokenizeForWrap("A")) === JSON.stringify(["A"]), "①-12 1文字だけならそのまま")
  }

  // ② countLines
  {
    assert(m.countLines("CB衿ぐり付け〜3.0cm下", SPEC_VALUE_W) === 1, "②-1 短い文は1行")
    const n = m.countLines(LONG_JP, SPEC_VALUE_W)
    assert(n >= 2, `②-2 列幅を超える日本語は2行以上: ${n}`)
    const code = m.countLines("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", ACC_W.code)
    assert(code >= 2, `②-3 幅より長い英数字のかたまりは文字の間で折れる: ${code}`)
    assert(m.countLines("", ACC_W.usage) === 1, "②-4 空は1行")
    assert(m.countLines("1行目\n2行目", ACC_W.spec) === 2, "②-5 改行は強制改行")

    // ②-6 countLines の結果が描画と一致する（FullCell と同じく fitText の文字列を NO_BREAK_CALLBACK で描き、行を数える）
    const CASES: { text: string; w: number }[] = [
      { text: "CB衿ぐり付け〜3.0cm下", w: SPEC_VALUE_W },
      { text: LONG_JP, w: SPEC_VALUE_W },
      { text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-ABCDEFGHIJ", w: ACC_W.code },
      { text: "第2ボタンに糸ループで取り付け。糸は地色 #60。\n2段目に注記", w: ACC_W.spec },
      { text: "株式会社ナイトウ繊維商事 大阪本社 資材部（担当 山田・TEL 06-0000-0000）", w: ACC_W.supplier },
      { text: "12.5m 2.1kg/反 ×3", w: ACC_W.usage },
      { text: "身頃と袖は本縫い 1.0cm で縫い合わせ。糸は地色（#60）。裾は三つ折り、脇はロック。", w: ACC_W.spec },
      { text: "縫製後に製品ワッシャー。畳み仕上げ・シャツ折り", w: SPEC_VALUE_W },
      { text: "タンブラー中温", w: ACC_W.usage },
    ]
    // D-13: 最後の行が1文字だけにならない
    for (const c of CASES.slice(-2)) {
      const ls = m.lines(c.text, c.w)
      assert(ls.length >= 2 && Array.from(ls[ls.length - 1]).length >= 2, `②-7 最後の行が2文字以上: ${JSON.stringify(ls)}`)
    }
    for (const [i, c] of CASES.entries()) {
      const doc = React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { size: [728.5, 1031.8], style: { fontFamily: PDF_FONT_FAMILY, fontSize: TABLE_FONT_SIZE, padding: 28 } },
          React.createElement(
            View,
            { style: { width: c.w, paddingHorizontal: CELL_PAD_H } },
            React.createElement(Text, { style: { lineHeight: FULL_LINE_HEIGHT }, hyphenationCallback: NO_BREAK_CALLBACK }, m.fitText(c.text, c.w)),
          ),
        ),
      )
      const rendered = renderedLineCount(await renderToBuffer(doc))
      const predicted = m.countLines(c.text, c.w)
      assert(predicted === rendered, `②-6 行数が描画と一致: case ${i + 1} predicted=${predicted} rendered=${rendered} ${c.text.slice(0, 20)}`)
    }
  }

  // ③-1 短い指示・付属3行 → つづき無し・色ごとの指定は1枚目・綴りの札なし
  {
    const plan = planSewingPages(input({ accessories: [row("a", ["黒", "白"]), row("b"), row("c")] }), m)
    assert(plan.pages.length === 1, `③-1 ページは1枚: ${plan.pages.length}`)
    const main = mains(plan.pages)[0]
    assert(main.instructionCount === 3 && main.accessoryRange[1] === 3, "③-1' 仕様3・付属3が1枚目")
    assert(main.colorSpec && main.booklet.total === 1 && main.accessoryNote === null && main.instructionNote === null, "③-1'' 色ごとの指定は1枚目・札と案内は無し")
  }

  // ③-2 付属15行で各行が3行 → 1枚目に入る行まで・残りはつづき・綴り「全2枚綴り」・色ごとの指定は最後のつづき
  {
    const spec3 = "第2ボタンに糸ループで取り付け。糸は地色 #60 を使い、ループの長さは 1.2cm に揃える。"
    assert(m.countLines(spec3, ACC_W.spec) >= 3, `③-2 前提: 仕様が3行以上: ${m.countLines(spec3, ACC_W.spec)}`)
    const rows = Array.from({ length: 15 }, (_, i) => row(spec3, i % 2 === 0 ? ["黒", "白"] : []))
    const plan = planSewingPages(input({ accessories: rows }), m)
    const main = mains(plan.pages)[0]
    const cs = conts(plan.pages)
    assert(main.accessoryRange[1] > 0 && main.accessoryRange[1] < 15, `③-2' 1枚目は入る行まで: ${main.accessoryRange[1]}`)
    assert(cs.length === 1 && cs[0].accessoryRange?.[0] === main.accessoryRange[1] && cs[0].accessoryRange?.[1] === 15, "③-2'' 残りは1枚のつづき")
    assert(main.booklet.total === 2 && cs[0].booklet.index === 2 && cs[0].booklet.total === 2, "③-2''' 全2枚綴り")
    assert(!main.colorSpec && cs[0].colorSpec, "③-2'''' 色ごとの指定は最後のつづき")
    assert(main.accessoryNote === `つづきは次のページ（付属 ${15 - main.accessoryRange[1]} 行）`, `③-2''''' 案内: ${main.accessoryNote}`)
  }

  // ③-3 付属20行（短い）→ 1枚目は最大15行
  {
    const rows = Array.from({ length: 20 }, (_, i) => row(`行 ${i + 1}`))
    const plan = planSewingPages(input({ accessories: rows }), m)
    const main = mains(plan.pages)[0]
    assert(main.accessoryRange[1] === MAIN_ACCESSORY_ROWS_MAX, `③-3 1枚目は15行: ${main.accessoryRange[1]}`)
    assert(conts(plan.pages).length === 1 && conts(plan.pages)[0].accessoryRange?.[1] === 20, "③-3' 残り5行はつづき")
  }

  // ③-4 付属は全部入るが色ごとの指定が入らない → 色ごとの指定だけのつづき（D-4）
  {
    const longColor = "LC25-01 ミッドナイトネイビー（先方指定・ロット違い注意）"
    const rows = Array.from({ length: 14 }, (_, i) => row(`行 ${i + 1}`, [longColor, longColor, longColor, longColor, longColor]))
    const plan = planSewingPages(input({ accessories: rows, colorwayNames: ["A", "B", "C", "D", "E"] }), m)
    const main = mains(plan.pages)[0]
    const cs = conts(plan.pages)
    assert(main.accessoryRange[1] === 14 && !main.colorSpec, "③-4 付属は全部1枚目・色ごとの指定は1枚目に無い")
    assert(cs.length === 1 && cs[0].accessoryRange === null && cs[0].instructionRange === null && cs[0].colorSpec, "③-4' 色ごとの指定だけのつづき")
    assert(main.accessoryNote === "色ごとの指定は次のページ", `③-4'' 案内: ${main.accessoryNote}`)
  }

  // ③-5 仕様11項目すべてが長い → 仕様のつづき（D-5）
  {
    const plan = planSewingPages(input({ instructions: instructions(11, LONG_JP + LONG_JP) }), m)
    const main = mains(plan.pages)[0]
    const cs = conts(plan.pages)
    assert(main.instructionCount > 0 && main.instructionCount < 11, `③-5 1枚目に入る項目まで: ${main.instructionCount}`)
    assert(main.instructionNote === "つづきは次のページ", "③-5' 仕様の案内")
    assert(cs.length >= 1 && cs[0].instructionRange?.[0] === main.instructionCount, "③-5'' 残りは最初のつづきの先頭")
    const last = cs[cs.length - 1]
    assert(last.instructionRange?.[1] === 11 || cs.some((c) => c.instructionRange?.[1] === 11), "③-5''' 11 項目目まで出る")
    // 付属3行は、1枚目に入った分と、つづきに送られた分を合わせて 0〜3 を切れ目なく覆う
    const ranges: [number, number][] = [main.accessoryRange, ...cs.flatMap((c) => (c.accessoryRange ? [c.accessoryRange] : []))]
    let covered = 0
    for (const [s0, e0] of ranges) {
      assert(s0 === covered, `③-5'''' 付属の行が途切れない: ${JSON.stringify(ranges)}`)
      covered = e0
    }
    assert(covered === 3, `③-5''''' 付属3行がどこかに出る: ${JSON.stringify(ranges)}`)
  }

  // ③-7 D-5 の補足（追補 §2）: 仕様をつづきへ送ったら、1枚目に付属の行は出さず、全行をつづき側へ（仕様のつづき → 付属のつづき の順）
  {
    const rows = Array.from({ length: 20 }, (_, i) => row(`行 ${i + 1}`, i % 2 === 0 ? ["黒", "白"] : []))
    const plan = planSewingPages(input({ instructions: instructions(11, LONG_JP + LONG_JP), accessories: rows }), m)
    const main = mains(plan.pages)[0]
    const cs = conts(plan.pages)
    assert(main.instructionCount < 11 && main.instructionNote === "つづきは次のページ", "③-7 前提: 仕様が送られている")
    assert(main.accessoryRange[0] === 0 && main.accessoryRange[1] === 0, `③-7b 1枚目の付属の行は 0: ${JSON.stringify(main.accessoryRange)}`)
    assert(main.accessoryNote === "つづきは次のページ（付属 20 行）", `③-7c 案内: ${main.accessoryNote}`)
    const firstInstr = cs.findIndex((c) => c.instructionRange !== null)
    const firstAcc = cs.findIndex((c) => c.accessoryRange !== null)
    assert(firstInstr === 0 && firstAcc >= firstInstr, `③-7d 仕様のつづきが付属のつづきより前: instr=${firstInstr} acc=${firstAcc}`)
    let covered = 0
    for (const c of cs) {
      if (!c.accessoryRange) continue
      assert(c.accessoryRange[0] === covered, `③-7e 付属の行が途切れない: ${JSON.stringify(c.accessoryRange)}`)
      covered = c.accessoryRange[1]
    }
    assert(covered === 20, `③-7f 付属 20 行が全部つづきに出る: ${covered}`)
  }

  // ③-6 宛先が2つ（sewing を2つ）→ 宛先ごとに綴り・ページ番号は通し
  {
    const spec3 = "第2ボタンに糸ループで取り付け。糸は地色 #60 を使い、ループの長さは 1.2cm に揃える。"
    const rows = Array.from({ length: 15 }, () => row(spec3))
    const plan = planSewingPages(
      input({
        accessories: rows,
        pages: [
          { kind: "sewing", quantityMode: "wo-total-only", sketchCount: 1 },
          { kind: "sewing", quantityMode: "sku-matrix", sketchCount: 1 },
        ],
        skuMatrix: { rows: [{ colorLabel: "BLACK" }, { colorLabel: "WHITE" }] },
      }),
      m,
    )
    const ms = mains(plan.pages)
    assert(ms.length === 2 && ms[0].pageIndex === 0 && ms[1].pageIndex === 1, "③-6 宛先ごとに1枚目")
    assert(ms[0].booklet.total === 2 && ms[1].booklet.total === 2, "③-6' 宛先ごとの綴り")
    assert(plan.pages.length === 4 && plan.pages[1].kind === "sewing-cont" && plan.pages[2].kind === "sewing-main", "③-6'' 1枚目→つづき→1枚目→つづきの順（通し番号は描画側で添字＋1）")
  }

  // ④ 2枚目（D-11）: 画像が2つなら採寸位置の絵型の高さを返す。1つなら null
  {
    const plan = planSewingPages(
      input({ pages: [{ kind: "measure", quantityMode: "wo-total-only", sketchCount: 2 }, { kind: "measure", quantityMode: "wo-total-only", sketchCount: 1 }] }),
      m,
    )
    const [a, b] = plan.pages
    assert(a.kind === "measure" && a.firstSketchHeight === 230, `④-1 画像2つ・短い仕様 → 230: ${a.kind === "measure" ? a.firstSketchHeight : "-"}`)
    assert(b.kind === "measure" && b.firstSketchHeight === null, "④-2 画像1つ → null（残りいっぱい）")
    const plan2 = planSewingPages(
      input({
        instructions: [
          { key: "finishingMethod", label: "仕上げ方法", value: LONG_JP.repeat(6) },
          { key: "postProcessing", label: "製品後加工", value: LONG_JP.repeat(6) },
          { key: "fabricDirection", label: "生地方向", value: LONG_JP.repeat(6) },
        ],
        pages: [{ kind: "measure", quantityMode: "wo-total-only", sketchCount: 2 }],
      }),
      m,
    )
    const c = plan2.pages[0]
    assert(c.kind === "measure" && c.firstSketchHeight !== null && c.firstSketchHeight < 230 && c.firstSketchHeight >= 1, `④-3 仕様が長いと縮む: ${c.kind === "measure" ? c.firstSketchHeight : "-"}`)
  }

  console.log("sewing-spec-layout.test.ts: all assertions passed")
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
