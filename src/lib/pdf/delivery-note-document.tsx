import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { COMPANY_PROFILE } from "@/lib/constants/company-profile"
import type { DeliveryNotePdfData } from "./delivery-note-data"
import { NO_BREAK, NO_HYPHEN_BREAK, numText, yenText, ymdSlash } from "./invoice-rows"

registerPdfFonts()

/**
 * B-109 PR-4（§3-2）: 納品書。A4 縦（P4-D1）。
 * - 消費税・税込合計は出さない（D-40・P4-D12）。showAmounts が false なら 単価・金額・小計 を出さない
 * - 前受金・充当の行は品名の横に小さく「前受金」「前受金充当」。数量合計は totalQuantity（前受金の行を含まない）
 * - 右下に受領印の欄（受領日・受領印の枠）。取消は「取消」（P4-D13）
 * - 発行者は COMPANY_PROFILE（登録番号は載せない）
 */
const STAMP_BOX_PT = 57 // 約 20mm

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 36,
    color: "#1a1a1a",
  },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  titleWrap: { flexDirection: "row", alignItems: "flex-end" },
  title: { fontSize: 20, fontWeight: "bold", letterSpacing: 6 },
  cancelled: { fontSize: 12, fontWeight: "bold", marginLeft: 12, marginBottom: 2, border: "1pt solid #1a1a1a", paddingHorizontal: 6, paddingVertical: 1 },
  docMeta: { fontSize: 9, textAlign: "right", lineHeight: 1.5 },
  docNumber: { fontSize: 11, fontWeight: "bold" },
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  shipTo: { width: "52%" },
  shipToName: { fontSize: 13, fontWeight: "bold", textDecoration: "underline", marginBottom: 4 },
  shipToLine: { fontSize: 9, lineHeight: 1.5 },
  issuer: { width: "44%", textAlign: "right", lineHeight: 1.5 },
  issuerName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  small: { fontSize: 8, color: "#444" },
  table: { borderTop: "1pt solid #888" },
  th: { flexDirection: "row", backgroundColor: "#f0f0f0", borderBottom: "1pt solid #888", minHeight: 18, alignItems: "center", fontWeight: "bold" },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #ccc", minHeight: 17, alignItems: "center" },
  cCode: { width: "22%", paddingHorizontal: 3 }, // P4-D21: 品番は折り返さないので広め
  cName: { width: "28%", paddingHorizontal: 3 },
  cNameWide: { width: "48%", paddingHorizontal: 3 },
  cColor: { width: "14%", paddingHorizontal: 3 },
  cSize: { width: "8%", paddingHorizontal: 3 },
  cQty: { width: "8%", paddingHorizontal: 3, textAlign: "right" },
  cPrice: { width: "10%", paddingHorizontal: 3, textAlign: "right" },
  cAmt: { width: "10%", paddingHorizontal: 3, textAlign: "right" },
  kindTag: { fontSize: 7, color: "#555", border: "0.5pt solid #888", paddingHorizontal: 2, marginLeft: 4 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  bottomLeft: { width: "50%", lineHeight: 1.6 },
  bottomRight: { width: "44%", alignItems: "flex-end" },
  qtyTotal: { fontSize: 10 },
  qtyValue: { fontSize: 12, fontWeight: "bold" },
  subtotalRow: { flexDirection: "row", alignItems: "baseline" },
  subtotalLabel: { marginRight: 10 },
  subtotalValue: { fontSize: 12, fontWeight: "bold" },
  stampArea: { flexDirection: "row", alignItems: "flex-end", marginTop: 12 },
  stampDate: { fontSize: 9, marginRight: 10, marginBottom: 4 },
  stampBox: { width: STAMP_BOX_PT, height: STAMP_BOX_PT, border: "0.5pt solid #888", alignItems: "center", justifyContent: "flex-start", paddingTop: 3 },
  stampLabel: { fontSize: 7, color: "#666" },
  footer: { position: "absolute", bottom: 28, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#666" },
})

