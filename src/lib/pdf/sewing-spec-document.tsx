import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { COMPANY_PROFILE } from "@/lib/constants/company-profile"
import type { SewingSpecAccessoryRow, SewingSpecPage, SewingSpecPdfData } from "./sewing-spec-data"

registerPdfFonts()

/**
 * B-054 PR-4a: 縫製仕様書 PDF ― 1枚目（縫製工場用）。
 * 紙面は仕様確認書 v1.0 D-1〜D-21・addendum v0.1 D-22〜D-26・addendum v0.3 D-36〜D-43 のとおり。
 * - 用紙は JIS B4 縦（257 × 364mm）を寸法で指定（D-24）。size="B4" は ISO B4 なので使わない
 * - 1ページ1宛先（D-8）。約束納期は載せない（D-3）。工場には希望納期のみ（値は太字・D-39）
 * - 付属は案B（D-37）: 本表に「色別（下表）／全色共通」を書き、色が変わる行だけ「色ごとの指定」の表に出す
 * - 付属が 15 行を超えたら「付属のつづき」のページを足す（D-38）。ページ番号は通し
 * - 絵型が残りの高さを埋める（height:0 ＋ flexGrow。D-6「その分、絵型を大きくする」）
 */
const B4_JIS: [number, number] = [728.5, 1031.8]

/** 表（数量・仕様・付属）の文字の大きさ（2026-09-21 に 9pt / 8pt を比較し 9 を採用） */
const TABLE_FONT_SIZE = 9
const ROW_MIN_HEIGHT = 13
const BLOCK_GAP = 5
/** 1枚目に載せる付属の行数（D-38）／つづきのページ1枚あたりの行数 */
const MAIN_ACCESSORY_ROWS = 15
const CONT_ACCESSORY_ROWS = 50
/** 「色別（下表）」の色（D-37） */
const COLOR_REF = "#23507A"

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    color: "#1a1a1a",
    flexDirection: "column",
  },
  bold: { fontWeight: "bold" },
  label: { color: "#666" },
  small: { fontSize: 8, color: "#444" },
  // 1. 表題の行（D-40）
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
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
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: BLOCK_GAP },
  box: { width: "49%", border: "0.5pt solid #888", padding: 4, lineHeight: 1.2 },
  recipientName: { fontSize: 12, fontWeight: "bold" },
  ourRow1: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  ourName: { fontSize: 9, fontWeight: "bold" },
  ourStaff: { fontSize: 9 },
  // 3. 品番の帯
  band: {
    flexDirection: "row",
    alignItems: "baseline",
    borderTop: "1pt solid #1a1a1a",
    borderBottom: "1pt solid #1a1a1a",
    paddingVertical: 3,
    marginBottom: BLOCK_GAP,
  },
  bandCode: { fontSize: 15, fontWeight: "bold", marginRight: 16 },
  bandItem: { marginRight: 14 },
  // 4. 絵型（残りの高さを埋める・画像の高さで伸びない）
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
  sketchImgWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, width: "100%", overflow: "hidden" },
  // ★react-pdf の Image は固有サイズで測られ、height:"100%" / maxHeight / flexBasis では縮まない
  //   （2026-09-21 に6通りを実測。1ページに収まるのは height: 0 ＋ flexGrow 1 ＋ flexShrink 1 だけ）
  sketchImg: { width: "100%", height: 0, flexGrow: 1, flexShrink: 1, objectFit: "contain" },
  caption: { fontSize: 8, color: "#444", marginTop: 2 },
  // 5. 数量・仕様
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: BLOCK_GAP },
  col: { width: "49%" },
  sectionTitle: { fontSize: 10, fontWeight: "bold", borderBottom: "0.5pt solid #888", marginBottom: 2 },
  table: { borderTop: "0.5pt solid #888", marginBottom: BLOCK_GAP },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #ccc", minHeight: ROW_MIN_HEIGHT, alignItems: "center" },
  th: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottom: "0.5pt solid #888",
    minHeight: ROW_MIN_HEIGHT + 1,
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
  cell: { paddingHorizontal: 3, fontSize: TABLE_FONT_SIZE },
  cellRight: { paddingHorizontal: 3, fontSize: TABLE_FONT_SIZE, textAlign: "right" },
  specLabel: { width: "36%", paddingHorizontal: 3, fontSize: TABLE_FONT_SIZE, color: "#444" },
  specValue: { width: "64%", paddingHorizontal: 3, fontSize: TABLE_FONT_SIZE },
  orderQty: { marginTop: 3, fontSize: 10 },
  // 6. 付属（D-37: 部位 22 / 品番 12 / 仕様 22 / 色 14 / 用尺 8 / 手配 22 ＝ 100%）
  accPart: { width: "22%" },
  accCode: { width: "12%" },
  accSpec: { width: "22%" },
  accColor: { width: "14%" },
  accUsage: { width: "8%" },
  accSupplier: { width: "22%" },
  colorRef: { color: COLOR_REF, fontWeight: "bold" },
  // 7. 色ごとの指定（部位 20% ＋ カラーウェイで残りを等分）
  cwPart: { width: "20%" },
})

