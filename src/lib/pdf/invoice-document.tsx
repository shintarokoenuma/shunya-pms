import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import type { InvoicePdfData } from "./invoice-data"
import { NO_BREAK, NO_HYPHEN_BREAK, mdSlash, numText, yenText, ymdSlash } from "./invoice-rows"

registerPdfFonts()

/**
 * B-109 PR-4（§3-1・案A）: 御請求書。A4 縦（P4-D1）。
 * - 6枠（前回御請求額／御入金額／繰越金額／当月お買上げ額／消費税等／今回御請求額）は保存した列をそのまま出す（D-35）
 * - 明細は納品の行と入金の行を日付順に1本の表（P4-D7・D8）。マイナスは ASCII の "-"・色は付けない（P4-D9）
 * - 取消は「取消」、再発行は「再発行（元: …）」（P4-D10）。ドラフトにも印は付けない（P4-D11）
 * - 表の見出しは各ページに繰り返す。フッタに番号とページ（P4-D18）
 * - 品番は折り返さない（P4-D21）。「品番 / 品名」の欄は上段に品番（小さく）・下段に品名
 * ★固定文言に ※ ～ は使わない（フォントに無い）
 */
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
  billTo: { width: "52%" },
  billToName: { fontSize: 13, fontWeight: "bold", textDecoration: "underline", marginBottom: 4 },
  billToLine: { fontSize: 9, lineHeight: 1.5 },
  dueLine: { fontSize: 9, marginTop: 4 },
  dueValue: { fontSize: 11, fontWeight: "bold" },
  issuer: { width: "44%", textAlign: "right", lineHeight: 1.5 },
  issuerName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  small: { fontSize: 8, color: "#444" },
  boxes: { flexDirection: "row", borderTop: "1pt solid #1a1a1a", borderLeft: "1pt solid #1a1a1a", marginBottom: 14 },
  box: { width: "16.6667%", borderRight: "1pt solid #1a1a1a", borderBottom: "1pt solid #1a1a1a" },
  boxHead: { fontSize: 8, textAlign: "center", backgroundColor: "#f0f0f0", borderBottom: "0.5pt solid #1a1a1a", paddingVertical: 3 },
  boxHeadTotal: { backgroundColor: "#d9d9d9", fontWeight: "bold" },
  boxValue: { fontSize: 9, textAlign: "right", paddingHorizontal: 4, paddingVertical: 5 },
  boxValueTotal: { fontSize: 11, fontWeight: "bold" },
  table: { borderTop: "1pt solid #888" },
  th: { flexDirection: "row", backgroundColor: "#f0f0f0", borderBottom: "1pt solid #888", minHeight: 18, alignItems: "center", fontWeight: "bold" },
  tr: { flexDirection: "row", borderBottom: "0.5pt solid #ccc", minHeight: 17, alignItems: "center" },
  cDate: { width: "8%", paddingHorizontal: 3 },
  cDoc: { width: "15%", paddingHorizontal: 3 },
  cName: { width: "35%", paddingHorizontal: 3 },
  cItemCode: { fontSize: 7.5, color: "#555" },
  cColor: { width: "14%", paddingHorizontal: 3 },
  cQty: { width: "8%", paddingHorizontal: 3, textAlign: "right" },
  cPrice: { width: "10%", paddingHorizontal: 3, textAlign: "right" },
  cAmt: { width: "10%", paddingHorizontal: 3, textAlign: "right" },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  bankBox: { width: "48%", border: "0.5pt solid #888", padding: 6, lineHeight: 1.6 },
  bankTitle: { fontWeight: "bold", marginBottom: 2 },
  taxBox: { width: "44%" },
  taxLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  taxTotal: { borderTop: "1pt solid #1a1a1a", marginTop: 2, paddingTop: 4, fontWeight: "bold", fontSize: 10 },
  footer: { position: "absolute", bottom: 28, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#666" },
})

function Box({ label, value, total = false }: { label: string; value: number; total?: boolean }) {
  return (
    <View style={styles.box}>
      <Text style={total ? [styles.boxHead, styles.boxHeadTotal] : styles.boxHead}>{label}</Text>
      <Text style={total ? [styles.boxValue, styles.boxValueTotal] : styles.boxValue}>{yenText(value)}</Text>
    </View>
  )
}