function DeliveryNotePage({ data }: { data: DeliveryNotePdfData }) {
  const amounts = data.showAmounts
  return (
    <Page size="A4" style={styles.page} wrap>
      {/* 1. タイトル行 */}
      <View style={styles.titleRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>納品書</Text>
          {data.status === "CANCELLED" ? <Text style={styles.cancelled}>取消</Text> : null}
        </View>
        <View style={styles.docMeta}>
          <Text style={styles.docNumber}>{data.deliveryNumber}</Text>
          <Text>納品日　{ymdSlash(data.deliveryDate)}</Text>
          {data.soNumbers.length > 0 ? <Text hyphenationCallback={NO_HYPHEN_BREAK}>受注　{data.soNumbers.join("、")}</Text> : null}
        </View>
      </View>

      {/* 2. 宛先と発行者 */}
      <View style={styles.partiesRow}>
        <View style={styles.shipTo}>
          <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.shipToName}>{data.clientName}　御中</Text>
          {data.shipToAddress ? <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.shipToLine}>納品先：{data.shipToAddress}</Text> : null}
          {data.shipToContact ? <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.shipToLine}>ご担当：{data.shipToContact}</Text> : null}
          {data.shipToPhone ? <Text style={styles.shipToLine}>TEL：{data.shipToPhone}</Text> : null}
          <Text style={styles.shipToLine}>下記のとおり納品いたします。</Text>
        </View>
        <View style={styles.issuer}>
          <Text style={styles.issuerName}>{COMPANY_PROFILE.name}</Text>
          <Text style={styles.small}>
            {COMPANY_PROFILE.postalCode} {COMPANY_PROFILE.address}
          </Text>
          <Text style={styles.small}>
            {COMPANY_PROFILE.tel}　{COMPANY_PROFILE.fax}
          </Text>
          <Text style={styles.small}>{COMPANY_PROFILE.email}</Text>
        </View>
      </View>

      {/* 3. 明細の表 */}
      <View style={styles.table}>
        <View style={styles.th} fixed>
          <Text style={styles.cCode}>品番</Text>
          <Text style={amounts ? styles.cName : styles.cNameWide}>品名</Text>
          <Text style={styles.cColor}>色</Text>
          <Text style={styles.cSize}>サイズ</Text>
          <Text style={styles.cQty}>数量</Text>
          {amounts ? (
            <>
              <Text style={styles.cPrice}>単価</Text>
              <Text style={styles.cAmt}>金額</Text>
            </>
          ) : null}
        </View>
        {data.items.map((it, i) => (
          <View style={styles.tr} key={i} wrap={false}>
            <Text hyphenationCallback={NO_BREAK} style={styles.cCode}>{it.itemCode ?? ""}</Text>
            <View style={[amounts ? styles.cName : styles.cNameWide, { flexDirection: "row", alignItems: "center" }]}>
              {/* P4-D21: 品名の列を狭めたので、タグと重ならないよう品名側を折り返す */}
              <Text hyphenationCallback={NO_HYPHEN_BREAK} style={{ flex: 1 }}>{it.productName}</Text>
              {it.lineKind ? (
                <Text style={styles.kindTag}>{it.lineKind === "DEPOSIT" ? "前受金" : "前受金充当"}</Text>
              ) : null}
            </View>
            <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.cColor}>{it.colorName ?? ""}</Text>
            <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.cSize}>{it.size ?? ""}</Text>
            <Text style={styles.cQty}>
              {numText(it.quantity)} {it.unit}
            </Text>
            {amounts ? (
              <>
                <Text style={styles.cPrice}>{it.unitPrice != null ? numText(it.unitPrice) : ""}</Text>
                <Text style={styles.cAmt}>{it.subtotal != null ? numText(it.subtotal) : ""}</Text>
              </>
            ) : null}
          </View>
        ))}
      </View>

      {/* 4. 下段 */}
      <View style={styles.bottomRow} wrap={false}>
        <View style={styles.bottomLeft}>
          <Text style={styles.qtyTotal}>
            数量合計　<Text style={styles.qtyValue}>{data.totalQuantity.toLocaleString("ja-JP")}</Text> 枚
          </Text>
          {data.hasDepositLines ? (
            <Text style={styles.small}>前受金・充当の行は数量合計に含めません</Text>
          ) : null}
          {data.clientNotes ? <Text hyphenationCallback={NO_HYPHEN_BREAK}>備考　{data.clientNotes}</Text> : null}
        </View>
        <View style={styles.bottomRight}>
          {amounts ? (
            <>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>小計（税抜）</Text>
                <Text style={styles.subtotalValue}>{yenText(data.subtotalAmount ?? 0)}</Text>
              </View>
              <Text style={styles.small}>消費税は合計請求書でまとめて計算します。</Text>
            </>
          ) : null}
          <View style={styles.stampArea}>
            <Text style={styles.stampDate}>受領日　　　年　　月　　日</Text>
            <View style={styles.stampBox}>
              <Text style={styles.stampLabel}>受領印</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 5. フッタ */}
      <View style={styles.footer} fixed>
        <Text>{data.deliveryNumber}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  )
}

export function DeliveryNoteDocument({ dataList }: { dataList: DeliveryNotePdfData[] }) {
  return (
    <Document>
      {dataList.map((data, i) => (
        <DeliveryNotePage key={i} data={data} />
      ))}
    </Document>
  )
}
