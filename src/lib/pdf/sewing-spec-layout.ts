import layoutEngine, {
  bidi,
  fontSubstitution,
  fromFragments,
  justification,
  linebreaker,
  scriptItemizer,
  textDecoration,
  wordHyphenation,
  type Attributes,
} from "@react-pdf/textkit"
import type { SewingSpecPageKind } from "./sewing-spec-format"
import type { SewingSpecPdfData } from "./sewing-spec-data"

/**
 * B-267: 縫製仕様書 PDF の「全文で折り返す」ための計算（純関数・React と prisma に依存しない）。
 * - 文字幅は react-pdf が使う fontkit のフォント（Font.getFont(...).data）で測り、行数は react-pdf と同じ textkit の
 *   layoutEngine（Knuth & Plass）で数える。描画と計算が同じ規則で折れることが、自動改ページを起こさない前提（B-267 D-7・D-9）
 * - 英数字のかたまり（品番・寸法・番手）は途中で折らず、日本語は文字の間で折る。かたまりがセルの幅より長いときだけ
 *   そのかたまりを文字の間で折る（B-267 D-10）
 * - ページの計画（planSewingPages）: 1枚目に入る分を高さで決め、残りを「つづき」のページに送る（B-267 D-3〜D-8）
 * ★定数は sewing-spec-document.tsx と共有する（紙面の寸法・余白・行の高さ・列の幅）。document 側で数値を直書きしない
 */

// ---------------------------------------------------------------- 紙面の寸法（JIS B4 縦・B-054 D-24）
export const PAGE_W = 728.5
export const PAGE_H = 1031.8
export const PAGE_PAD = 28
export const CONTENT_W = PAGE_W - PAGE_PAD * 2
export const CONTENT_H = PAGE_H - PAGE_PAD * 2

// ---------------------------------------------------------------- 表の文字と行
/** 表の文字の大きさ（B-054 D-41・9pt） */
export const TABLE_FONT_SIZE = 9
/** 全文のセルの行間（fontSize の倍率・明示する。1行 = 13.05pt ≒ 1行固定のセルの既定 13.03pt） */
export const FULL_LINE_HEIGHT = 1.45
export const FULL_LINE_PT = TABLE_FONT_SIZE * FULL_LINE_HEIGHT
/** 1行固定のセル（Cell / ColorCell）の既定の行の高さ: Noto Sans JP の (ascent 1160 − descent −288) / 1000 × 9pt */
export const DEFAULT_LINE_PT = 9 * 1.448
export const ROW_MIN_HEIGHT = 13
export const TH_H = ROW_MIN_HEIGHT + 1
export const TABLE_BORDER_TOP = 0.5
export const BLOCK_GAP = 5
export const CELL_PAD_H = 3
/** 節の見出し（fontSize 10 × 1.448 ＋ borderBottom 0.5 ＋ marginBottom 2 ＝ 16.98） */
export const SECTION_TITLE_H = 17
/** 「この発注 n 枚」（marginTop 3 ＋ 10pt の1行） */
export const ORDER_QTY_H = 3 + 10 * 1.448

// ---------------------------------------------------------------- ヘッダー（高さを明示する・B-267 §2-1-7）
export const HEADER_TITLE_ROW_H = 24
export const HEADER_TITLE_ROW_MB = 4
export const HEADER_PARTIES_H = 48
export const HEADER_BAND_H = 45
export const HEADER_H =
  HEADER_TITLE_ROW_H + HEADER_TITLE_ROW_MB + HEADER_PARTIES_H + BLOCK_GAP + HEADER_BAND_H + BLOCK_GAP

// ---------------------------------------------------------------- 絵型・余裕・上限
/** 1枚目の絵型の最低の高さ（枠の外寸・B-267 D-3。dev の PDF を見て調整） */
export const SKETCH_MIN_HEIGHT = 300
/** 計算と描画のずれの余裕（B-267 §2-1-6） */
export const SAFETY = 12
/** 1枚目に載せる付属の行数の上限（B-054 D-38 の 15 を維持） */
export const MAIN_ACCESSORY_ROWS_MAX = 15
/** 2枚目: 画像が2つのときの採寸位置の絵型の高さと、画像それぞれの最低の高さ（B-267 D-11） */
export const MEASURE_SKETCH_HEIGHT = 230
export const MEASURE_IMAGE_MIN_HEIGHT = 120
/** 2枚目の「仕様」に出す縫製指示の項目 */
export const MEASURE_INSTRUCTION_KEYS = ["finishingMethod", "postProcessing", "fabricDirection"] as const

