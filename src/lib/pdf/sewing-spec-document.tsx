import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { COMPANY_PROFILE } from "@/lib/constants/company-profile"
import type { SewingSpecPage, SewingSpecPdfData } from "./sewing-spec-data"

registerPdfFonts()

/**
 * B-054 PR-4a: 縫製仕様書 PDF ― 1枚目（縫製工場用）。
 * 紙面は参考画面 v8（addendum v0.3 §0 のモック）と仕様確認書 v1.0 D-1〜D-21 のとおり。
 * - 用紙は JIS B4 縦（257 × 364mm）を寸法で指定（addendum v0.1 D-24）。size="B4" は ISO B4 なので使わない
 * - 1ページ1宛先（D-8）。約束納期は載せない（D-3）。工場には希望納期のみ
 * - 1枚に収める。はみ出しそうなときは付属の表ではなく絵型の高さを縮める（絵型を flexGrow で余白吸収）
 */
const B4_JIS: [number, number] = [728.5, 1031.8]

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
  // 1. 表題
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  titleLeft: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "bold", letterSpacing: 2 },
  kindBadge: {
    marginLeft: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
    border: "1pt solid #1a1a1a",
    fontSize: 11,
    fontWeight: "bold",
  },
  docMeta: { fontSize: 9, textAlign: "right", lineHeight: 1.5 },
  // 2. 宛先枠・弊社枠
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  box: { width: "49%", border: "0.5pt solid #888", padding: 6, lineHeight: 1.5 },
  recipientName: { fontSize: 13, fontWeight: "bold", marginBottom: 2 },
  ourName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  small: { fontSize: 8, color: "#444" },
  label: { color: "#666" },
  // 3. 品番の帯
  band: {
    flexDirection: "row",
    alignItems: "baseline",
    borderTop: "1pt solid #1a1a1a",
    borderBottom: "1pt solid #1a1a1a",
    paddingVertical: 4,
    marginBottom: 8,
  },
  bandCode: { fontSize: 15, fontWeight: "bold", marginRight: 16 },
  bandItem: { marginRight: 14 },
  // 4. 絵型
  // 残りの高さを埋めるが、画像の高さで伸びない（flexBasis 0・minHeight 0・overflow hidden）。
  // ★これが無いと Image の固有サイズで枠が伸び、Page が B4 より長くなる（pdfinfo 実測 1840pt）
  sketchBox: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 0,
    overflow: "hidden",
    border: "0.5pt solid #bbb",
    padding: 4,
    marginBottom: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sketchImgWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, width: "100%", overflow: "hidden" },
  // ★react-pdf の Image は固有サイズ（長辺 1600px）で測られ、height:"100%" / maxHeight / flexBasis では縮まない
  //   （2026-09-21 に6通りを実測。1ページに収まるのは height: 0 ＋ flexGrow 1 ＋ flexShrink 1 だけ）。
  //   height 0 を起点に flexGrow で残りの高さまで伸ばし、objectFit contain で比率を保つ
  sketchImg: {
    width: "100%",
    height: 0,
    flexGrow: 1,
    flexShrink: 1,
    objectFit: "contain",
  },
  caption: { fontSize: 8, color: "#444", marginTop: 2 },
  // 5. 数量・仕様
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  col: { width: "49%" },
  sectionTitle: { fontSize: 10, fontWeight: "bold", borderBottom: "0.5pt solid #888", marginBottom: 3 },
  table: { borderTop: "0.5pt solid #888" },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #ccc", minHeight: 14, alignItems: "center" },
  th: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottom: "0.5pt solid #888",
    minHeight: 15,
    alignItems: "center",
    fontWeight: "bold",
  },
  trTotal: { flexDirection: "row", borderBottom: "0.5pt solid #888", minHeight: 14, alignItems: "center", fontWeight: "bold" },
  cell: { paddingHorizontal: 3, fontSize: 9 },
  cellRight: { paddingHorizontal: 3, fontSize: 9, textAlign: "right" },
  specLabel: { width: "38%", paddingHorizontal: 3, fontSize: 9, color: "#444" },
  specValue: { width: "62%", paddingHorizontal: 3, fontSize: 9 },
  orderQty: { marginTop: 4, fontSize: 10 },
  // 6. 付属
  accPart: { width: "18%" },
  accCode: { width: "12%" },
  accSpec: { width: "20%" },
  accUsage: { width: "10%" },
  accSupplier: { width: "12%" },
  note: { fontSize: 8, color: "#666", marginTop: 3 },
})

function SkuMatrix({ data }: { data: SewingSpecPdfData }) {
  const m = data.skuMatrix
  if (!m) return <Text style={styles.cell}>SKU が未登録です</Text>
  const colW = `${Math.max(8, Math.floor(60 / Math.max(1, m.sizes.length)))}%`
  const labelW = "28%"
  const totalW = "12%"
  return (
    <View style={styles.table}>
      <View style={styles.th}>
        <Text style={[styles.cell, { width: labelW }]}>カラー</Text>
        {m.sizes.map((s) => (
          <Text key={s} style={[styles.cellRight, { width: colW }]}>
            {s}
          </Text>
        ))}
        <Text style={[styles.cellRight, { width: totalW }]}>計</Text>
      </View>
      {m.rows.map((r, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          <Text style={[styles.cell, { width: labelW }]}>{r.colorLabel}</Text>
          {r.cells.map((c, j) => (
            <Text key={j} style={[styles.cellRight, { width: colW }]}>
              {c.toLocaleString("ja-JP")}
            </Text>
          ))}
          <Text style={[styles.cellRight, { width: totalW }]}>{r.total.toLocaleString("ja-JP")}</Text>
        </View>
      ))}
      <View style={styles.trTotal} wrap={false}>
        <Text style={[styles.cell, { width: labelW }]}>合計</Text>
        {m.colTotals.map((c, j) => (
          <Text key={j} style={[styles.cellRight, { width: colW }]}>
            {c.toLocaleString("ja-JP")}
          </Text>
        ))}
        <Text style={[styles.cellRight, { width: totalW }]}>{m.grandTotal.toLocaleString("ja-JP")}</Text>
      </View>
    </View>
  )
}

