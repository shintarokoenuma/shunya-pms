import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { COMPANY_PROFILE } from "@/lib/constants/company-profile"
import type { OrderPdfData } from "./order-data"

registerPdfFonts()

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    color: "#1a1a1a",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "bold", letterSpacing: 4 },
  docMeta: { fontSize: 9, textAlign: "right", lineHeight: 1.5 },
  docNumber: { fontFamily: PDF_FONT_FAMILY, fontSize: 11, fontWeight: "bold" },
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  orderTo: { width: "48%" },
  orderToName: { fontSize: 13, fontWeight: "bold", marginBottom: 2 },
  orderToHint: { fontSize: 8, color: "#666", marginTop: 2 },
  targetBox: {
    marginTop: 4,
    padding: 4,
    border: "0.5pt solid #bbb",
    backgroundColor: "#fafafa",
  },
  targetLine: { fontSize: 9, lineHeight: 1.5 },
  targetLabel: { color: "#666" },
  orderFrom: { width: "48%", textAlign: "right", lineHeight: 1.5 },
  orderFromName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  small: { fontSize: 8, color: "#444" },
  table: { marginTop: 4, borderTop: "1pt solid #888" },
  tr: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #ccc",
    minHeight: 18,
    alignItems: "center",
  },
  th: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottom: "1pt solid #888",
    minHeight: 20,
    alignItems: "center",
    fontWeight: "bold",
  },
  cName: { width: "28%", paddingHorizontal: 4 },
  cCode: { width: "15%", paddingHorizontal: 4 },
  cColor: { width: "11%", paddingHorizontal: 4 },
  cQty: { width: "10%", paddingHorizontal: 4, textAlign: "right" },
  cUnit: { width: "10%", paddingHorizontal: 4, textAlign: "left" },
  cPrice: { width: "13%", paddingHorizontal: 4, textAlign: "right" },
  cSub: { width: "13%", paddingHorizontal: 4, textAlign: "right" },
  mono: { fontFamily: PDF_FONT_FAMILY },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  totalLabel: { fontSize: 10, marginRight: 12 },
  totalValue: { fontSize: 12, fontWeight: "bold" },
  footer: { marginTop: 16, lineHeight: 1.6 },
  note: { fontSize: 8, color: "#666", marginTop: 4 },
})

function yen(currency: string, n: number | null): string {
  if (n === null) return "未定"
  if (currency === "JPY") return `¥${n.toLocaleString("ja-JP")}`
  return `${n.toLocaleString("ja-JP")} ${currency}`
}

function fmtDate(d: Date | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("ja-JP")
}

export function OrderDocument({ data }: { data: OrderPdfData }) {
  const c = data.currency
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* ヘッダ */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>発注書</Text>
          <View style={styles.docMeta}>
            <Text style={styles.docNumber}>{data.docNumber}</Text>
            <Text>発注日: {fmtDate(data.orderDate)}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.orderTo}>
            <Text style={styles.orderToName}>{data.orderToName} 御中</Text>
            {data.target ? (
              <View style={styles.targetBox}>
                {data.target.brandName ? (
                  <Text style={styles.targetLine}>
                    <Text style={styles.targetLabel}>ブランド: </Text>
                    {data.target.brandName}
                  </Text>
                ) : null}
                <Text style={styles.targetLine}>
                  <Text style={styles.targetLabel}>品名: </Text>
                  {data.target.productName}
                  {data.target.season ? `（${data.target.season}）` : ""}
                </Text>
                <Text style={styles.targetLine}>
                  <Text style={styles.targetLabel}>品番: </Text>
                  {data.target.itemNumber}
                </Text>
              </View>
            ) : null}
            {data.title ? <Text style={styles.orderToHint}>{data.title}</Text> : null}
          </View>
          <View style={styles.orderFrom}>
            <Text style={styles.orderFromName}>{COMPANY_PROFILE.name}</Text>
            <Text style={styles.small}>{COMPANY_PROFILE.postalCode}</Text>
            <Text style={styles.small}>{COMPANY_PROFILE.address}</Text>
            <Text style={styles.small}>
              {COMPANY_PROFILE.tel}　{COMPANY_PROFILE.fax}
            </Text>
            <Text style={styles.small}>{COMPANY_PROFILE.email}</Text>
          </View>
        </View>

        {/* 明細表 */}
        <View style={styles.table}>
          <View style={styles.th} fixed>
            <Text style={styles.cName}>品名</Text>
            <Text style={styles.cCode}>品番</Text>
            <Text style={styles.cColor}>C#</Text>
            <Text style={styles.cQty}>数量</Text>
            <Text style={styles.cUnit}>単位</Text>
            <Text style={styles.cPrice}>単価</Text>
            <Text style={styles.cSub}>金額</Text>
          </View>
          {data.items.map((it, i) => (
            <View style={styles.tr} key={i} wrap={false}>
              <Text style={styles.cName}>{it.itemName}</Text>
              <Text style={[styles.cCode, styles.mono]}>{it.itemCode ?? "—"}</Text>
              <Text style={styles.cColor}>
                {it.colorCode ? `C/#${it.colorCode}` : "—"}
              </Text>
              <Text style={styles.cQty}>{it.quantity.toLocaleString("ja-JP")}</Text>
              <Text style={styles.cUnit}>{it.unit}</Text>
              <Text style={styles.cPrice}>{yen(c, it.unitPrice)}</Text>
              <Text style={styles.cSub}>{yen(c, it.subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>合計</Text>
          <Text style={styles.totalValue}>{yen(c, data.total)}</Text>
        </View>
        {data.hasUndecided ? (
          <Text style={styles.note}>※ 金額未定の明細は合計に含まれません。</Text>
        ) : null}

        {/* フッタ */}
        <View style={styles.footer}>
          <Text>希望納期: {fmtDate(data.expectedDeliveryDate)}</Text>
          {data.description ? <Text>備考: {data.description}</Text> : null}
        </View>
      </Page>
    </Document>
  )
}
