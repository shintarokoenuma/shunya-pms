import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { issuerAddressLine, issuerTelFaxLine, joinFullWidth, labelMail } from "@/lib/company-issuer"
import type {
  SewingSpecAccessoryRow,
  SewingSpecPage,
  SewingSpecPdfData,
  SewingSpecSketch,
} from "./sewing-spec-data"
import type { SewingSpecPageKind } from "./sewing-spec-format"
import {
  ACC_W,
  BLOCK_GAP,
  CELL_PAD_H,
  CW_PART_W,
  FULL_LINE_HEIGHT,
  HEADER_BAND_H,
  HEADER_PARTIES_H,
  HEADER_TITLE_ROW_H,
  HEADER_TITLE_ROW_MB,
  MEASURE_INSTRUCTION_KEYS,
  PAGE_H,
  PAGE_PAD,
  PAGE_W,
  ROW_MIN_HEIGHT,
  TABLE_FONT_SIZE,
  TH_H,
  type PlannedPage,
  type SewingSpecPlan,
  type WrapCallback,
} from "./sewing-spec-layout"

registerPdfFonts()

/**
 * B-054 PR-4a/4b: 縫製仕様書 PDF。
 * 紙面は仕様確認書 v1.0 D-1〜D-21・addendum v0.1 D-22〜D-26・v0.2 D-27〜D-35・v0.3 D-36〜D-44 のとおり。
 * - 用紙は JIS B4 縦（257 × 364mm）を寸法で指定（D-24）。size="B4" は ISO B4 なので使わない
 * - 1ページ1宛先（D-8）。約束納期は載せない（D-3）。工場には希望納期のみ（値は太字・D-39）
 * - 1枚目（縫製工場用）: 絵型・数量・仕様・付属（案B・D-37）。付属が1枚目に入らなければ「付属のつづき」（D-38・D-44）
 * - B-267: 仕様の値・付属の 部位/品番/仕様/用尺/手配 は「…」で切らず全文を折り返す（B-054 D-41 を B-267 D-1 で置き換え）。
 *   1枚目に入る分はページの計画（sewing-spec-layout.ts の planSewingPages）で高さから決め、残りはつづきのページへ。
 *   縫製工場あての分が2枚以上なら「全N枚綴り k枚目」の札と「つづきは次のページ」の案内を出す（B-267 D-8）。
 *   ★紙面の寸法・余白・行の高さ・列の幅の数値は sewing-spec-layout.ts と共有する（ここで直書きしない）
 * - 2枚目（採寸用）: 数量・仕様3項目・採寸位置の絵型・サイズ表の画像
 * - 3枚目（加工工場用）: 加工指示・画像（最大4・2列）。宛先が SEWING の WO なら「詳細図」（表題を変え・加工指示なし・D-71）
 * - 絵型は残りの高さを埋める（height:0 ＋ flexGrow。D-6「その分、絵型を大きくする」）
 * - ページ番号は出力した全ページ（付属のつづきを含む）の通し番号（D-33）
 */
const B4_JIS: [number, number] = [PAGE_W, PAGE_H]

/** 「色別（下表）」の色（D-37） */
const COLOR_REF = "#23507A"

