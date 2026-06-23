/**
 * B-067 D4(ア) 集計ロジックの検証（テストランナー非依存）。
 *
 * このリポジトリには vitest/jest が無いため、外部フレームワークを import せず
 * 純粋な assert（throw）で書く。tsc が通ること＝最低限の型/ロジック健全性の担保。
 * 手動実行する場合: `npx tsx src/lib/calc/material-requirement.test.ts`
 */

import {
  computeMaterialRequirements,
  type MaterialReqBomItem,
} from "./material-requirement"
import type { SkuRow } from "@/lib/types/sku"

function sku(colorwayId: string, productionQuantity: number, size = "M"): SkuRow {
  return {
    id: `${colorwayId}-${size}`,
    colorwayId,
    colorwayCode: colorwayId,
    colorwayName: colorwayId,
    colorCode: colorwayId,
    colorName: colorwayId,
    size,
    sizeOrder: 0,
    orderedQuantity: 0,
    productionQuantity,
    producedQuantity: 0,
    deliveredQuantity: 0,
    defectQuantity: 0,
    remainingStock: 0,
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

// ① 色非依存 × 数量 × 用尺：全 SKU 合計 × ロス込み用尺
;(() => {
  const skus = [sku("A", 100, "M"), sku("A", 50, "L"), sku("B", 30, "M")]
  const items: MaterialReqBomItem[] = [
    { id: "i1", itemLabel: "本体生地", itemCategory: "FABRIC", usagePerUnit: 1.5, lossRate: 10, unit: "m", colorways: [] },
  ]
  const [row] = computeMaterialRequirements(skus, items)
  assert(row.status === "OK", "①status OK")
  assert(row.breakdown.length === 1, "①breakdown 1行")
  assert(row.breakdown[0].colorwayId === null, "①共通行")
  assert(row.breakdown[0].quantity === 180, "①数量合計180")
  // totalUsage = 1.5*1.1 = 1.65 / requirement = 180*1.65 = 297
  assert(Math.abs((row.breakdown[0].totalUsage ?? 0) - 1.65) < 1e-9, "①totalUsage 1.65")
  assert(Math.abs((row.breakdown[0].requirement ?? 0) - 297) < 1e-9, "①requirement 297")
})()

// ② カラーウェイ別：colorways ごとに該当 SKU 合計 × 用尺
;(() => {
  const skus = [sku("cwA", 100), sku("cwB", 40)]
  const items: MaterialReqBomItem[] = [
    {
      id: "i2", itemLabel: "本体生地", itemCategory: "FABRIC", usagePerUnit: 2, lossRate: 0, unit: "m",
      colorways: [
        { productColorwayId: "cwA", colorwayCode: "A", supplierColorCode: "BLK" },
        { productColorwayId: "cwB", colorwayCode: "B", supplierColorCode: "WHT" },
      ],
    },
  ]
  const [row] = computeMaterialRequirements(skus, items)
  assert(row.breakdown.length === 2, "②breakdown 2行")
  const a = row.breakdown.find((b) => b.colorwayId === "cwA")!
  const b = row.breakdown.find((b) => b.colorwayId === "cwB")!
  assert(a.quantity === 100 && a.requirement === 200, "②cwA 100→200")
  assert(b.quantity === 40 && b.requirement === 80, "②cwB 40→80")
  assert(a.supplierColorCode === "BLK", "②調達色 BLK")
})()

// ③ usagePerUnit=null：USAGE_MISSING・requirement=null（数量は出す）
;(() => {
  const skus = [sku("A", 100)]
  const items: MaterialReqBomItem[] = [
    { id: "i3", itemLabel: "未入力資材", itemCategory: "ACCESSORY", usagePerUnit: null, lossRate: 0, unit: "個", colorways: [] },
  ]
  const [row] = computeMaterialRequirements(skus, items)
  assert(row.status === "USAGE_MISSING", "③USAGE_MISSING")
  assert(row.breakdown[0].requirement === null, "③requirement null")
  assert(row.breakdown[0].totalUsage === null, "③totalUsage null")
  assert(row.breakdown[0].quantity === 100, "③数量は出す")
})()

// ④ BomItemColorway 持ちで該当 SKU 無し：quantity=0 / requirement=0
;(() => {
  const skus = [sku("cwA", 100)]
  const items: MaterialReqBomItem[] = [
    {
      id: "i4", itemLabel: "本体生地", itemCategory: "FABRIC", usagePerUnit: 1, lossRate: 0, unit: "m",
      colorways: [{ productColorwayId: "cwZ", colorwayCode: "Z", supplierColorCode: "NVY" }],
    },
  ]
  const [row] = computeMaterialRequirements(skus, items)
  assert(row.breakdown[0].quantity === 0, "④数量0")
  assert(row.breakdown[0].requirement === 0, "④requirement 0")
})()

// 到達したら全ケース通過
console.log("material-requirement.test.ts: all assertions passed")