// ---------------------------------------------------------------- 列の幅（割合は B-054 D-37 のまま）
/** 数量・仕様の2列（各 49%） */
export const TWO_COL_W = CONTENT_W * 0.49
export const SPEC_LABEL_W = TWO_COL_W * 0.36
export const SPEC_VALUE_W = TWO_COL_W * 0.64
/** つづきのページの「仕様（縫製指示）（つづき）」は全幅（36% / 64% は親＝CONTENT_W の幅） */
export const SPEC_VALUE_CONT_W = CONTENT_W * 0.64
/** 数量表（SkuMatrix）のカラー列 34% */
export const SKU_LABEL_W = TWO_COL_W * 0.34
/** 付属（部位 22 / 品番 12 / 仕様 22 / 色 14 / 用尺 8 / 手配 22） */
export const ACC_W = {
  part: CONTENT_W * 0.22,
  code: CONTENT_W * 0.12,
  spec: CONTENT_W * 0.22,
  color: CONTENT_W * 0.14,
  usage: CONTENT_W * 0.08,
  supplier: CONTENT_W * 0.22,
} as const
/** 色ごとの指定（部位 20% ＋ カラーウェイで 80% を等分） */
export const CW_PART_W = CONTENT_W * 0.2

/** セルの中の文字の幅（paddingHorizontal を引く）。計算は少し狭く（0.5pt）見て、描画より行数が少なくならないようにする */
export function textWidthOf(cellWidth: number): number {
  return cellWidth - CELL_PAD_H * 2 - 0.5
}

