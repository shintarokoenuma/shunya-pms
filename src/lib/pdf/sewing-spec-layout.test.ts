/**
 * B-267 縫製仕様書 PDF の「全文で折り返す」計算（sewing-spec-layout.ts）の検証（テストランナー非依存・DB 非接続）。
 * vitest/jest が無いため assert（throw）で書く。手動実行:
 *   npx tsx src/lib/pdf/sewing-spec-layout.test.ts
 *
 * 文字幅は同梱の全字版フォント（src/assets/fonts/NotoSansJP-Regular.ttf）を react-pdf の Font store 経由で読んで測る。
 * 対象: tokenizeForWrap（D-10）・countLines（textkit で数える）・planSewingPages（D-3〜D-8・D-11）
 */

import {
  ACC_W,
  MAIN_ACCESSORY_ROWS_MAX,
  SPEC_VALUE_W,
  makeWrapCallback,
  planSewingPages,
  tokenizeForWrap,
  type PlanAccessoryRow,
  type PlanInput,
  type PlanInstruction,
  type PlannedPage,
} from "./sewing-spec-layout"
import { loadSewingSpecMeasurer } from "./sewing-spec-measure"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
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
    const t1 = tokenizeForWrap("CB衿ぐり付け〜3.0cm下")
    assert(t1.includes("3.0cm") && t1.includes("CB") && t1.includes("衿"), `①-1 3.0cm が1つのかたまり: ${JSON.stringify(t1)}`)
    assert(JSON.stringify(tokenizeForWrap("HT-ETB-27SS")) === JSON.stringify(["HT-ETB-27SS"]), "①-2 品番は1つのかたまり")
    assert(JSON.stringify(tokenizeForWrap("a\nb")) === JSON.stringify(["a", "\n", "b"]), "①-3 改行は1文字として残る")
    assert(JSON.stringify(tokenizeForWrap("")) === "[]", "①-4 空文字は空")
    // かたまりが幅より長いときだけ文字に分ける
    const cb = makeWrapCallback(30, (s) => m.widthOf(s))
    const parts = cb("ABCDEFGHIJKLMNOP").filter((p) => p !== "")
    assert(parts.length === 16 && parts[0] === "A", `①-5 幅より長いかたまりは1文字ずつ: ${parts.length}`)
    const parts2 = cb("AB").filter((p) => p !== "")
    assert(JSON.stringify(parts2) === JSON.stringify(["AB"]), "①-5' 幅に入るかたまりは割らない")
    assert(cb("AB")[1] === "", "①-6 かたまりの後ろに空の区切り（「-」を出さない形）")
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
