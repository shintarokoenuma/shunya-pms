/** B-212 FIX-1: format.ts の検証。手動実行: npx tsx src/lib/supplier-invoice/format.test.ts */
import { formatDecimalString, formatMoney, formatQuantity } from "./format"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}
let passed = 0

// ① 外貨は小数 2 桁固定
assert(formatMoney("1493.8", "USD") === "USD 1,493.80", `①-1 ${formatMoney("1493.8", "USD")}`)
assert(formatMoney("1493.80", "USD") === "USD 1,493.80", "①-2")
assert(formatMoney("6359.145", "USD") === "USD 6,359.15", `①-3 四捨五入 ${formatMoney("6359.145", "USD")}`)
assert(formatMoney("0.005", "USD") === "USD 0.01", "①-4 半分は切り上げ")
assert(formatMoney("1234567", "EUR") === "EUR 1,234,567.00", "①-5 整数も 2 桁")
assert(formatMoney("-12.5", "USD") === "USD −12.50", "①-6 負号")
passed++

// ② JPY は小数なし
assert(formatMoney("165000", "JPY") === "¥165,000", `②-1 ${formatMoney("165000", "JPY")}`)
assert(formatMoney("165000.00", "JPY") === "¥165,000", "②-2 .00 を落とす")
assert(formatMoney("1493.5", "JPY") === "¥1,494", "②-3 小数は四捨五入")
assert(formatMoney("-400", "JPY") === "−¥400", "②-4 負号は ¥ の前")
assert(formatMoney("0", "JPY") === "¥0" && formatMoney("-0.2", "JPY") === "¥0", "②-5 0 と −0 の丸め")
passed++

// ③ 数量は末尾の 0 を落とす
assert(formatQuantity("100.0000") === "100", `③-1 ${formatQuantity("100.0000")}`)
assert(formatQuantity("100.5000") === "100.5", "③-2")
assert(formatQuantity("1234.5678") === "1,234.5678", "③-3 最大 4 桁")
assert(formatQuantity("1234.56789") === "1,234.5679", "③-4 5 桁目は四捨五入")
assert(formatQuantity(null) === "—" && formatQuantity("") === "—", "③-5 空は —")
passed++

// ④ 数でない・大きな数（float を通さない）
assert(formatMoney("35400?", "JPY") === "35400?", "④-1 数でなければそのまま")
assert(formatDecimalString("123456789012345678.99", 2) === "123,456,789,012,345,678.99", `④-2 桁落ちしない ${formatDecimalString("123456789012345678.99", 2)}`)
assert(formatDecimalString("1,493.8", 2) === "1,493.80", "④-3 カンマ入りも読める")
assert(formatDecimalString(".5", 2) === "0.50" && formatDecimalString("7.", 0) === "7", "④-4 端の形")
passed++

console.log(`format.test.ts: ${passed} groups passed`)
