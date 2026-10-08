/**
 * B-212 PR-1（§3）: csv.ts の検証（テストランナー非依存・DB 非接続）。手動実行: npx tsx src/lib/supplier-invoice/csv.test.ts
 */
import { CSV_COLUMNS, parseSupplierInvoiceCsv, sumCountedByCurrency } from "./csv"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}
let passed = 0

const HEAD = CSV_COLUMNS.join(",")
function row(over: Partial<Record<(typeof CSV_COLUMNS)[number], string>>): string {
  const base: Record<string, string> = {
    月度: "2026-10", 相手先区分: "16", 相手先コード: "SUP-010", 相手先名: "㈱滝善", 登録番号: "T1234567890123", 書類種別: "請求書", 書類No: "G00115",
    発行日: "2026-10-31", 締め日: "2026-10-31", 支払期日: "2026-11-30", 書類税抜: "30000", 書類消費税: "3000", 書類税込: "33000", 通貨: "JPY",
    行番号: "1", 計上区分: "計上", 対の書類No: "", 伝票日付: "2026-10-05", 伝票No: "S-1", 投入先: "EB27-SH01", 品番: "", 品名: "リネン生地",
    数量: "100", 単位: "m", 単価: "100", 金額税抜: "10000", 税区分: "10%", 費目: "", 件数: "", 枚数: "", 重さkg: "", 原本ファイル: "G00115.pdf", 原本ページ: "1", メモ: "",
  }
  // カンマを含む値は CSV の作法どおり引用符で囲む（B-070 の出力も同じ）
  return CSV_COLUMNS.map((c) => { const v = over[c] ?? base[c]; return v.includes(",") ? `"${v}"` : v }).join(",")
}

// ① 正常系（BOM 付き・2書類・計上と参照）
{
  const text = "﻿" + [HEAD,
    row({ 行番号: "1", 金額税抜: "10,000" }),
    row({ 行番号: "2", 金額税抜: "20000", 投入先: "16sy-082" }),
    row({ 相手先名: "DHL JAPAN", 相手先コード: "", 書類No: "DHL-1", 書類種別: "INVOICE", 書類税抜: "1493.80", 書類消費税: "0", 書類税込: "1493.80", 通貨: "USD", 行番号: "1", 投入先: "", 金額税抜: "1493.80", 費目: "国際輸送費", 件数: "2", 重さkg: "12.5" }),
    row({ 相手先名: "ふくら縫製", 書類No: "F-77", 書類種別: "納品書", 計上区分: "参照", 対の書類No: "G00115", 書類税抜: "", 書類消費税: "", 書類税込: "5000", 行番号: "1", 金額税抜: "5000" }),
  ].join("\n")
  const r = parseSupplierInvoiceCsv(text)
  assert(r.errors.length === 0, `①-1 エラーなし: ${JSON.stringify(r.errors)}`)
  assert(r.documents.length === 3, `①-2 3書類: ${r.documents.length}`)
  const g = r.documents.find((d) => d.documentNumber === "G00115")!
  assert(g.lines.length === 2 && g.lines[0].amount === "10000" && g.lines[1].amount === "20000", "①-3 G00115 は2行・カンマを取り除いた数")
  assert(g.checksum?.ok === true && g.checksum.lineTotal === "30000", "①-4 検算 OK")
  const dhl = r.documents.find((d) => d.documentNumber === "DHL-1")!
  assert(dhl.currency === "USD" && dhl.totalAmount === "1493.8" && dhl.lines[0].costCategoryRaw === "国際輸送費" && dhl.lines[0].packageCount === 2 && dhl.lines[0].weightKg === "12.5", `①-5 USD・費目・件数・重さ: ${JSON.stringify(dhl.lines[0])}`)
  const f = r.documents.find((d) => d.documentNumber === "F-77")!
  assert(f.postingType === "REFERENCE" && f.pairedDocumentNumber === "G00115" && f.checksum === null, "①-6 参照の書類・対の書類No・書類税抜が空なら検算しない")
  const sums = sumCountedByCurrency(r.documents)
  assert(sums.JPY === "33000" && sums.USD === "1493.8" && Object.keys(sums).length === 2, `①-7 計上だけを通貨ごとに合計（参照 5000 は入らない）: ${JSON.stringify(sums)}`)
  passed++
}