/** 表のセル。1行固定・はみ出しは「…」（react-pdf 4.5.1 では maxLines は prop ではなく style） */
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

/** 付属の本表（案B）。色の欄は「色別（下表）」か「全色共通（…）」 */
function AccessoryTable({ rows, title }: { rows: SewingSpecAccessoryRow[]; title: string }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
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
          <View style={styles.tr}>
            <Text style={styles.cell}>BOM が未登録です</Text>
          </View>
        ) : (
          rows.map((r, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <Cell style={[styles.cell, styles.accPart]}>{r.part}</Cell>
              <Cell style={[styles.cell, styles.accCode]}>{r.itemCode}</Cell>
              <Cell style={[styles.cell, styles.accSpec]}>{r.spec}</Cell>
              {r.colors.length > 0 ? (
                <Cell style={[styles.cell, styles.accColor, styles.colorRef]}>色別（下表）</Cell>
              ) : (
                <Cell style={[styles.cell, styles.accColor]}>
                  {r.commonColor ? `全色共通（${r.commonColor}）` : "全色共通"}
                </Cell>
              )}
              <Cell style={[styles.cell, styles.accUsage]}>{r.usage}</Cell>
              <Cell style={[styles.cell, styles.accSupplier]}>{r.supplier}</Cell>
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

/** 表題・宛先枠・弊社枠・品番の帯（1枚目とつづきのページで共通・D-40） */
function HeaderBlock({
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
  return (
    <View>
      {/* 1. 表題＋区分の札＋発行日・ページ（1行） */}
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <Text style={styles.title}>縫製仕様書（縫製工場用）</Text>
          {page.kindLabel ? <Text style={styles.kindBadge}>{page.kindLabel}</Text> : null}
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
            <Text style={styles.ourName}>{COMPANY_PROFILE.name}</Text>
            <Text style={styles.ourStaff}>{`弊社担当 ${data.assignedToName}`}</Text>
          </View>
          <Text style={styles.small}>{`${COMPANY_PROFILE.postalCode} ${COMPANY_PROFILE.address}`}</Text>
          <Text style={styles.small}>
            {`${COMPANY_PROFILE.tel}　${COMPANY_PROFILE.fax}　${COMPANY_PROFILE.email}`}
          </Text>
        </View>
      </View>

      {/* 3. 品番の帯（約束納期は載せない） */}
      <View style={styles.band}>
        <Text style={styles.bandCode}>{data.productCode}</Text>
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
  )
}

/** 1枚目（宛先ごと）。付属は 1〜15 行目 */
function MainPage({
  data,
  page,
  rows,
  pageNo,
  pageTotal,
}: {
  data: SewingSpecPdfData
  page: SewingSpecPage
  rows: SewingSpecAccessoryRow[]
  pageNo: number
  pageTotal: number
}) {
  return (
    // ★Page に wrap={false} を付けると react-pdf は Page の高さを内容に合わせて伸ばす（実測 1840pt）。
    //   wrap は既定のままにし、絵型の枠（flexBasis 0）で残りの高さを吸収する。
    <Page size={B4_JIS} style={styles.page}>
      <HeaderBlock data={data} page={page} pageNo={pageNo} pageTotal={pageTotal} />

      {/* 4. 絵型（残りの高さいっぱい） */}
      <View style={styles.sketchBox}>
        {page.sketch?.image ? (
          <View style={styles.sketchImgWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf の Image は HTML の img ではなく alt を持たない */}
            <Image src={page.sketch.image} style={styles.sketchImg} />
          </View>
        ) : (
          <Text style={styles.small}>
            {page.sketch ? "絵型を読み込めませんでした" : "絵型が未登録です"}
          </Text>
        )}
        {page.sketch?.caption ? <Text style={styles.caption}>{page.sketch.caption}</Text> : null}
      </View>

      {/* 5. 数量／仕様 */}
      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Text style={styles.sectionTitle}>数量</Text>
          {page.quantityMode === "sku-matrix" ? <SkuMatrix data={data} /> : null}
          <Text style={styles.orderQty}>
            {`この発注 ${page.orderQuantity.toLocaleString("ja-JP")} ${page.orderUnit}`}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.sectionTitle}>仕様（縫製指示）</Text>
          {data.instructions.length === 0 ? (
            <Text style={styles.cell}>—</Text>
          ) : (
            <View style={styles.table}>
              {data.instructions.map((it, i) => (
                <View key={i} style={styles.tr} wrap={false}>
                  <Cell style={styles.specLabel}>{it.label}</Cell>
                  <Cell style={styles.specValue}>{it.value}</Cell>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* 6. 付属（案B）＋ 7. 色ごとの指定 */}
      <AccessoryTable rows={rows} title="付属" />
      <ColorSpecTable rows={rows} colorwayNames={data.colorwayNames} />
    </Page>
  )
}

/** 付属のつづき（D-38）。ヘッダーは1枚目と同じ。絵型・数量・仕様は出さない */
function ContinuationPage({
  data,
  page,
  rows,
  pageNo,
  pageTotal,
}: {
  data: SewingSpecPdfData
  page: SewingSpecPage
  rows: SewingSpecAccessoryRow[]
  pageNo: number
  pageTotal: number
}) {
  return (
    <Page size={B4_JIS} style={styles.page}>
      <HeaderBlock data={data} page={page} pageNo={pageNo} pageTotal={pageTotal} />
      <AccessoryTable rows={rows} title="付属（つづき）" />
      <ColorSpecTable rows={rows} colorwayNames={data.colorwayNames} />
    </Page>
  )
}

type PhysicalPage = { page: SewingSpecPage; rows: SewingSpecAccessoryRow[]; cont: boolean }

/** 宛先ごとのページを、付属の行数に応じて「1枚目＋つづき」の物理ページに展開する（ページ番号は通し） */
function buildPhysicalPages(data: SewingSpecPdfData): PhysicalPage[] {
  const out: PhysicalPage[] = []
  for (const page of data.pages) {
    out.push({ page, rows: data.accessories.slice(0, MAIN_ACCESSORY_ROWS), cont: false })
    for (let s = MAIN_ACCESSORY_ROWS; s < data.accessories.length; s += CONT_ACCESSORY_ROWS) {
      out.push({ page, rows: data.accessories.slice(s, s + CONT_ACCESSORY_ROWS), cont: true })
    }
  }
  return out
}

export function SewingSpecDocument({ data }: { data: SewingSpecPdfData }) {
  const physical = buildPhysicalPages(data)
  return (
    <Document>
      {physical.map((p, i) =>
        p.cont ? (
          <ContinuationPage key={i} data={data} page={p.page} rows={p.rows} pageNo={i + 1} pageTotal={physical.length} />
        ) : (
          <MainPage key={i} data={data} page={p.page} rows={p.rows} pageNo={i + 1} pageTotal={physical.length} />
        ),
      )}
    </Document>
  )
}