function InvoicePage({ data }: { data: InvoicePdfData }) {
  const monthTotal = data.subtotal + data.totalTaxAmount
  const showReduced = data.taxableAmount8 != null && data.taxableAmount8 !== 0
  return (
    <Page size="A4" style={styles.page} wrap>
      {/* 1. タイトル行 */}
      <View style={styles.titleRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>御請求書</Text>
          {data.status === "CANCELLED" ? <Text style={styles.cancelled}>取消</Text> : null}
        </View>
        <View style={styles.docMeta}>
          <Text style={styles.docNumber}>{data.invoiceNumber}</Text>
          {data.replacesInvoiceNumber ? <Text>再発行（元: {data.replacesInvoiceNumber}）</Text> : null}
          <Text>請求日　{ymdSlash(data.invoiceDate)}</Text>
          <Text>
            締日　{ymdSlash(data.periodEnd)}（{mdSlash(data.periodStart)}〜{mdSlash(data.periodEnd)}）
          </Text>
        </View>
      </View>

      {/* 2. 宛先と発行者 */}
      <View style={styles.partiesRow}>
        <View style={styles.billTo}>
          <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.billToName}>{data.billToName}　御中</Text>
          {data.billToAddress ? <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.billToLine}>{data.billToAddress}</Text> : null}
          <Text style={styles.billToLine}>下記のとおりご請求申し上げます。</Text>
          <Text style={styles.dueLine}>
            お支払期日　<Text style={styles.dueValue}>{ymdSlash(data.paymentDueDate)}</Text>
          </Text>
        </View>
        <View style={styles.issuer}>
          <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.issuerName}>{data.issuerName}</Text>
          <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.small}>{data.issuerAddress}</Text>
          <Text style={styles.small}>
            {data.issuerPhone}　{data.issuerFax}
          </Text>
          <Text style={styles.small}>{data.issuerEmail}</Text>
          <Text style={styles.small}>登録番号　{data.issuerTaxId}</Text>
        </View>
      </View>

      {/* 3. 6枠 */}
      <View style={styles.boxes}>
        <Box label="前回御請求額" value={data.previousBalanceAmount} />
        <Box label="御入金額" value={data.paymentReceivedAmount} />
        <Box label="繰越金額" value={data.carriedForwardAmount} />
        <Box label="当月お買上げ額" value={data.subtotal} />
        <Box label="消費税等" value={data.totalTaxAmount} />
        <Box label="今回御請求額" value={data.totalAmount} total />
      </View>

      {/* 4. 明細の表（見出しは各ページに繰り返す） */}
      <View style={styles.table}>
        <View style={styles.th} fixed>
          <Text style={styles.cDate}>日付</Text>
          <Text style={styles.cDoc}>伝票番号</Text>
          <Text style={styles.cName}>品番 / 品名</Text>
          <Text style={styles.cColor}>色・サイズ</Text>
          <Text style={styles.cQty}>数量</Text>
          <Text style={styles.cPrice}>単価</Text>
          <Text style={styles.cAmt}>金額</Text>
        </View>
        {data.rows.map((r, i) => (
          <View style={styles.tr} key={i} wrap={false}>
            <Text style={styles.cDate}>{mdSlash(r.date)}</Text>
            <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.cDoc}>{r.docNumber ?? ""}</Text>
            {r.kind === "item" ? (
              <View style={styles.cName}>
                {r.itemCode ? <Text hyphenationCallback={NO_BREAK} style={styles.cItemCode}>{r.itemCode}</Text> : null}
                <Text hyphenationCallback={NO_HYPHEN_BREAK}>{r.itemName}</Text>
              </View>
            ) : (
              <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.cName}>{r.description}</Text>
            )}
            <Text hyphenationCallback={NO_HYPHEN_BREAK} style={styles.cColor}>{r.kind === "item" ? r.colorSize : ""}</Text>
            <Text style={styles.cQty}>{r.kind === "item" ? numText(r.quantity) : ""}</Text>
            <Text style={styles.cPrice}>{r.kind === "item" ? numText(r.unitPrice) : ""}</Text>
            <Text style={styles.cAmt}>{numText(r.amount)}</Text>
          </View>
        ))}
        {data.rows.length === 0 ? (
          <View style={styles.tr}>
            <Text style={styles.cName}>（明細はありません）</Text>
          </View>
        ) : null}
      </View>

      {/* 5. 下段 */}
      <View style={styles.bottomRow} wrap={false}>
        <View style={styles.bankBox}>
          <Text style={styles.bankTitle}>お振込先</Text>
          <Text hyphenationCallback={NO_HYPHEN_BREAK}>
            {data.bank.bankName}　{data.bank.branchName}　{data.bank.accountType}　{data.bank.accountNumber}
          </Text>
          <Text hyphenationCallback={NO_HYPHEN_BREAK}>口座名義　{data.bank.accountHolder}</Text>
          <Text style={styles.small}>恐れ入りますが振込手数料はご負担ください。</Text>
        </View>
        <View style={styles.taxBox}>
          <View style={styles.taxLine}>
            <Text>10%対象</Text>
            <Text>{yenText(data.taxableAmount10)}</Text>
          </View>
          <View style={styles.taxLine}>
            <Text>消費税（10%）</Text>
            <Text>{yenText(data.taxAmount10)}</Text>
          </View>
          {showReduced ? (
            <>
              <View style={styles.taxLine}>
                <Text>8%対象</Text>
                <Text>{yenText(data.taxableAmount8 ?? 0)}</Text>
              </View>
              <View style={styles.taxLine}>
                <Text>消費税（8%）</Text>
                <Text>{yenText(data.taxAmount8 ?? 0)}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.taxLine}>
            <Text>非課税</Text>
            <Text>{yenText(data.nonTaxableAmount)}</Text>
          </View>
          <View style={[styles.taxLine, styles.taxTotal]}>
            <Text>当月合計（税込）</Text>
            <Text>{yenText(monthTotal)}</Text>
          </View>
        </View>
      </View>

      {/* 6. フッタ */}
      <View style={styles.footer} fixed>
        <Text>{data.invoiceNumber}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  )
}

export function InvoiceDocument({ dataList }: { dataList: InvoicePdfData[] }) {
  return (
    <Document>
      {dataList.map((data, i) => (
        <InvoicePage key={i} data={data} />
      ))}
    </Document>
  )
}