const PAGE_TITLES: Record<SewingSpecPageKind, string> = {
  sewing: "縫製仕様書（縫製工場用）",
  measure: "縫製仕様書（採寸用）",
  process: "縫製仕様書（加工工場用）",
}
/** 3枚目の宛先が縫製 WO のとき（D-71）: 縫製工場あての詳細図 */
const DETAIL_PAGE_TITLE = "縫製仕様書（詳細図）"

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    paddingTop: PAGE_PAD,
    paddingBottom: PAGE_PAD,
    paddingHorizontal: PAGE_PAD,
    color: "#1a1a1a",
    flexDirection: "column",
  },
  bold: { fontWeight: "bold" },
  label: { color: "#666" },
  small: { fontSize: 8, color: "#444" },
  // 1. 表題の行（D-40）。B-267: 高さを明示（ページの計画と同じ値）
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: HEADER_TITLE_ROW_H,
    marginBottom: HEADER_TITLE_ROW_MB,
  },
  titleLeft: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "bold", letterSpacing: 1 },
  kindBadge: {
    marginLeft: 10,
    paddingVertical: 1,
    paddingHorizontal: 6,
    border: "1pt solid #1a1a1a",
    fontSize: 10,
    fontWeight: "bold",
  },
  docMeta: { fontSize: 9 },
  // 2. 宛先枠・弊社枠（3段・padding 4・行間 1.2）。★2枠は width 49% ＋ space-between なので間に 2% の隙間ができる
  //    B-267: 高さを明示（「ご担当」が無くても同じ高さ）
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: BLOCK_GAP },
  box: { width: "49%", height: HEADER_PARTIES_H, border: "0.5pt solid #888", padding: 4, lineHeight: 1.2 },
  recipientName: { fontSize: 12, fontWeight: "bold" },
  ourRow1: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  ourName: { fontSize: 9, fontWeight: "bold" },
  ourStaff: { fontSize: 9 },
  // 3. 品番の帯（2段・4b）。B-267: 高さを明示
  band: {
    height: HEADER_BAND_H,
    borderTop: "1pt solid #1a1a1a",
    borderBottom: "1pt solid #1a1a1a",
    paddingVertical: 3,
    marginBottom: BLOCK_GAP,
  },
  bandRow1: { flexDirection: "row", alignItems: "baseline" },
  bandCode: { fontSize: 14, fontWeight: "bold", marginRight: 12 },
  bandName: { fontSize: 11, fontWeight: "bold", flexShrink: 1 },
  bandRow2: { flexDirection: "row", alignItems: "baseline", marginTop: 2 },
  bandItem: { marginRight: 14 },
  // 4. 絵型（残りの高さを埋める・画像の高さで伸びない）。B-267 D-3: 1枚目は最低の高さまで縮む（計画がその分を空けておく）
  sketchBox: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0,
    overflow: "hidden",
    border: "0.5pt solid #bbb",
    padding: 4,
    marginBottom: BLOCK_GAP,
    justifyContent: "center",
    alignItems: "center",
  },
  /** 2枚目で画像が2つのとき: 採寸位置の絵型は固定の高さ（値は計画から・B-267 D-11） */
  sketchBoxFixed: {
    overflow: "hidden",
    border: "0.5pt solid #bbb",
    padding: 4,
    marginBottom: BLOCK_GAP,
    justifyContent: "center",
    alignItems: "center",
  },
  sketchImgWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, width: "100%", overflow: "hidden" },
  // ★react-pdf の Image は固有サイズで測られ、height:"100%" / maxHeight / flexBasis では縮まない
  //   （2026-09-21 に6通りを実測。1ページに収まるのは height: 0 ＋ flexGrow 1 ＋ flexShrink 1 だけ）
  sketchImg: { width: "100%", height: 0, flexGrow: 1, flexShrink: 1, objectFit: "contain" },
  caption: { fontSize: 8, color: "#444", marginTop: 2 },
  // 3枚目: 画像を2列に並べる（残りの高さいっぱい）
  gridBox: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, overflow: "hidden", flexDirection: "column" },
  gridRow: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: BLOCK_GAP,
  },
  gridCell: {
    width: "49.5%",
    minHeight: 0,
    overflow: "hidden",
    border: "0.5pt solid #bbb",
    padding: 4,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  gridCellFull: {
    width: "100%",
    minHeight: 0,
    overflow: "hidden",
    border: "0.5pt solid #bbb",
    padding: 4,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  gridCellEmpty: { width: "49.5%" },
  // 5. 数量・仕様
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: BLOCK_GAP },
  col: { width: "49%" },
  sectionTitle: { fontSize: 10, fontWeight: "bold", borderBottom: "0.5pt solid #888", marginBottom: 2 },
  /** B-267 D-8: 見出しの右に「つづきは次のページ」の案内 */
  sectionTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "0.5pt solid #888",
    marginBottom: 2,
  },
  sectionTitleText: { fontSize: 10, fontWeight: "bold" },
  sectionNote: { fontSize: 8, color: COLOR_REF, fontWeight: "bold" },
  table: { borderTop: "0.5pt solid #888", marginBottom: BLOCK_GAP },
  // B-267: 複数行のセルがあるとき項目名が上に揃うよう flex-start
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #ccc", minHeight: ROW_MIN_HEIGHT, alignItems: "flex-start" },
  th: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottom: "0.5pt solid #888",
    minHeight: TH_H,
    alignItems: "center",
    fontWeight: "bold",
  },
  trTotal: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #888",
    minHeight: ROW_MIN_HEIGHT,
    alignItems: "center",
    fontWeight: "bold",
  },
  cell: { paddingHorizontal: CELL_PAD_H, fontSize: TABLE_FONT_SIZE },
  cellRight: { paddingHorizontal: CELL_PAD_H, fontSize: TABLE_FONT_SIZE, textAlign: "right" },
  /** B-267 D-1: 全文のセル。行間を明示（ページの計画と同じ値）・maxLines なし */
  fullCell: { paddingHorizontal: CELL_PAD_H, fontSize: TABLE_FONT_SIZE, lineHeight: FULL_LINE_HEIGHT },
  specLabel: { width: "36%", paddingHorizontal: CELL_PAD_H, fontSize: TABLE_FONT_SIZE, color: "#444" },
  specValue: { width: "64%" },
  orderQty: { marginTop: 3, fontSize: 10 },
  // 3枚目: 加工指示（3行）
  procLabel: { width: "18%", paddingHorizontal: 3, fontSize: 10, color: "#444" },
  procValue: { width: "82%", paddingHorizontal: 3, fontSize: 10 },
  // 6. 付属（D-37: 部位 22 / 品番 12 / 仕様 22 / 色 14 / 用尺 8 / 手配 22 ＝ 100%）。幅の値は sewing-spec-layout.ts から
  accPart: { width: ACC_W.part },
  accCode: { width: ACC_W.code },
  accSpec: { width: ACC_W.spec },
  accColor: { width: ACC_W.color },
  accUsage: { width: ACC_W.usage },
  accSupplier: { width: ACC_W.supplier },
  colorRef: { color: COLOR_REF, fontWeight: "bold" },
  // 7. 色ごとの指定（部位 20% ＋ カラーウェイで残りを等分）
  cwPart: { width: CW_PART_W },
})

