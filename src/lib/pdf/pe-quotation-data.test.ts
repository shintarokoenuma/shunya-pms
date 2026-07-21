/**
 * B-085 量産見積 PDF データ整形（純関数部）の検証（テストランナー非依存）。
 * vitest/jest が無いため assert（throw）で書く。手動実行:
 *   npx tsx src/lib/pdf/pe-quotation-data.test.ts
 *
 * 対象: ガード判定（isPeNotReady）・単価解決（resolvePeUnitPriceJpy・切り上げ）・
 *       別枠選別（selectSeparateRows）・合計（computePeTotals）。
 */

import {
  resolvePeUnitPriceJpy,
  isPeNotReady,
  selectSeparateRows,
  computePeTotals,
} from "./pe-quotation-data"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

let passed = 0

// ① 単価解決: 手打ち優先・整数円切り上げ
;(() => {
  assert(resolvePeUnitPriceJpy(1500, 999) === 1500, "①手打ち優先=1500")
  assert(resolvePeUnitPriceJpy(null, 52466.67) === 52467, "①自動を円未満切り上げ=52467")
  assert(resolvePeUnitPriceJpy(null, 100) === 100, "①端数なしはそのまま=100")
  assert(resolvePeUnitPriceJpy(null, null) === null, "①両方 null → null")
  passed++
})()

// ② PE_NOT_READY 判定
;(() => {
  assert(isPeNotReady(0, 1500, null) === true, "②数量0 は not ready")
  assert(isPeNotReady(-1, 1500, 999) === true, "②数量負 は not ready")
  assert(isPeNotReady(3, null, null) === true, "②単価なし（両 null）は not ready")
  assert(isPeNotReady(3, null, 999) === false, "②自動単価あり → ready")
  assert(isPeNotReady(3, 1500, null) === false, "②手打ち単価あり → ready")
  passed++
})()

// ③ 別枠選別: isSeparateBilling かつ presentedPriceManualJpy 非 null のみ（フォールバックなし）
;(() => {
  const items = [
    { isSeparateBilling: true, presentedPriceManualJpy: 30000, itemName: "版代" },
    { isSeparateBilling: true, presentedPriceManualJpy: null, itemName: "パンチ代" }, // 非計上→出さない
    { isSeparateBilling: false, presentedPriceManualJpy: 999, itemName: "縫製" }, // 別枠でない→出さない
  ]
  const rows = selectSeparateRows(items, "Tシャツ（AOI-001）")
  assert(rows.length === 1, "③計上されるのは1行のみ")
  assert(rows[0].label === "版代（Tシャツ（AOI-001））", "③項目名に productLabel 付記")
  assert(rows[0].amountJpy === 30000, "③金額=presentedPriceManualJpy そのもの")
  passed++
})()

// ④ 合計: 製品合計・別枠合計・総合計（=製品+別枠・税なし）
;(() => {
  const t = computePeTotals(
    [{ amountJpy: 150000 }, { amountJpy: 7400 }],
    [{ amountJpy: 30000 }],
  )
  assert(t.productTotalJpy === 157400, "④製品合計=157,400")
  assert(t.separateTotalJpy === 30000, "④別枠合計=30,000")
  assert(t.grandTotalJpy === 187400, "④総合計=製品+別枠=187,400")
  // 別枠0件でも総合計=製品合計
  const t2 = computePeTotals([{ amountJpy: 6000 }], [])
  assert(t2.grandTotalJpy === 6000, "④別枠0件→総合計=製品合計")
  passed++
})()

console.log(`✓ pe-quotation-data: ${passed}/4 ケース PASS`)