function AccessoryTable({ data }: { data: SewingSpecPdfData }) {
  const n = Math.max(1, data.colorwayNames.length)
  // 部位18 + 品番12 + 仕様20 + 用尺10 + 手配12 = 72%。残り 28% をカラー列で分ける
  const colorW = `${Math.floor(28 / n)}%`
  const colorsBlockW = "28%"
  return (
    <View>
      <Text style={styles.sectionTitle}>
        {`付属（色ごと・最大15行）`}
      </Text>
      <View style={styles.table}>
        <View style={styles.th}>
          <Text style={[styles.cell, styles.accPart]}>部位</Text>
          <Text style={[styles.cell, styles.accCode]}>品番</Text>
          <Text style={[styles.cell, styles.accSpec]}>仕様</Text>
          {data.colorwayNames.length > 0 ? (
            data.colorwayNames.map((c, j) => (
              <Text key={j} style={[styles.cell, { width: colorW }]}>
                {c}
              </Text>
            ))
          ) : (
            <Text style={[styles.cell, { width: colorsBlockW }]}>カラー</Text>
          )}
          <Text style={[styles.cell, styles.accUsage]}>用尺/数</Text>
          <Text style={[styles.cell, styles.accSupplier]}>手配</Text>
        </View>
        {data.accessories.length === 0 ? (
          <View style={styles.tr}>
            <Text style={styles.cell}>BOM が未登録です</Text>
          </View>
        ) : (
          data.accessories.map((r, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <Text style={[styles.cell, styles.accPart]}>{r.part}</Text>
              <Text style={[styles.cell, styles.accCode]}>{r.itemCode}</Text>
              <Text style={[styles.cell, styles.accSpec]}>{r.spec}</Text>
              {r.colors.length > 0 ? (
                r.colors.map((c, j) => (
                  <Text key={j} style={[styles.cell, { width: colorW }]}>
                    {c}
                  </Text>
                ))
              ) : (
                <Text style={[styles.cell, { width: colorsBlockW }]}>
                  {r.commonColor ? `全色共通（${r.commonColor}）` : "全色共通"}
                </Text>
              )}
              <Text style={[styles.cell, styles.accUsage]}>{r.usage}</Text>
              <Text style={[styles.cell, styles.accSupplier]}>{r.supplier}</Text>
            </View>
          ))
        )}
      </View>
      {/* 「※」（U+203B）は同梱の NotoSansJP サブセットにグリフが無いため「注：」にする */}
      {data.accessoriesOverflow > 0 ? (
        <Text style={styles.note}>{`注：ほか ${data.accessoriesOverflow} 行（BOM を参照）`}</Text>
      ) : null}
    </View>
  )
}

function SewingPage({
  data,
  page,
  index,
}: {
  data: SewingSpecPdfData
  page: SewingSpecPage
  index: number
}) {
  return (
    // ★Page に wrap={false} を付けると react-pdf は Page の高さを内容に合わせて伸ばす（pdfinfo 実測 1840pt）。
    //   用紙を B4 に固定するため wrap は既定のままにし、絵型の枠（flexBasis 0）で残りの高さを吸収する。
    <Page size={B4_JIS} style={styles.page}>
      {/* 1. 表題＋区分の札＋発行日・ページ */}
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <Text style={styles.title}>縫製仕様書（縫製工場用）</Text>
          {page.kindLabel ? <Text style={styles.kindBadge}>{page.kindLabel}</Text> : null}
        </View>
        <View style={styles.docMeta}>
          <Text>{`発行日 ${data.issuedDate}`}</Text>
          <Text>{`${index + 1} / ${data.pages.length}`}</Text>
        </View>
      </View>

      {/* 2. 宛先枠／弊社枠 */}
      <View style={styles.partiesRow}>
        <View style={styles.box}>
          <Text style={styles.recipientName}>{`${page.recipientName} 御中`}</Text>
          {page.contactName ? <Text>{`ご担当 ${page.contactName} 様`}</Text> : null}
          <Text>
            <Text style={styles.label}>職出し予定日 </Text>
            {page.plannedStartDate}
          </Text>
          <Text>
            <Text style={styles.label}>希望納期 </Text>
            {page.expectedDeliveryDate}
          </Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.ourName}>{COMPANY_PROFILE.name}</Text>
          <Text style={styles.small}>{COMPANY_PROFILE.postalCode}</Text>
          <Text style={styles.small}>{COMPANY_PROFILE.address}</Text>
          <Text style={styles.small}>
            {COMPANY_PROFILE.tel}　{COMPANY_PROFILE.fax}
          </Text>
          <Text style={styles.small}>{COMPANY_PROFILE.email}</Text>
          <Text>{`弊社担当 ${data.assignedToName}`}</Text>
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
                  <Text style={styles.specLabel}>{it.label}</Text>
                  <Text style={styles.specValue}>{it.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* 6. 付属 */}
      <AccessoryTable data={data} />
    </Page>
  )
}

export function SewingSpecDocument({ data }: { data: SewingSpecPdfData }) {
  return (
    <Document>
      {data.pages.map((page, i) => (
        <SewingPage key={i} data={data} page={page} index={i} />
      ))}
    </Document>
  )
}