/**
 * 表のセル。1行固定・はみ出しは「…」（react-pdf 4.5.1 では maxLines は prop ではなく style）。
 * B-267 D-2: 見出し行・仕様の項目名・付属の色の欄・数量表の数・3枚目の加工指示・品番の帯に残す
 */
const ONE_LINE = { maxLines: 1, textOverflow: "ellipsis" } as const
function Cell({ style, children }: { style: object | object[]; children: string }) {
  const s = Array.isArray(style) ? [...style, ONE_LINE] : [style, ONE_LINE]
  return <Text style={s as never}>{children}</Text>
}

/** 色ごとの指定の見出しとセルは2行まで折り返す（D-41）。2行でも収まらない分だけ末尾を「…」 */
const TWO_LINES = { maxLines: 2, textOverflow: "ellipsis" } as const
function ColorCell({ style, children }: { style: object | object[]; children: string }) {
  const s = Array.isArray(style) ? [...style, TWO_LINES] : [style, TWO_LINES]
  return <Text style={s as never}>{children}</Text>
}

/**
 * B-267 D-1・D-10: 全文のセル。「…」で切らず全文を折り返す。折り方（英数字のかたまりを折らない）は
 * ページの計画と同じ hyphenationCallback（plan.wrap）を渡し、計算と描画を一致させる
 */
function FullCell({ style, wrap, children }: { style: object | object[]; wrap: WrapCallback; children: string }) {
  const s = Array.isArray(style) ? [styles.fullCell, ...style] : [styles.fullCell, style]
  return (
    <Text style={s as never} hyphenationCallback={wrap}>
      {children}
    </Text>
  )
}

/** 節の見出し（右に案内を出せる・B-267 D-8） */
function SectionTitle({ title, note }: { title: string; note?: string | null }) {
  if (!note) return <Text style={styles.sectionTitle}>{title}</Text>
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      <Text style={styles.sectionNote}>{note}</Text>
    </View>
  )
}

/** 絵型1枚（枠の残りの高さに収める）。画像が読めなければ文言、キャプションがあれば下に */
function SketchImage({ sketch, emptyText }: { sketch: SewingSpecSketch | null; emptyText: string }) {
  if (!sketch) return <Text style={styles.small}>{emptyText}</Text>
  return (
    <>
      {sketch.image ? (
        <View style={styles.sketchImgWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf の Image は HTML の img ではなく alt を持たない */}
          <Image src={sketch.image} style={styles.sketchImg} />
        </View>
      ) : (
        <Text style={styles.small}>絵型を読み込めませんでした</Text>
      )}
      {sketch.caption ? <Text style={styles.caption}>{sketch.caption}</Text> : null}
    </>
  )
}

