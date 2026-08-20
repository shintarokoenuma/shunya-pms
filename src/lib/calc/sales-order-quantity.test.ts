/**
 * B-168 D-6: computeProductionQuantity の検証（テストランナー非依存）。
 *
 * このリポジトリには vitest/jest が無いため、外部フレームワークを import せず
 * 純粋な assert（throw）で書く。手動実行: `npx tsx src/lib/calc/sales-order-quantity.test.ts`
 */

import { computeProductionQuantity } from "./sales-order-quantity"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① RATE 5% / ordered=100 → 105
assert(
  computeProductionQuantity(100, "RATE", 5, null) === 105,
  "①RATE 5% ordered=100 → 105",
)

// ② RATE 5% / ordered=2 → 3（切り上げの確認・2.1 → 3）
assert(
  computeProductionQuantity(2, "RATE", 5, null) === 3,
  "②RATE 5% ordered=2 → 3（ceil）",
)

// ③ RATE 0% / ordered=50 → 50
assert(
  computeProductionQuantity(50, "RATE", 0, null) === 50,
  "③RATE 0% ordered=50 → 50",
)

// ④ QUANTITY +10 / ordered=100 → 110
assert(
  computeProductionQuantity(100, "QUANTITY", null, 10) === 110,
  "④QUANTITY +10 ordered=100 → 110",
)

// ⑤ ordered=0 → 0（両モード）
assert(
  computeProductionQuantity(0, "RATE", 5, null) === 0,
  "⑤RATE ordered=0 → 0",
)
assert(
  computeProductionQuantity(0, "QUANTITY", null, 10) === 0,
  "⑤QUANTITY ordered=0 → 0",
)

// ⑥ yieldRate=null / RATE → ordered と同値
assert(
  computeProductionQuantity(80, "RATE", null, null) === 80,
  "⑥RATE yieldRate=null → ordered",
)

// ⑦ yieldQuantity=null / QUANTITY → ordered と同値
assert(
  computeProductionQuantity(80, "QUANTITY", null, null) === 80,
  "⑦QUANTITY yieldQuantity=null → ordered",
)

// ⑧ 端数のもう1例: RATE 3% / ordered=33 → ceil(33.99)=34
assert(
  computeProductionQuantity(33, "RATE", 3, null) === 34,
  "⑧RATE 3% ordered=33 → 34（ceil）",
)

// 到達したら全ケース通過
console.log("sales-order-quantity.test.ts: 全ケース通過")
