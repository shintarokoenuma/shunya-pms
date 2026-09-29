/**
 * B-248: 色番の正規化（保存時・NFKC で全角を半角に）と表示（番号にだけ C/# を1回付ける）の純関数の検証（テストランナー非依存・DB 非接続）。
 * 手動実行: `npx tsx src/lib/color-code.test.ts`
 */

import { formatColorCode, normalizeSupplierColorCode } from "./color-code"
import { normalizeSupplierColorCode as reExported } from "./validators/bom-item-colorway"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① 保存時の正規化（本番・dev の実測の形を含む）と冪等
const normalizeCases: Array<[string, string]> = [
  ["c/#12", "12"],
  [" C/#29", "29"],
  ["C／＃100", "100"],
  ["C/＃８", "8"],
  ["ＢＫ０１", "BK01"],
  ["C#100", "100"],
  ["カーキ", "カーキ"],
  ["C99", "C99"],
  ["", ""],
]
for (const [input, expected] of normalizeCases) {
  const got = normalizeSupplierColorCode(input)
  const twice = normalizeSupplierColorCode(got)
  console.log(`normalize(${JSON.stringify(input)}) → ${JSON.stringify(got)}（再適用 ${JSON.stringify(twice)}）`)
  assert(got === expected, `① normalize(${JSON.stringify(input)}) は ${JSON.stringify(expected)}`)
  assert(twice === got, `①' 冪等: ${JSON.stringify(input)}`)
}

// ② 表示: 数字を含み日本語を含まない値にだけ C/# を1回付ける
const formatCases: Array<[string | null | undefined, string | null]> = [
  ["12", "C/#12"],
  ["BK01", "C/#BK01"],
  ["A12", "C/#A12"],
  ["12A", "C/#12A"],
  ["BLACK", "BLACK"],
  ["NAVY", "NAVY"],
  ["カーキ", "カーキ"],
  ["黒量がい", "黒量がい"],
  ["c/#12", "C/#12"], // 旧データも1回だけ
  ["C/＃８", "C/#8"],
  ["", null],
  [null, null],
  [undefined, null],
]
for (const [input, expected] of formatCases) {
  const got = formatColorCode(input)
  console.log(`format(${JSON.stringify(input)}) → ${JSON.stringify(got)}`)
  assert(got === expected, `② format(${JSON.stringify(input)}) は ${JSON.stringify(expected)}`)
}

// ③ bom-item-colorway からの再 export は同じ関数
assert(reExported === normalizeSupplierColorCode, "③ 再 export は同一")

console.log("color-code.test.ts: all assertions passed")