function SkuMatrix({ data }: { data: SewingSpecPdfData }) {
  const m = data.skuMatrix
  if (!m) return <Text style={styles.cell}>SKU が未登録です</Text>
  const colW = `${Math.max(7, Math.floor(54 / Math.max(1, m.sizes.length)))}%`
  const labelW = "34%"
  const totalW = "12%"
  return (
    <View style={styles.table}>
      <View style={styles.th}>
        <Cell style={[styles.cell, { width: labelW }]}>カラー</Cell>
        {m.sizes.map((s) => (
          <Cell key={s} style={[styles.cellRight, { width: colW }]}>
            {s}
          </Cell>
        ))}
        <Cell style={[styles.cellRight, { width: totalW }]}>計</Cell>
      </View>
      {m.rows.map((r, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <ColorCell style={[styles.cell, { width: labelW }]}>{r.colorLabel}</ColorCell>
          {r.cells.map((c, j) => (
            <Cell key={j} style={[styles.cellRight, { width: colW }]}>
              {c.toLocaleString("ja-JP")}
            </Cell>
          ))}
          <Cell style={[styles.cellRight, { width: totalW }]}>{r.total.toLocaleString("ja-JP")}</Cell>
        </View>
      ))}
      <View style={styles.trTotal} wrap={false}>
        <Cell style={[styles.cell, { width: labelW }]}>合計</Cell>
        {m.colTotals.map((c, j) => (
          <Cell key={j} style={[styles.cellRight, { width: colW }]}>
            {c.toLocaleString("ja-JP")}
          </Cell>
        ))}
        <Cell style={[styles.cellRight, { width: totalW }]}>{m.grandTotal.toLocaleString("ja-JP")}</Cell>
      </View>
    </View>
  )
}

/** 仕様（縫製指示）の行。項目名は1行固定、値は全文（B-267 D-1） */
function InstructionRows({ rows, wrap }: { rows: SewingSpecPdfData["instructions"]; wrap: WrapCallback }) {
  return (
    <View style={styles.table}>
      {rows.map((it, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <Cell style={styles.specLabel}>{it.label}</Cell>
          <FullCell style={styles.specValue} wrap={wrap}>
            {it.value}
          </FullCell>
        </View>
      ))}
    </View>
  )
}

/** 数量（出し分け D-27）と仕様（縫製指示）の2列。instructions はこのページに出す項目（計画で決める） */
function QuantityAndSpec({
  data,
  page,
  instructions,
  instructionNote,
  wrap,
}: {
  data: SewingSpecPdfData
  page: SewingSpecPage
  instructions: SewingSpecPdfData["instructions"]
  instructionNote?: string | null
  wrap: WrapCallback
}) {
  return (
    <View style={styles.twoCol}>
      <View style={styles.col}>
        <Text style={styles.sectionTitle}>数量</Text>
        {page.quantityMode === "sku-matrix" ? <SkuMatrix data={data} /> : null}
        <Text style={styles.orderQty}>
          {`この発注 ${page.orderQuantity.toLocaleString("ja-JP")} ${page.orderUnit}`}
        </Text>
      </View>
      <View style={styles.col}>
        <SectionTitle title="仕様（縫製指示）" note={instructionNote} />
        {instructions.length === 0 ? <Text style={styles.cell}>—</Text> : <InstructionRows rows={instructions} wrap={wrap} />}
      </View>
    </View>
  )
}

/** B-267 D-5: つづきのページの先頭に出す「仕様（縫製指示）（つづき）」 */
function InstructionContinuation({ rows, wrap }: { rows: SewingSpecPdfData["instructions"]; wrap: WrapCallback }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>仕様（縫製指示）（つづき）</Text>
      <InstructionRows rows={rows} wrap={wrap} />
    </View>
  )
}

/** 色が変わる行の色の欄。色ごとの指定が同じページにあれば「色別（下表）」、無ければ「色別（別紙）」 */
type ColorRefLabel = "色別（下表）" | "色別（別紙）"

