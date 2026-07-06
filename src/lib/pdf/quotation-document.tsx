import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { COMPANY_PROFILE } from "@/lib/constants/company-profile"
import type { QuotationPdfData } from "./quotation-data"

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
  partiesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  orderTo: { width: "48%" },
  orderToName: { fontSize: 13, fontWeight: "bold", marginBottom: 2 },
  orderFrom: { width: "48%", textAlign: "right", lineHeight: 1.5 },
  orderFromName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  small: { fontSize: 8, color: "#444" },
  // セクション
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 4,
  },
  table: { borderTop: "1pt solid #888" },
  tr: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #ccc",
    minHeight: 20,
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
  // 製品セクション列
  cName: { width: "52%", paddingHorizontal: 4 },
  cQty: { width: "12%", paddingHorizontal: 4, textAlign: "right" },
  cUnit: { width: "18%", paddingHorizontal: 4, textAlign: "right" },
  cAmount: { width: "18%", paddingHorizontal: 4, textAlign: "right" },
  // 初期費用セクション列
  icLabel: { width: "72%", paddingHorizontal: 4 },
  icAmount: { width: "28%", paddingHorizontal: 4, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    borderTop: "1pt solid #888",
    minHeight: 20,
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  totalLabelCell: { flexGrow: 1, paddingHorizontal: 4, textAlign: "right" },
  totalValueCell: { width: "18%", paddingHorizontal: 4, textAlign: "right", fontWeight: "bold" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    marginTop: 14,
    paddingTop: 8,
    borderTop: "2pt solid #333",
  },
  grandLabel: { fontSize: 12, marginRight: 16 },
  grandValue: { fontSize: 16, fontWeight: "bold" },
  footnote: { fontSize: 8, color: "#666", marginTop: 10 },
  notesBox: { marginTop: 14 },
  notesTitle: { fontSize: 9, fontWeight: "bold", marginBottom: 2 },
  noteLine: { fontSize: 8, color: "#444", lineHeight: 1.5 },
  mono: { fontFamily: PDF_FONT_FAMILY },
})

function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`
}

function fmtDate(d: Date | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("ja-JP")
}

export function QuotationDocument({ data }: { data: QuotationPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* ヘッダ（PDF 全体で1つ） */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>見積書</Text>
          <View style={styles.docMeta}>
            <Text>発行日: {fmtDate(data.issuedAt)}</Text>
          </View>
        </View>

        <View style={styles.partiesRow}>
          <View style={styles.orderTo}>
            <Text style={styles.orderToName}>{data.clientName} 御中</Text>
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

        {/* 【製品】 */}
        <Text style={styles.sectionTitle}>製品</Text>
        <View style={styles.table}>
          <View style={styles.th} fixed>
            <Text style={styles.cName}>品名</Text>
            <Text style={styles.cQty}>数量</Text>
            <Text style={styles.cUnit}>1枚単価</Text>
            <Text style={styles.cAmount}>金額</Text>
          </View>
          {data.productRows.map((r, i) => (
            <View style={styles.tr} key={i} wrap={false}>
              <Text style={styles.cName}>{r.productLabel}</Text>
              <Text style={styles.cQty}>
                {r.quantity.toLocaleString("ja-JP")}
              </Text>
              <Text style={styles.cUnit}>
                {yen(r.unitPriceJpy)}
                {r.includedBadge ? "（初期費用込）" : ""}
              </Text>
              <Text style={styles.cAmount}>{yen(r.amountJpy)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabelCell}>製品合計</Text>
            <Text style={styles.totalValueCell}>
              {yen(data.productTotalJpy)}
            </Text>
          </View>
        </View>

        {/* 【初期費用（別途）】 行が0件ならセクションごと非表示 */}
        {data.initialCostRows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>初期費用（別途）</Text>
            <View style={styles.table}>
              <View style={styles.th} fixed>
                <Text style={styles.icLabel}>項目</Text>
                <Text style={styles.icAmount}>金額</Text>
              </View>
              {data.initialCostRows.map((r, i) => (
                <View style={styles.tr} key={i} wrap={false}>
                  <Text style={styles.icLabel}>{r.label}</Text>
                  <Text style={styles.icAmount}>{yen(r.amountJpy)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabelCell}>初期費用合計</Text>
                <Text style={styles.totalValueCell}>
                  {yen(data.initialCostTotalJpy)}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* 【総合計】 */}
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>総合計</Text>
          <Text style={styles.grandValue}>{yen(data.grandTotalJpy)}</Text>
        </View>

        {/* INCLUDED 脚注 */}
        {data.hasIncluded && (
          <Text style={styles.footnote}>
            ※（初期費用込）表記の製品は初期費用を単価に含みます。
          </Text>
        )}

        {/* 備考 */}
        {data.notesRows.length > 0 && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>備考</Text>
            {data.notesRows.map((n, i) => (
              <Text style={styles.noteLine} key={i}>
                {n.productLabel}：{n.notes}
              </Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  )
}