// ② 見出しが1つ足りない → エラーで止まる
{
  const head = CSV_COLUMNS.filter((c) => c !== "計上区分").join(",")
  const r = parseSupplierInvoiceCsv(head + "\n" + row({}).split(",").slice(0, 33).join(","))
  assert(r.errors.length === 1 && r.errors[0].row === 1 && r.errors[0].message.includes("計上区分"), `②-1 ${JSON.stringify(r.errors)}`)
  assert(r.documents.length === 0, "②-2 書類は返さない")
  passed++
}

// ③ 「35400?」→ その行のエラー（ほかの行は読める）
{
  const text = [HEAD, row({ 行番号: "1", 金額税抜: "35400?" }), row({ 行番号: "2", 金額税抜: "20000" })].join("\n")
  const r = parseSupplierInvoiceCsv(text)
  assert(r.errors.length === 1 && r.errors[0].row === 2 && r.errors[0].column === "金額税抜", `③-1 ${JSON.stringify(r.errors)}`)
  assert(r.documents.length === 1 && r.documents[0].lines.length === 1 && r.documents[0].lines[0].lineNo === 2, "③-2 エラーの行は入れず、ほかの行は読む")
  passed++
}

// ④ 同じ書類で書類税込が行ごとに違う → エラー
{
  const text = [HEAD, row({ 行番号: "1" }), row({ 行番号: "2", 書類税込: "99999" })].join("\n")
  const r = parseSupplierInvoiceCsv(text)
  assert(r.errors.length === 1 && r.errors[0].row === 3 && r.errors[0].column === "書類税込", `④-1 ${JSON.stringify(r.errors)}`)
  assert(r.documents[0].lines.length === 1, "④-2 食い違う行は書類に入れない")
  passed++
}

// ⑤ 明細の合計と書類税抜が違う → 警告（エラーにしない）
{
  const text = [HEAD, row({ 行番号: "1", 金額税抜: "10000" }), row({ 行番号: "2", 金額税抜: "15000" })].join("\n")
  const r = parseSupplierInvoiceCsv(text)
  assert(r.errors.length === 0, "⑤-1 エラーではない")
  assert(r.warnings.length === 1 && r.warnings[0].message.includes("25000") && r.warnings[0].message.includes("30000"), `⑤-2 ${JSON.stringify(r.warnings)}`)
  assert(r.documents[0].checksum?.ok === false, "⑤-3 checksum.ok = false")
  passed++
}

// ⑥ 必須の欠け・月度の形・通貨・計上区分・日付
{
  const text = [HEAD,
    row({ 月度: "2026/10", 行番号: "1" }),
    row({ 月度: "202610", 行番号: "2" }),
    row({ 通貨: "GBP", 行番号: "3" }),
    row({ 計上区分: "計上済", 行番号: "4" }),
    row({ 発行日: "2026-13-01", 行番号: "5" }),
    row({ 相手先名: "", 行番号: "6" }),
  ].join("\n")
  const r = parseSupplierInvoiceCsv(text)
  const cols = r.errors.map((e) => `${e.row}:${e.column}`)
  assert(cols.includes("3:月度") && cols.includes("4:通貨") && cols.includes("5:計上区分") && cols.includes("6:発行日") && cols.includes("7:相手先名"), `⑥-1 ${JSON.stringify(cols)}`)
  assert(r.documents.length === 1 && r.documents[0].periodMonth === "2026-10" && r.documents[0].lines.length === 1, "⑥-2 2026/10 は 2026-10 に正規化して読める")
  passed++
}

// ⑦ 知らない列は無視して警告
{
  const text = [HEAD + ",備考2", row({}) + ",x"].join("\n")
  const r = parseSupplierInvoiceCsv(text)
  assert(r.errors.length === 0 && r.warnings.some((w) => w.message.includes("備考2")), `⑦-1 ${JSON.stringify(r.warnings)}`)
  passed++
}

console.log(`csv.test.ts: ${passed} groups passed`)