/** 付属の本表（案B）。色の欄は「色別（下表／別紙）」か「全色共通（…）」。B-267: 部位・品番・仕様・用尺/数・手配は全文 */
function AccessoryTable({
  rows,
  title,
  note,
  colorRefLabel,
  wrap,
  noAccessories,
}: {
  rows: SewingSpecAccessoryRow[]
  title: string
  note?: string | null
  colorRefLabel: ColorRefLabel
  wrap: SewingSpecPlan["wrap"]
  /** 付属が1行も無い品番のときだけ「BOM が未登録です」を出す（行を全部つづきへ送った1枚目では出さない・D-5 の補足） */
  noAccessories: boolean
}) {
  return (
    <View>
      <SectionTitle title={title} note={note} />
      <View style={styles.table}>
        <View style={styles.th}>
          <Cell style={[styles.cell, styles.accPart]}>部位</Cell>
          <Cell style={[styles.cell, styles.accCode]}>品番</Cell>
          <Cell style={[styles.cell, styles.accSpec]}>仕様</Cell>
          <Cell style={[styles.cell, styles.accColor]}>色</Cell>
          <Cell style={[styles.cell, styles.accUsage]}>用尺/数</Cell>
          <Cell style={[styles.cell, styles.accSupplier]}>手配</Cell>
        </View>
        {rows.length === 0 ? (
          noAccessories ? (
            <View style={styles.tr}>
              <Text style={styles.cell}>BOM が未登録です</Text>
            </View>
          ) : null
        ) : (
          rows.map((r, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <FullCell style={styles.accPart} wrap={wrap.accPart}>
                {r.part}
              </FullCell>
              <FullCell style={styles.accCode} wrap={wrap.accCode}>
                {r.itemCode}
              </FullCell>
              <FullCell style={styles.accSpec} wrap={wrap.accSpec}>
                {r.spec}
              </FullCell>
              {r.colors.length > 0 ? (
                <Cell style={[styles.cell, styles.accColor, styles.colorRef]}>{colorRefLabel}</Cell>
              ) : (
                <Cell style={[styles.cell, styles.accColor]}>
                  {r.commonColor ? `全色共通（${r.commonColor}）` : "全色共通"}
                </Cell>
              )}
              <FullCell style={styles.accUsage} wrap={wrap.accUsage}>
                {r.usage}
              </FullCell>
              <FullCell style={styles.accSupplier} wrap={wrap.accSupplier}>
                {r.supplier}
              </FullCell>
            </View>
          ))
        )}
      </View>
    </View>
  )
}

