/**
 * B-248: 色番の正規化（保存時）と表示（C/# を付けるか）の純関数の検証（テストランナー非依存・DB 非接続）。
 * 手動実行: `npx tsx src/lib/color-code.test.ts`
 */

import { formatColorCode, normalizeSupplierColorCode } from "./color-code"
import { normalizeSupplierColorCode as reExported } from "./validators/bom-item-colorway"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① 保存時の正規化（本番の実測の形を含む）
const normalizeCases: Array<[string, string]> = [
  ["c/#12", "12"],
  [" C/#29", "29"],
  ["C／＃100", "100"],
  ["C#100", "100"],
  ["100", "100"],
  ["カーキ", "カーキ"],
  ["C99", "C99"],
  ["", ""],
]
for (const [input, expected] of normalizeCases) {
  const got = normalizeSupplierColorCode(input)
  console.log(`normalize(${JSON.stringify(input)}) → ${JSON.stringify(got)}`)
  assert(got === expected, `① normalize(${JSON.stringify(input)}) は ${JSON.stringify(expected)}`)
  assert(normalizeSupplierColorCode(got) === got, `①' 冪等: ${JSON.stringify(input)}`)
}

// ② 表示: 数字で始まるときだけ C/# を付ける
const formatCases: Array<[string | null | undefined, string | null]> = [
  ["12", "C/#12"],
  ["カーキ", "カーキ"],
  ["", null],
  [null, null],
  [undefined, null],
  ["  ", null],
  ["c/#12", "c/#12"], // 旧データは二重にならない
]
for (const [input, expected] of formatCases) {
  const got = formatColorCode(input)
  console.log(`format(${JSON.stringify(input)}) → ${JSON.stringify(got)}`)
  assert(got === expected, `② format(${JSON.stringify(input)}) は ${JSON.stringify(expected)}`)
}

// ③ bom-item-colorway からの再 export は同じ関数
assert(reExported === normalizeSupplierColorCode, "③ 再 export は同一")

console.log("color-code.test.ts: all assertions passed")
