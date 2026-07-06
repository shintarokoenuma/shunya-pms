import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { COMPANY_PROFILE } from "@/lib/constants/company-profile"
import type {
  QuotationPdfData,
  QuotationPdfBlock,
  QuotationPdfItem,
} from "./quotation-data"

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
  // 品番ブロック
  block: { marginTop: 14, paddingTop: 12, borderTop: "1pt solid #888" },
  blockHead: { marginBottom: 6 },
  blockTitle: { fontSize: 12, fontWeight: "bold" },
  blockMeta: { fontSize: 8, color: "#666", marginTop: 2, lineHeight: 1.5 },
  mono: { fontFamily: PDF_FONT_FAMILY },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 2,
    color: "#333",
  },
  // 明細テーブル
  table: { borderTop: "1pt solid #888" },
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
  cName: { width: "46%", paddingHorizontal: 4 },
  cQty: { width: "13%", paddingLeft: 4, paddingRight: 14, textAlign: "right" },
  cUnit: { width: "11%", paddingLeft: 12, paddingRight: 4, textAlign: "left" },
  cPrice: { width: "15%", paddingHorizontal: 4, textAlign: "right" },
  cSub: { width: "15%", paddingHorizontal: 4, textAlign: "right" },
  // 提示価格・1枚単価
  presentRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    marginTop: 8,
  },
  perUnitRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "baseline",
    marginTop: 4,
  },
  presentLabel: { fontSize: 10, marginRight: 12 },
  presentValue: { fontSize: 13, fontWeight: "bold" },
  perUnitLabel: { fontSize: 9, color: "#333", marginRight: 12 },
  perUnitValue: { fontSize: 11, fontWeight: "bold" },
  note: { fontSize: 8, color: "#666", marginTop: 6 },
})

function yenJpy(n: number | null): string {
  if (n === null) return "—"
  return `¥${n.toLocaleString("ja-JP")}`
}

function unitPriceFmt(currency: string, n: number | null): string {
  if (n === null) return "—"
  if (currency === "JPY") return `¥${n.toLocaleString("ja-JP")}`
  if (currency === "USD")
    return `$${n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  return `${n.toLocaleString("ja-JP")} ${currency}`
}

function fmtDate(d: Date | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("ja-JP")
}

function fmtQty(n: number | null): string {
  if (n === null) return "—"
  return n.toLocaleString("ja-JP")
}

function ItemRows({ items }: { items: QuotationPdfItem[] }) {
  return (
    <>
      {items.map((it, i) => (
        <View style={styles.tr} key={i} wrap={false}>
          <Text style={styles.cName}>{it.itemName}</Text>
          <Text style={styles.cQty}>{fmtQty(it.quantity)}</Text>
          <Text style={styles.cUnit}>{it.unit ?? "—"}</Text>
          <Text style={styles.cPrice}>
            {unitPriceFmt(it.currency, it.unitPrice)}
          </Text>
          <Text style={styles.cSub}>{yenJpy(it.subtotalJpy)}</Text>
        </View>
      ))}
    </>
  )
}

function TableHead() {
  return (
    <View style={styles.th} fixed>
      <Text style={styles.cName}>品目名</Text>
      <Text style={styles.cQty}>数量</Text>
      <Text style={styles.cUnit}>単位</Text>
      <Text style={styles.cPrice}>単価</Text>
      <Text style={styles.cSub}>小計</Text>
    </View>
  )
}

function Block({ block }: { block: QuotationPdfBlock }) {
  const productName = block.target?.productName ?? "—"
  const itemNumber = block.target?.itemNumber ?? "—"
  const hasMainItems =
    block.materialItems.length > 0 || block.laborItems.length > 0
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.blockTitle}>
          {productName}
          {block.target?.season ? `（${block.target.season}）` : ""}
        </Text>
        <Text style={styles.blockMeta}>
          品番: <Text style={styles.mono}>{itemNumber}</Text>
          {"　"}
          見積番号: <Text style={styles.mono}>{block.estimateNumber}</Text>
          {block.presentedMoq != null
            ? `　提示MOQ: ${block.presentedMoq.toLocaleString("ja-JP")}`
            : ""}
        </Text>
        {block.title ? (
          <Text style={styles.blockMeta}>{block.title}</Text>
        ) : null}
      </View>

      {/* 材料費 → 工賃（1テーブル） */}
      {hasMainItems ? (
        <View style={styles.table}>
          <TableHead />
          <ItemRows items={block.materialItems} />
          <ItemRows items={block.laborItems} />
        </View>
      ) : null}

      {/* 初期費用（別枠・§6-6） */}
      {block.initialCostItems.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>初期費用（別途）</Text>
          <View style={styles.table}>
            <TableHead />
            <ItemRows items={block.initialCostItems} />
          </View>
        </View>
      ) : null}

      {/* 1枚あたり提示単価（§6-3・あれば） */}
      {block.perUnit ? (
        <View style={styles.perUnitRow}>
          <Text style={styles.perUnitLabel}>{block.perUnit.label}</Text>
          <Text style={styles.perUnitValue}>
            {yenJpy(block.perUnit.valueJpy)}
          </Text>
        </View>
      ) : null}

      {/* ご提示価格（§6-1・block 単位・合計ではない） */}
      <View style={styles.presentRow}>
        <Text style={styles.presentLabel}>ご提示価格</Text>
        <Text style={styles.presentValue}>{yenJpy(block.finalPriceJpy)}</Text>
      </View>

      {block.notes ? (
        <Text style={styles.note}>備考: {block.notes}</Text>
      ) : null}
    </View>
  )
}

export function QuotationDocument({ data }: { data: QuotationPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* PDF 全体ヘッダ（1つ） */}
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

        {/* 品番ブロック縦積み（合計行なし・§6-5） */}
        {data.blocks.map((block, i) => (
          <Block block={block} key={i} />
        ))}
      </Page>
    </Document>
  )
}
