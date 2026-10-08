/**
 * B-266 D-2: formatDesignCode（デザイン番号の表示）の検証（テストランナー非依存）。
 * 手動実行: `npx tsx src/lib/pdf/design-code.test.ts`
 */

import { formatDesignCode } from "../design-code"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

const cases: [string | null | undefined, string | null, string][] = [
  [null, null, "① null → null"],
  [undefined, null, "① undefined → null"],
  ["", null, "① 空文字 → null"],
  ["  ", null, "① 空白だけ → null"],
  ["D-1", "D/# D-1", "② 頭なし → D/# を付ける"],
  ["D-1 ", "D/# D-1", "② 末尾の空白を取ってから付ける（dev の「D-1 」）"],
  ["DJ", "D/# DJ", "② DJ（D で始まるが # が無い）→ 付ける"],
  ["DHL", "D/# DHL", "② DHL → 付ける"],
  ["D/#A", "D/#A", "③ D/# で始まる → そのまま"],
  ["d# 12", "d# 12", "③ 小文字 d# → そのまま（大文字小文字を問わない）"],
  ["D / # 7", "D / # 7", "③ 間に空白がある D / # → そのまま"],
  [" D#5 ", "D#5", "③ 前後の空白は取る"],
]
let passed = 0
for (const [input, expected, label] of cases) {
  const got = formatDesignCode(input)
  assert(got === expected, `${label}: ${JSON.stringify(input)} → ${JSON.stringify(got)}（期待 ${JSON.stringify(expected)}）`)
  passed++
}

console.log(`design-code.test.ts: ${passed}/${cases.length} cases passed`)
