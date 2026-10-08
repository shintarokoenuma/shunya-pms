import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer"
import { PDF_FONT_FAMILY, registerPdfFonts } from "./fonts"
import { issuerTelFaxLine, labelMail, labelPostal } from "@/lib/company-issuer"
import { formatColorCode } from "@/lib/color-code"
import type { OrderPdfData } from "./order-data"
import { NO_BREAK_CALLBACK, ORDER_TEXT_W, wrapAfterLabel, type PdfWrap } from "./pdf-wrap"
import { Lines } from "./pdf-lines"

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
  // B-250（D-5）: C# を 11% → 15%。原資は品名 26% → 24%・単位 11% → 9%（合計 100% のまま）
  cName: { width: "24%", paddingHorizontal: 4 },
  cCode: { width: "15%", paddingHorizontal: 4 },
  cColor: { width: "15%", paddingHorizontal: 4 },
  // 数量(右寄せ)と単位(左寄せ)の間に視覚的な間隔を確保（「1        一式」と読める形）。
  cQty: { width: "11%", paddingLeft: 4, paddingRight: 14, textAlign: "right" },
  cUnit: { width: "9%", paddingLeft: 12, paddingRight: 4, textAlign: "left" },
  cPrice: { width: "13%", paddingHorizontal: 4, textAlign: "right" },
  cSub: { width: "13%", paddingHorizontal: 4, textAlign: "right" },
  mono: { fontFamily: PDF_FONT_FAMILY },
  // B-266 D-1: 品番の欄の2段目（デザイン番号）。小さめ・薄い色
  cCodeSub: { fontSize: 7, color: "#666", marginTop: 1 },
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

/** 発注書1件ぶんの Page。単票（OrderDocument）と縦積み（OrderDocumentMulti）で共有。B-268: 明細と対象品番の行は wrap で先に決める */
function OrderPage({ data, wrap }: { data: OrderPdfData; wrap: PdfWrap }) {
  const c = data.currency
  return (
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
                {/* B-268 D-2: 品名・品番は見出しを含めて行を先に決める（ブランドは対象外）。2行目以降は1行ずつ Text */}
                {[
                  ["品名: ", `${data.target.productName}${data.target.season ? `（${data.target.season}）` : ""}`],
                  ["品番: ", data.target.itemNumber],
                ].map(([label, value]) => {
                  const [first, ...rest] = wrapAfterLabel(wrap, label, value, ORDER_TEXT_W.target)
                  return (
                    <View key={label}>
                      <Text style={styles.targetLine} hyphenationCallback={NO_BREAK_CALLBACK}>
                        <Text style={styles.targetLabel}>{label}</Text>
                        {first}
                      </Text>
                      <Lines lines={rest} textStyle={styles.targetLine} />
                    </View>
                  )
                })}
              </View>
            ) : null}
            {data.title ? <Text style={styles.orderToHint}>{data.title}</Text> : null}
          </View>
          <View style={styles.orderFrom}>
            {/* B-205 PR-1: 自社情報はそのテナントの Company（data.issuer）。空は空欄（D-3）・頭の文字は帳票側で付ける（D-15） */}
            <Text style={styles.orderFromName}>{data.issuer.name}</Text>
            <Text style={styles.small}>{labelPostal(data.issuer.postalCode)}</Text>
            <Text style={styles.small}>{data.issuer.address ?? ""}</Text>
            <Text style={styles.small}>{issuerTelFaxLine(data.issuer)}</Text>
            <Text style={styles.small}>{labelMail(data.issuer.email)}</Text>
          </View>
        </View>

        {/* 明細表 */}
        <View style={styles.table}>
          <View style={styles.th} fixed>
            <Text style={styles.cName}>品名</Text>
            {/* B-266 D-1: 発注書（PO）だけ「品番 / D/#」。作業発注書はデザイン番号を持たない */}
            <Text style={styles.cCode}>{data.docKind === "PO" ? "品番 / D/#" : "品番"}</Text>
            <Text style={styles.cColor}>C#</Text>
            <Text style={styles.cQty}>数量</Text>
            <Text style={styles.cUnit}>単位</Text>
            <Text style={styles.cPrice}>単価</Text>
            <Text style={styles.cSub}>金額</Text>
          </View>
          {data.items.map((it, i) => (
            <View style={styles.tr} key={i} wrap={false}>
              {/* B-268 D-1/D-2: 品名・品番・D/#・C# は行を先に決め、1行ずつ Text で描く（react-pdf には折らせない） */}
              <Lines lines={wrap.lines(it.itemName, ORDER_TEXT_W.name)} style={styles.cName} />
              {/* B-266 D-1: 1段目＝品番、2段目＝デザイン番号（小さく薄く）。品番が無ければデザイン番号を1段目に。どちらも無ければ「—」 */}
              <View style={styles.cCode}>
                <Lines lines={wrap.lines(it.itemCode ?? it.designCode ?? "—", ORDER_TEXT_W.code)} textStyle={styles.mono} />
                {it.itemCode && it.designCode ? (
                  <Lines lines={wrap.lines(it.designCode, ORDER_TEXT_W.code, 7)} textStyle={[styles.mono, styles.cCodeSub]} />
                ) : null}
              </View>
              {/* B-266 D-3: 色番 → 無ければカラーウェイ名 → 無ければ「—」 */}
              <Lines lines={wrap.lines(formatColorCode(it.colorCode) ?? it.colorwayName ?? "—", ORDER_TEXT_W.color)} style={styles.cColor} />
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
  )
}

export function OrderDocument({ data, wrap }: { data: OrderPdfData; wrap: PdfWrap }) {
  return (
    <Document>
      <OrderPage data={data} wrap={wrap} />
    </Document>
  )
}

/**
 * B-086: 複数発注書を1つの PDF に縦積み（発注ごとに改ページ・案B）。
 * 各ページは独立した正式発注書のため宛先（仕入先/工場/外注先）の混在を許容する。
 */
export function OrderDocumentMulti({ dataList, wrap }: { dataList: OrderPdfData[]; wrap: PdfWrap }) {
  return (
    <Document>
      {dataList.map((data, i) => (
        <OrderPage key={i} data={data} wrap={wrap} />
      ))}
    </Document>
  )
}
