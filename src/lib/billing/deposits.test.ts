/**
 * B-109 PR-3（P3-D5）: summarizeDeposits の検証（テストランナー非依存）。
 *
 * このリポジトリには vitest/jest が無いため、外部フレームワークを import せず
 * 純粋な assert（throw）で書く。手動実行: `npx tsx src/lib/billing/deposits.test.ts`
 * ★「取消した納品書の行は数えない」「編集中の自分の納品書の行を除く」は DB の where（loadDepositSummaries）が担う。
 *   ここでは純関数に渡す行を呼び出し側で除いた前提で、集計そのものを確かめる。
 */

import { DeliveryLineKind } from "@prisma/client"
import { depositSummaryFor, summarizeDeposits } from "./deposits"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

const D = DeliveryLineKind.DEPOSIT
const A = DeliveryLineKind.DEPOSIT_APPLIED

// ① 請求のみ（前受金 400,000・充当なし）
{
  const m = summarizeDeposits([{ soId: "so1", lineKind: D, quantity: 1, unitPrice: 400000 }])
  const s = depositSummaryFor(m, "so1")
  assert(s.invoiced === 400000 && s.applied === 0 && s.remaining === 400000, "① 請求のみ")
}

// ② 一部充当（400,000 のうち 150,000 を充当・数量 −1 × 単価）
{
  const m = summarizeDeposits([
    { soId: "so1", lineKind: D, quantity: 1, unitPrice: 400000 },
    { soId: "so1", lineKind: A, quantity: -1, unitPrice: 150000 },
  ])
  const s = depositSummaryFor(m, "so1")
  assert(s.invoiced === 400000 && s.applied === 150000 && s.remaining === 250000, "② 一部充当")
}

// ③ 全部充当（残り 0）。充当が 2 回に分かれても合計で見る
{
  const m = summarizeDeposits([
    { soId: "so1", lineKind: D, quantity: 1, unitPrice: 400000 },
    { soId: "so1", lineKind: A, quantity: -1, unitPrice: 150000 },
    { soId: "so1", lineKind: A, quantity: -1, unitPrice: 250000 },
  ])
  const s = depositSummaryFor(m, "so1")
  assert(s.invoiced === 400000 && s.applied === 400000 && s.remaining === 0, "③ 全部充当")
}

// ④ 取消した納品書の行は数えない（呼び出し側が除いて渡す＝渡さなければ集計に入らない）
{
  // 取消済み納品書の DEPOSIT 行（400,000）を除いて渡す → 請求済み 0
  const m = summarizeDeposits([{ soId: "so1", lineKind: A, quantity: -1, unitPrice: 0 }])
  const s = depositSummaryFor(m, "so1")
  assert(s.invoiced === 0 && s.applied === 0 && s.remaining === 0, "④ 取消行を除けば 0")
  // 受注に行が 1 つも無いときもゼロ（undefined にならない）
  const none = depositSummaryFor(m, "so-none")
  assert(none.invoiced === 0 && none.remaining === 0, "④' 行なし → ゼロ")
}

// ⑤ 編集中の自分の納品書の行を除く（除いた集計に、フォームの充当額を足して上限判定する想定）
{
  const others = summarizeDeposits([
    { soId: "so1", lineKind: D, quantity: 1, unitPrice: 400000 },
    { soId: "so1", lineKind: A, quantity: -1, unitPrice: 100000 }, // 別の納品書の充当
  ])
  const remaining = depositSummaryFor(others, "so1").remaining
  assert(remaining === 300000, "⑤ 自分の行を除いた残り 300,000")
  // 自分の納品書で 300,000 までは可、300,001 は不可（P3-D4 の判定）
  assert(300000 <= remaining, "⑤' 上限ちょうどは可")
  assert(!(300001 <= remaining), "⑤'' 上限超えは不可")
}

// ⑥ 受注が違えば別集計
{
  const m = summarizeDeposits([
    { soId: "so1", lineKind: D, quantity: 1, unitPrice: 100 },
    { soId: "so2", lineKind: D, quantity: 1, unitPrice: 200 },
  ])
  assert(depositSummaryFor(m, "so1").invoiced === 100 && depositSummaryFor(m, "so2").invoiced === 200, "⑥ 受注ごと")
}

console.log("deposits.test.ts: all assertions passed")
