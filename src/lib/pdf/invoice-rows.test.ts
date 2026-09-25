/**
 * B-109 PR-4（P4-D7・P4-D8）: invoice-rows の検証（テストランナー非依存）。
 * 手動実行: `npx tsx src/lib/pdf/invoice-rows.test.ts`
 */

import {
  buildInvoiceRows,
  buildPaymentRows,
  mdSlash,
  numText,
  pdfText,
  yenText,
} from "./invoice-rows"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

const lines = [
  { deliveryDate: "2026-10-20", deliveryNumber: "DLV-2026-0012", itemCode: "AOI-01", itemName: "スポットプリントTシャツ", colorName: "晒し", size: "S", quantity: 2, unitPrice: 1000, subtotal: 2000 },
  { deliveryDate: "2026-10-20", deliveryNumber: "DLV-2026-0012", itemCode: null, itemName: "前受金充当（SO-2026-0002）", colorName: null, size: null, quantity: -1, unitPrice: 400, subtotal: -400 },
  { deliveryDate: "2026-10-06", deliveryNumber: "DLV-2026-0013", itemCode: "AOI-02", itemName: "パンツ", colorName: null, size: "M", quantity: 1, unitPrice: 500, subtotal: 500 },
  { deliveryDate: null, deliveryNumber: null, itemCode: null, itemName: "納品書なし", colorName: null, size: null, quantity: 1, unitPrice: 1, subtotal: 1 },
]
const payments = [
  { paymentNumber: "PAY-2026-0005", paymentDate: "2026-10-06", methodLabel: "振込", amount: 880, createdAt: "2026-10-06T09:00:00Z" },
]

// ① 入金の合計が御入金額と一致 → 1件ずつ出す
{
  const pr = buildPaymentRows(payments, "2026-10-31T10:00:00Z", 880)
  assert(pr.length === 1 && pr[0].description === "〔御入金〕振込" && pr[0].amount === 880, "① 一致 → 1件ずつ")
}

// ② 一致しない（発行後に入金を取消した等）→ 1行にまとめる
{
  const pr = buildPaymentRows([], "2026-10-31T10:00:00Z", 880)
  assert(pr.length === 1 && pr[0].description === "〔御入金〕期間内の入金合計" && pr[0].amount === 880 && pr[0].date === null, "② 不一致 → まとめ行")
}

// ③ 請求書より後に記録された入金は数えない（createdAt > invoice.createdAt）→ 合計 0 = 御入金額 0 → 行なし
{
  const pr = buildPaymentRows(payments, "2026-10-01T00:00:00Z", 0)
  assert(pr.length === 0, "③ 後から記録された入金は出ない・御入金額 0 なら行なし")
}

// ④ 日付順・同じ日は入金が先・日付なしは末尾・同順は元の並び
{
  const rows = buildInvoiceRows(lines, buildPaymentRows(payments, "2026-10-31T10:00:00Z", 880))
  assert(rows[0].kind === "payment" && rows[0].date === "2026-10-06", "④ 10/06 の入金が先頭（同じ日の納品より先）")
  assert(rows[1].kind === "item" && rows[1].docNumber === "DLV-2026-0013", "④' 10/06 の納品が 2 番目")
  assert(rows[2].kind === "item" && rows[2].description.startsWith("AOI-01"), "④'' 10/20 の Tシャツ")
  assert(rows[3].kind === "item" && rows[3].description === "前受金充当（SO-2026-0002）" && rows[3].amount === -400, "④''' 充当の行は元の並びのまま・マイナス")
  assert(rows[4].kind === "item" && rows[4].date === null, "④'''' 日付なしは末尾")
}

// ⑤ 表記: 品番　品名 / 色・サイズ / マイナスは ASCII "-" / ～ → 〜
{
  const rows = buildInvoiceRows(lines, [])
  const t = rows.find((r) => r.kind === "item" && r.description.startsWith("AOI-01"))
  assert(t !== undefined && t.kind === "item" && t.description === "AOI-01　スポットプリントTシャツ" && t.colorSize === "晒し・S", "⑤ 品番　品名 / 色・サイズ")
  assert(yenText(-400) === "-¥400" && yenText(1760) === "¥1,760" && numText(-1) === "-1", "⑤' マイナスは ASCII の -")
  assert(pdfText("10〜11") === "10〜11" && pdfText("10～11") === "10〜11", "⑤'' ～（U+FF5E）→ 〜（U+301C）")
  assert(mdSlash("2026-10-06") === "10/06", "⑤''' mm/dd")
}

console.log("invoice-rows.test.ts: all assertions passed")