/** 色ごとの指定（色が変わる付属だけ）。1行も無ければ表ごと出さない */
function ColorSpecTable({ rows, colorwayNames }: { rows: SewingSpecAccessoryRow[]; colorwayNames: string[] }) {
  const colored = rows.filter((r) => r.colors.length > 0)
  if (colored.length === 0 || colorwayNames.length === 0) return null
  const colW = `${Math.floor(80 / colorwayNames.length)}%`
  return (
    <View>
      <Text style={styles.sectionTitle}>色ごとの指定（色が変わる付属のみ）</Text>
      <View style={styles.table}>
        <View style={styles.th}>
          <Cell style={[styles.cell, styles.cwPart]}>部位</Cell>
          {colorwayNames.map((c, j) => (
            <ColorCell key={j} style={[styles.cell, { width: colW }]}>
              {c}
            </ColorCell>
          ))}
        </View>
        {colored.map((r, i) => (
          <View key={i} style={styles.tr} wrap={false}>
            <Cell style={[styles.cell, styles.cwPart]}>{r.part}</Cell>
            {r.colors.map((c, j) => (
              <ColorCell key={j} style={[styles.cell, { width: colW }]}>
                {c}
              </ColorCell>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}

/** 表題・宛先枠・弊社枠・品番の帯（全ページ共通・D-40・帯は2段） */
function HeaderBlock({
  data,
  page,
  title,
  pageNo,
  pageTotal,
  booklet,
}: {
  data: SewingSpecPdfData
  page: SewingSpecPage
  title: string
  pageNo: number
  pageTotal: number
  /** B-267 D-8: 縫製工場あての分が2枚以上のとき「全N枚綴り k枚目」。右上の n / N は文書全体の通し番号のまま */
  booklet?: { index: number; total: number }
}) {
  return (
    <View>
      {/* 1. 表題＋区分の札（＋綴りの札）＋発行日・ページ（1行） */}
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <Text style={styles.title}>{title}</Text>
          {page.kindLabel ? <Text style={styles.kindBadge}>{page.kindLabel}</Text> : null}
          {booklet && booklet.total >= 2 ? (
            <Text style={styles.kindBadge}>{`全${booklet.total}枚綴り ${booklet.index}枚目`}</Text>
          ) : null}
        </View>
        <Text style={styles.docMeta}>{`発行日 ${data.issuedDate}　${pageNo} / ${pageTotal}`}</Text>
      </View>

      {/* 2. 宛先枠（3段）／弊社枠（3段） */}
      <View style={styles.partiesRow}>
        <View style={styles.box}>
          <Text style={styles.recipientName}>{`${page.recipientName} 御中`}</Text>
          {page.contactName ? <Text>{`ご担当 ${page.contactName} 様`}</Text> : null}
          <Text>
            <Text style={styles.label}>職出し予定日 </Text>
            {page.plannedStartDate}
            {"　"}
            <Text style={styles.label}>希望納期 </Text>
            <Text style={styles.bold}>{page.expectedDeliveryDate}</Text>
          </Text>
        </View>
        <View style={styles.box}>
          <View style={styles.ourRow1}>
            <Text style={styles.ourName}>{data.issuer.name}</Text>
            <Text style={styles.ourStaff}>{`弊社担当 ${data.assignedToName}`}</Text>
          </View>
          <Text style={styles.small}>{issuerAddressLine(data.issuer)}</Text>
          <Text style={styles.small}>
            {joinFullWidth(issuerTelFaxLine(data.issuer), labelMail(data.issuer.email))}
          </Text>
        </View>
      </View>

      {/* 3. 品番の帯（2段。約束納期は載せない） */}
      <View style={styles.band}>
        <View style={styles.bandRow1}>
          <Text style={styles.bandCode}>{data.productCode}</Text>
          <Cell style={styles.bandName}>{data.productName}</Cell>
        </View>
        <View style={styles.bandRow2}>
          <Text style={styles.bandItem}>
            <Text style={styles.label}>ブランド </Text>
            {data.brandName}
          </Text>
          <Text style={styles.bandItem}>
            <Text style={styles.label}>先方品番 </Text>
            {data.clientProductCode}
          </Text>
          <Text style={styles.bandItem}>
            <Text style={styles.label}>パターンNO </Text>
            {data.patternNumber}
          </Text>
          <Text style={styles.bandItem}>
            <Text style={styles.label}>型紙 </Text>
            {page.patternLabel}
          </Text>
        </View>
      </View>
    </View>
  )
}

/**
 * 1枚目（縫製工場用）。B-267: 仕様・付属はページの計画（plan）で決めた分だけ出す。
 * 色ごとの指定は付属が全部入り、かつ入るときだけ（入らなければ最後のつづきページに1回）
 */
function SewingMainPage({
  data,
  page,
  planned,
  wrap,
  pageNo,
  pageTotal,
}: {
  data: SewingSpecPdfData
  page: SewingSpecPage
  planned: Extract<PlannedPage, { kind: "sewing-main" }>
  wrap: SewingSpecPlan["wrap"]
  pageNo: number
  pageTotal: number
}) {
  const instructions = data.instructions.slice(0, planned.instructionCount)
  const rows = data.accessories.slice(planned.accessoryRange[0], planned.accessoryRange[1])
  return (
    // ★Page に wrap={false} を付けると react-pdf は Page の高さを内容に合わせて伸ばす（実測 1840pt）。
    //   wrap は既定のままにし、絵型の枠（flexBasis 0）で残りの高さを吸収する。
    //   B-267 D-7: 計画が絵型の最低の高さ（SKETCH_MIN_HEIGHT）を空けておくので、表が伸びても自動改ページは起きない
    <Page size={B4_JIS} style={styles.page}>
      <HeaderBlock
        data={data}
        page={page}
        title={PAGE_TITLES.sewing}
        pageNo={pageNo}
        pageTotal={pageTotal}
        booklet={planned.booklet}
      />

      {/* 4. 絵型（残りの高さいっぱい。計画が最低の高さ SKETCH_MIN_HEIGHT を空けておく） */}
      <View style={styles.sketchBox}>
        <SketchImage sketch={page.sketches[0] ?? null} emptyText="絵型が未登録です" />
      </View>

      {/* 5. 数量／仕様（入らない項目はつづきのページへ・D-5） */}
      <QuantityAndSpec
        data={data}
        page={page}
        instructions={instructions}
        instructionNote={planned.instructionNote}
        wrap={wrap.specValue}
      />

      {/* 6. 付属（案B）＋ 7. 色ごとの指定（入るときだけ。入らなければ最後のつづきページにまとめる） */}
      <AccessoryTable
        rows={rows}
        title="付属"
        note={planned.accessoryNote}
        colorRefLabel={planned.colorSpec ? "色別（下表）" : "色別（別紙）"}
        wrap={wrap}
        noAccessories={data.accessories.length === 0}
      />
      {planned.colorSpec ? <ColorSpecTable rows={data.accessories} colorwayNames={data.colorwayNames} /> : null}
    </Page>
  )
}

/**
 * つづきのページ（D-38・B-267 D-6）。ヘッダーは1枚目と同じ。絵型・数量は出さない。
 * （仕様のつづき →）付属（つづき）→ 最後のページだけ色ごとの指定
 */
function SewingContinuationPage({
  data,
  page,
  planned,
  wrap,
  pageNo,
  pageTotal,
}: {
  data: SewingSpecPdfData
  page: SewingSpecPage
  planned: Extract<PlannedPage, { kind: "sewing-cont" }>
  wrap: SewingSpecPlan["wrap"]
  pageNo: number
  pageTotal: number
}) {
  const instructions = planned.instructionRange
    ? data.instructions.slice(planned.instructionRange[0], planned.instructionRange[1])
    : []
  const rows = planned.accessoryRange ? data.accessories.slice(planned.accessoryRange[0], planned.accessoryRange[1]) : []
  return (
    <Page size={B4_JIS} style={styles.page}>
      <HeaderBlock
        data={data}
        page={page}
        title={PAGE_TITLES.sewing}
        pageNo={pageNo}
        pageTotal={pageTotal}
        booklet={planned.booklet}
      />
      {instructions.length > 0 ? <InstructionContinuation rows={instructions} wrap={wrap.specValueCont} /> : null}
      {planned.accessoryRange ? (
        <AccessoryTable
          rows={rows}
          title="付属（つづき）"
          colorRefLabel={planned.colorSpec ? "色別（下表）" : "色別（別紙）"}
          wrap={wrap}
          noAccessories={false}
        />
      ) : null}
      {planned.colorSpec ? <ColorSpecTable rows={data.accessories} colorwayNames={data.colorwayNames} /> : null}
    </Page>
  )
}

/**
 * 2枚目（採寸用・4b）。宛先は SEWING か INSPECTION の WO。
 * 数量と仕様（3項目）→ 採寸位置の絵型（1つ目）→ サイズ表の画像（2つ目・残りの高さいっぱい）。
 * 画像が1つだけなら、その絵型が残りの高さいっぱいを使う。付属と色ごとの指定は出さない。
 */
function MeasurePage({
  data,
  page,
  planned,
  wrap,
  pageNo,
  pageTotal,
}: {
  data: SewingSpecPdfData
  page: SewingSpecPage
  planned: Extract<PlannedPage, { kind: "measure" }>
  wrap: WrapCallback
  pageNo: number
  pageTotal: number
}) {
  const [first, second] = page.sketches
  const keys: readonly string[] = MEASURE_INSTRUCTION_KEYS
  const instructions = data.instructions.filter((it) => keys.includes(it.key))
  return (
    <Page size={B4_JIS} style={styles.page}>
      <HeaderBlock data={data} page={page} title={PAGE_TITLES.measure} pageNo={pageNo} pageTotal={pageTotal} />
      {/* B-267 D-11: 仕様3項目は全文。伸びた分は画像が縮む（採寸位置の絵型の高さは計画から） */}
      <QuantityAndSpec data={data} page={page} instructions={instructions} wrap={wrap} />
      {second ? (
        <>
          <View style={[styles.sketchBoxFixed, { height: planned.firstSketchHeight ?? MEASURE_SKETCH_FALLBACK }]}>
            <SketchImage sketch={first} emptyText="絵型が未登録です" />
          </View>
          <View style={styles.sketchBox}>
            <SketchImage sketch={second} emptyText="サイズ表の画像がありません" />
          </View>
        </>
      ) : (
        <View style={styles.sketchBox}>
          <SketchImage sketch={first ?? null} emptyText="絵型が未登録です" />
        </View>
      )}
    </Page>
  )
}

/** 3枚目の画像（最大4）。1枚＝全面／2枚＝左右／3〜4枚＝2×2（3枚は右下が空く）。クエリの順に左上から */
function ImageGrid({ sketches }: { sketches: SewingSpecSketch[] }) {
  const n = sketches.length
  if (n === 0) {
    return (
      <View style={[styles.gridBox, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.small}>絵型が未登録です</Text>
      </View>
    )
  }
  if (n === 1) {
    return (
      <View style={styles.gridBox}>
        <View style={styles.gridRow}>
          <View style={styles.gridCellFull}>
            <SketchImage sketch={sketches[0]} emptyText="" />
          </View>
        </View>
      </View>
    )
  }
  const rows = n === 2 ? [sketches] : [sketches.slice(0, 2), sketches.slice(2, 4)]
  return (
    <View style={styles.gridBox}>
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row.map((s, j) => (
            <View key={j} style={styles.gridCell}>
              <SketchImage sketch={s} emptyText="" />
            </View>
          ))}
          {row.length === 1 ? <View style={styles.gridCellEmpty} /> : null}
        </View>
      ))}
    </View>
  )
}

/**
 * 3枚目（加工工場用・4b）。宛先は加工の WO（PRINTING / EMBROIDERY / WASHING / DYEING / FINISHING）。
 * 加工指示（加工・数量・位置・版・色）→ 画像を2列で（残りの高さいっぱい）。
 * ★宛先が SEWING の WO なら「縫製仕様書（詳細図）」（D-71）: 加工指示は出さず、帯のすぐ下から画像を2列で。
 */
function ProcessPage({
  data,
  page,
  pageNo,
  pageTotal,
}: {
  data: SewingSpecPdfData
  page: SewingSpecPage
  pageNo: number
  pageTotal: number
}) {
  const isDetail = page.workType === "SEWING"
  const rows: [string, string][] = [
    ["加工", page.workTypeLabel],
    ["数量", `この発注 ${page.orderQuantity.toLocaleString("ja-JP")} ${page.orderUnit}`],
    ["位置・版・色", "絵型と追加画像のとおり"],
  ]
  return (
    <Page size={B4_JIS} style={styles.page}>
      <HeaderBlock
        data={data}
        page={page}
        title={isDetail ? DETAIL_PAGE_TITLE : PAGE_TITLES.process}
        pageNo={pageNo}
        pageTotal={pageTotal}
      />
      {isDetail ? null : (
        <>
          <Text style={styles.sectionTitle}>加工指示</Text>
          <View style={styles.table}>
            {rows.map(([label, value], i) => (
              <View key={i} style={styles.tr} wrap={false}>
                <Cell style={styles.procLabel}>{label}</Cell>
                <Cell style={styles.procValue}>{value}</Cell>
              </View>
            ))}
          </View>
        </>
      )}
      <ImageGrid sketches={page.sketches} />
    </Page>
  )
}

/** 2枚目で計画が無いとき（通常は無い）の採寸位置の絵型の高さ */
const MEASURE_SKETCH_FALLBACK = 230

/**
 * B-267: 物理ページは render.tsx が立てた計画（planSewingPages）のとおりに描く（ページ番号は全ページの通し・D-33）。
 * 行数で区切る展開（旧 buildPhysicalPages・MAIN_ACCESSORY_ROWS / CONT_ACCESSORY_ROWS）は計画に置き換えた
 */
export function SewingSpecDocument({ data, plan }: { data: SewingSpecPdfData; plan: SewingSpecPlan }) {
  const total = plan.pages.length
  return (
    <Document>
      {plan.pages.map((p, i) => {
        const pageNo = i + 1
        const page = data.pages[p.pageIndex]
        switch (p.kind) {
          case "sewing-main":
            return (
              <SewingMainPage key={i} data={data} page={page} planned={p} wrap={plan.wrap} pageNo={pageNo} pageTotal={total} />
            )
          case "sewing-cont":
            return (
              <SewingContinuationPage key={i} data={data} page={page} planned={p} wrap={plan.wrap} pageNo={pageNo} pageTotal={total} />
            )
          case "measure":
            return (
              <MeasurePage key={i} data={data} page={page} planned={p} wrap={plan.wrap.specValue} pageNo={pageNo} pageTotal={total} />
            )
          case "process":
            return <ProcessPage key={i} data={data} page={page} pageNo={pageNo} pageTotal={total} />
        }
      })}
    </Document>
  )
}