// ---------------------------------------------------------------- 折り方（D-10）
const ALNUM_CHUNK = /[A-Za-z0-9][A-Za-z0-9._\-/#%+]*/g

/**
 * 折ってよい単位に分ける。英数字のかたまりは1つ、それ以外（日本語・全角記号・空白・改行）は1文字ずつ。
 * 改行（\n）は1文字として返す（textkit が段落に分けるので、強制改行になる）
 */
export function tokenizeForWrap(text: string): string[] {
  const out: string[] = []
  let last = 0
  for (const m of text.matchAll(ALNUM_CHUNK)) {
    const i = m.index ?? 0
    if (i > last) out.push(...Array.from(text.slice(last, i)))
    out.push(m[0])
    last = i + m[0].length
  }
  if (last < text.length) out.push(...Array.from(text.slice(last)))
  return out
}

export type WrapCallback = (word: string) => string[]

/**
 * hyphenationCallback の工場。tokenizeForWrap の単位の後ろでだけ折れる（かたまりの後ろに "" を挟むのは、
 * 請求書の NO_HYPHEN_BREAK と同じく折り返しに「-」を出さないため）。
 * かたまり1つがセルの幅より長いときだけ、そのかたまりを1文字ずつに分ける
 */
export function makeWrapCallback(widthPt: number, widthOf: (s: string) => number): WrapCallback {
  return (word) => {
    const parts: string[] = []
    for (const tok of tokenizeForWrap(word)) {
      if (tok.length > 1 && widthOf(tok) > widthPt) parts.push(...Array.from(tok))
      else parts.push(tok)
    }
    return parts.flatMap((p) => [p, ""])
  }
}

// ---------------------------------------------------------------- 測り方
/** fontkit のフォント（react-pdf の Font.getFont(...).data）のうち使うもの */
export type FontkitLike = {
  unitsPerEm: number
  layout: (s: string) => { advanceWidth: number }
}

export type Measurer = {
  /** 文字列の幅（pt・fontSize は表の文字の大きさ） */
  widthOf: (s: string, fontSize?: number) => number
  /** 全文のセルが何行になるか（react-pdf と同じ textkit で数える・1 以上） */
  countLines: (text: string, cellWidth: number, fontSize?: number) => number
  /** 全文のセルに渡す hyphenationCallback */
  wrapFor: (cellWidth: number, fontSize?: number) => WrapCallback
}

const engine = layoutEngine({
  bidi,
  linebreaker,
  justification,
  textDecoration,
  scriptItemizer,
  wordHyphenation,
  fontSubstitution,
})

export function createMeasurer(font: FontkitLike): Measurer {
  const widthOf = (s: string, fontSize = TABLE_FONT_SIZE) =>
    s.length === 0 ? 0 : (font.layout(s).advanceWidth / font.unitsPerEm) * fontSize
  const wrapCache = new Map<string, WrapCallback>()
  const wrapFor = (cellWidth: number, fontSize = TABLE_FONT_SIZE) => {
    const key = `${cellWidth}:${fontSize}`
    let cb = wrapCache.get(key)
    if (!cb) {
      const w = textWidthOf(cellWidth)
      cb = makeWrapCallback(w, (s) => widthOf(s, fontSize))
      wrapCache.set(key, cb)
    }
    return cb
  }
  const countLines = (text: string, cellWidth: number, fontSize = TABLE_FONT_SIZE) => {
    if (!text) return 1
    const w = textWidthOf(cellWidth)
    const attributes = {
      font: [font],
      fontSize,
      lineHeight: fontSize * FULL_LINE_HEIGHT,
      direction: "ltr",
      align: "left",
      color: "black",
    } as unknown as Attributes
    const attributed = fromFragments([{ string: text, attributes }])
    const container = { x: 0, y: 0, width: w, height: Infinity }
    const paragraphs = engine(attributed, container, {
      // @react-pdf/layout の getLayoutOptions と同じ
      shrinkWhitespaceFactor: { before: -0.5, after: -0.5 },
      hyphenationCallback: wrapFor(cellWidth, fontSize),
    } as never)
    const n = paragraphs.reduce((acc, p) => acc + p.length, 0)
    return Math.max(1, n)
  }
  return { widthOf, countLines, wrapFor }
}

// ---------------------------------------------------------------- 高さの見積もり
/** 全文のセルの行（1行固定のセルを含まない行）: max(最低の高さ, 行数 × 1行の高さ) */
export function fullRowHeight(lines: number): number {
  return Math.max(ROW_MIN_HEIGHT, lines * FULL_LINE_PT)
}
/** 1行固定・2行までのセルの行: max(最低の高さ, 行数 × 既定の1行の高さ) */
export function fixedRowHeight(lines: number): number {
  return Math.max(ROW_MIN_HEIGHT, lines * DEFAULT_LINE_PT)
}

// ---------------------------------------------------------------- ページの計画（D-3〜D-8・D-11）
export type PlanInstruction = { key: string; label: string; value: string }
export type PlanAccessoryRow = {
  part: string
  itemCode: string
  spec: string
  colors: string[]
  usage: string
  supplier: string
}
export type PlanPageInput = {
  kind: SewingSpecPageKind
  quantityMode: "sku-matrix" | "wo-total-only"
  /** 載せる絵型の数（2枚目の画像の高さを決める） */
  sketchCount: number
}
export type PlanInput = {
  instructions: PlanInstruction[]
  accessories: PlanAccessoryRow[]
  colorwayNames: string[]
  skuMatrix: { rows: { colorLabel: string }[] } | null
  pages: PlanPageInput[]
}

export type PlannedPage =
  | {
      kind: "sewing-main"
      /** data.pages の添字 */
      pageIndex: number
      /** 1枚目に出す仕様（縫製指示）の件数（先頭から） */
      instructionCount: number
      /** 1枚目に出す付属の行（accessories の添字・[start, end)） */
      accessoryRange: [number, number]
      /** 色ごとの指定をこのページに出すか */
      colorSpec: boolean
      /** 仕様の見出しの右の案内（送った項目があるとき） */
      instructionNote: string | null
      /** 付属の見出しの右の案内（送った行・色ごとの指定があるとき） */
      accessoryNote: string | null
      booklet: { index: number; total: number }
    }
  | {
      kind: "sewing-cont"
      pageIndex: number
      /** 「仕様（縫製指示）（つづき）」に出す項目（[start, end)・無ければ null） */
      instructionRange: [number, number] | null
      /** 「付属（つづき）」に出す行（[start, end)・無ければ null） */
      accessoryRange: [number, number] | null
      colorSpec: boolean
      booklet: { index: number; total: number }
    }
  | {
      kind: "measure"
      pageIndex: number
      /** 画像が2つのときの採寸位置の絵型の高さ（1つ以下なら null＝残りの高さいっぱい） */
      firstSketchHeight: number | null
    }
  | { kind: "process"; pageIndex: number }

export type SewingSpecPlan = {
  pages: PlannedPage[]
  /** 全文のセルに渡す hyphenationCallback（列ごと） */
  wrap: {
    specValue: WrapCallback
    /** つづきのページの仕様の値（全幅） */
    specValueCont: WrapCallback
    accPart: WrapCallback
    accCode: WrapCallback
    accSpec: WrapCallback
    accUsage: WrapCallback
    accSupplier: WrapCallback
  }
}

/** 1ページで表に使える高さ（紙面 − ヘッダー − 余裕） */
export const PAGE_BODY_H = CONTENT_H - HEADER_H - SAFETY

/** SewingSpecPdfData から計画の入力を作る（型だけ依存・prisma は読まない） */
export function planInputFromData(
  data: Pick<SewingSpecPdfData, "instructions" | "accessories" | "colorwayNames" | "skuMatrix" | "pages">,
): PlanInput {
  return {
    instructions: data.instructions.map((it) => ({ key: it.key, label: it.label, value: it.value })),
    accessories: data.accessories.map((r) => ({
      part: r.part,
      itemCode: r.itemCode,
      spec: r.spec,
      colors: r.colors,
      usage: r.usage,
      supplier: r.supplier,
    })),
    colorwayNames: data.colorwayNames,
    skuMatrix: data.skuMatrix ? { rows: data.skuMatrix.rows.map((r) => ({ colorLabel: r.colorLabel })) } : null,
    pages: data.pages.map((p) => ({ kind: p.kind, quantityMode: p.quantityMode, sketchCount: p.sketches.length })),
  }
}

function instructionRowHeight(m: Measurer, it: PlanInstruction, valueWidth = SPEC_VALUE_W): number {
  // 項目名は1行固定（Cell）。値は全文
  return fullRowHeight(m.countLines(it.value, valueWidth))
}

function accessoryRowHeight(m: Measurer, r: PlanAccessoryRow): number {
  const lines = Math.max(
    m.countLines(r.part, ACC_W.part),
    m.countLines(r.itemCode, ACC_W.code),
    m.countLines(r.spec, ACC_W.spec),
    m.countLines(r.usage, ACC_W.usage),
    m.countLines(r.supplier, ACC_W.supplier),
  )
  return fullRowHeight(lines)
}

/** 1行固定・2行までのセル（ColorCell）の行数: 幅に入れば 1、入らなければ 2 */
function twoLineCount(m: Measurer, s: string, cellWidth: number): number {
  return m.widthOf(s) <= textWidthOf(cellWidth) ? 1 : 2
}

/** 数量の列の高さ（見出し＋数量表＋「この発注 n 枚」） */
function quantityColumnHeight(m: Measurer, input: PlanInput, page: PlanPageInput): number {
  let h = SECTION_TITLE_H
  if (page.quantityMode === "sku-matrix") {
    if (input.skuMatrix) {
      h += TABLE_BORDER_TOP + TH_H
      for (const r of input.skuMatrix.rows) h += fixedRowHeight(twoLineCount(m, r.colorLabel, SKU_LABEL_W))
      h += ROW_MIN_HEIGHT + BLOCK_GAP // 合計の行・表の marginBottom
    } else {
      h += DEFAULT_LINE_PT // 「SKU が未登録です」
    }
  }
  return h + ORDER_QTY_H
}

/** 仕様の列の高さ（見出し＋表。rows が 0 なら「—」） */
function specColumnHeight(rowHeights: number[]): number {
  if (rowHeights.length === 0) return SECTION_TITLE_H + DEFAULT_LINE_PT
  return SECTION_TITLE_H + TABLE_BORDER_TOP + rowHeights.reduce((a, b) => a + b, 0) + BLOCK_GAP
}

/** 数量・仕様の2列ブロックの高さ（marginBottom を含む） */
function quantityAndSpecHeight(qtyH: number, specRowHeights: number[]): number {
  return Math.max(qtyH, specColumnHeight(specRowHeights)) + BLOCK_GAP
}

/** 付属の表の見出し行まで（節の見出し＋borderTop＋th） */
const ACC_HEAD_H = SECTION_TITLE_H + TABLE_BORDER_TOP + TH_H
/** 付属の表の下の余白 */
const ACC_TAIL_H = BLOCK_GAP

/** 色ごとの指定の表の高さ（出す行が無ければ 0） */
function colorSpecHeight(m: Measurer, input: PlanInput): number {
  const colored = input.accessories.filter((r) => r.colors.length > 0)
  if (colored.length === 0 || input.colorwayNames.length === 0) return 0
  const colW = CONTENT_W * (Math.floor(80 / input.colorwayNames.length) / 100)
  const thLines = Math.max(1, ...input.colorwayNames.map((c) => twoLineCount(m, c, colW)))
  let h = SECTION_TITLE_H + TABLE_BORDER_TOP + Math.max(TH_H, thLines * DEFAULT_LINE_PT)
  for (const r of colored) {
    const lines = Math.max(1, ...r.colors.map((c) => twoLineCount(m, c, colW)))
    h += fixedRowHeight(lines)
  }
  return h + BLOCK_GAP
}

/**
 * ページの計画。
 * - 1枚目: ヘッダー → 絵型（最低 SKETCH_MIN_HEIGHT）→ 数量・仕様（全項目。入らなければ入る項目まで・D-5）→ 付属（入る行まで・最大 15）
 *   → 色ごとの指定（付属が全部入り、かつ入るときだけ・D-4）
 * - つづき: ヘッダー →（仕様のつづき）→ 付属（つづき）→（最後のページだけ）色ごとの指定。1ページに入る分を高さで決める（D-6）
 * - 綴り（D-8）: 宛先ごとに 1枚目＋つづきを数える
 * - 2枚目: 仕様3項目の高さから画像の高さを決める（D-11）
 */
export function planSewingPages(input: PlanInput, m: Measurer): SewingSpecPlan {
  const specRowH = input.instructions.map((it) => instructionRowHeight(m, it))
  /** つづきのページでは仕様の値が全幅になるので行の高さが変わる */
  const specRowContH = input.instructions.map((it) => instructionRowHeight(m, it, SPEC_VALUE_CONT_W))
  const accRowH = input.accessories.map((r) => accessoryRowHeight(m, r))
  const colorSpecH = colorSpecHeight(m, input)
  const hasAccessories = input.accessories.length > 0

  const pages: PlannedPage[] = []
  input.pages.forEach((page, pageIndex) => {
    if (page.kind === "process") {
      pages.push({ kind: "process", pageIndex })
      return
    }
    if (page.kind === "measure") {
      const keys: readonly string[] = MEASURE_INSTRUCTION_KEYS
      const rows = input.instructions.filter((it) => keys.includes(it.key)).map((it) => instructionRowHeight(m, it))
      const qs = quantityAndSpecHeight(quantityColumnHeight(m, input, page), rows)
      let firstSketchHeight: number | null = null
      if (page.sketchCount >= 2) {
        const avail = PAGE_BODY_H - qs - BLOCK_GAP * 2 // 2つの枠の marginBottom
        if (avail >= MEASURE_SKETCH_HEIGHT + MEASURE_IMAGE_MIN_HEIGHT) firstSketchHeight = MEASURE_SKETCH_HEIGHT
        else if (avail >= MEASURE_IMAGE_MIN_HEIGHT * 2) firstSketchHeight = avail - MEASURE_IMAGE_MIN_HEIGHT
        else firstSketchHeight = Math.max(1, Math.floor(avail / 2))
      }
      pages.push({ kind: "measure", pageIndex, firstSketchHeight })
      return
    }

    // ---- sewing: 1枚目
    const qtyH = quantityColumnHeight(m, input, page)
    const fixedH = SKETCH_MIN_HEIGHT + BLOCK_GAP
    // 仕様: 全項目が入るか。入らなければ入る項目まで（付属の見出し行の分は先に取っておく）
    let instructionCount = input.instructions.length
    const accHeadReserve = hasAccessories ? ACC_HEAD_H + ACC_TAIL_H : ACC_HEAD_H + ROW_MIN_HEIGHT + ACC_TAIL_H
    while (
      instructionCount > 0 &&
      fixedH + quantityAndSpecHeight(qtyH, specRowH.slice(0, instructionCount)) + accHeadReserve > PAGE_BODY_H
    ) {
      instructionCount -= 1
    }
    let used = fixedH + quantityAndSpecHeight(qtyH, specRowH.slice(0, instructionCount)) + ACC_HEAD_H + ACC_TAIL_H
    // 付属: 入る行まで（最大 15）
    let accEnd = 0
    while (accEnd < input.accessories.length && accEnd < MAIN_ACCESSORY_ROWS_MAX && used + accRowH[accEnd] <= PAGE_BODY_H) {
      used += accRowH[accEnd]
      accEnd += 1
    }
    if (!hasAccessories) used += ROW_MIN_HEIGHT // 「BOM が未登録です」の行
    const allAccOnMain = accEnd === input.accessories.length
    const colorSpecOnMain = allAccOnMain && colorSpecH > 0 && used + colorSpecH <= PAGE_BODY_H

    // ---- つづきのページ（仕様の残り → 付属の残り → 色ごとの指定）
    type Cont = { instructionRange: [number, number] | null; accessoryRange: [number, number] | null; colorSpec: boolean }
    const conts: Cont[] = []
    let instrPos = instructionCount
    let accPos = accEnd
    const needColorSpec = colorSpecH > 0 && !colorSpecOnMain
    let colorSpecPlaced = !needColorSpec
    while (instrPos < input.instructions.length || accPos < input.accessories.length || !colorSpecPlaced) {
      let left = PAGE_BODY_H
      const cont: Cont = { instructionRange: null, accessoryRange: null, colorSpec: false }
      if (instrPos < input.instructions.length) {
        let end = instrPos
        let h = SECTION_TITLE_H + TABLE_BORDER_TOP + BLOCK_GAP
        while (end < input.instructions.length && h + specRowContH[end] <= left) {
          h += specRowContH[end]
          end += 1
        }
        if (end === instrPos) end = instrPos + 1 // 1行が1ページより高い（まず無い）ときも必ず進める
        cont.instructionRange = [instrPos, end]
        instrPos = end
        left -= h
      }
      if (accPos < input.accessories.length && left > ACC_HEAD_H + ACC_TAIL_H) {
        let end = accPos
        let h = ACC_HEAD_H + ACC_TAIL_H
        while (end < input.accessories.length && h + accRowH[end] <= left) {
          h += accRowH[end]
          end += 1
        }
        if (end === accPos && cont.instructionRange === null) end = accPos + 1
        if (end > accPos) {
          cont.accessoryRange = [accPos, end]
          accPos = end
          left -= h
        }
      }
      if (!colorSpecPlaced && accPos >= input.accessories.length && instrPos >= input.instructions.length) {
        if (colorSpecH <= left || (cont.instructionRange === null && cont.accessoryRange === null)) {
          cont.colorSpec = true
          colorSpecPlaced = true
        }
      }
      conts.push(cont)
      if (conts.length > 100) break // 安全弁
    }

    const total = 1 + conts.length
    const spilledAcc = input.accessories.length - accEnd
    const accessoryNote =
      spilledAcc > 0 ? `つづきは次のページ（付属 ${spilledAcc} 行）` : needColorSpec ? "色ごとの指定は次のページ" : null
    pages.push({
      kind: "sewing-main",
      pageIndex,
      instructionCount,
      accessoryRange: [0, accEnd],
      colorSpec: colorSpecOnMain,
      instructionNote: instructionCount < input.instructions.length ? "つづきは次のページ" : null,
      accessoryNote,
      booklet: { index: 1, total },
    })
    conts.forEach((c, i) => {
      pages.push({ kind: "sewing-cont", pageIndex, ...c, booklet: { index: i + 2, total } })
    })
  })

  return {
    pages,
    wrap: {
      specValue: m.wrapFor(SPEC_VALUE_W),
      specValueCont: m.wrapFor(SPEC_VALUE_CONT_W),
      accPart: m.wrapFor(ACC_W.part),
      accCode: m.wrapFor(ACC_W.code),
      accSpec: m.wrapFor(ACC_W.spec),
      accUsage: m.wrapFor(ACC_W.usage),
      accSupplier: m.wrapFor(ACC_W.supplier),
    },
  }
}
