/**
 * QE-1 量産原価集計ロジックの検証（テストランナー非依存）。
 *
 * このリポジトリには vitest/jest が無いため、外部フレームワークを import せず
 * 純粋な assert（throw）で書く。tsc が通ること＝最低限の型/ロジック健全性の担保。
 * 手動実行: `npx tsx src/lib/calc/production-cost.test.ts`
 *
 * ブリーフ §4 の 9 ケース:
 * ① ROLL 取り切り（端数で反数+1）② METER＋カット代 ③ ROLL rollLength null 除外
 * ④ 工賃 unitPrice null 除外 ⑤ INDIVIDUAL_BILLING が分子除外され別枠に出る
 * ⑥ USD 換算合算 ⑦ CNY 対象外除外 ⑧ Σqty=0 ガード ⑨ 分母一致（#93 と同値）
 */

import {
  computeProductionCost,
  type MaterialCostInput,
  type LaborCostInput,
} from "./production-cost"
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

function mat(over: Partial<MaterialCostInput>): MaterialCostInput {
  return {
    bomItemId: "m1",
    itemLabel: "本体生地",
    itemCategory: "MAIN_FABRIC",
    usagePerUnit: 1,
    lossRate: 0,
    unit: "m",
    procurementMode: "METER",
    unitPrice: 100,
    currency: "JPY",
    rollLength: null,
    rollPrice: null,
    rollCurrency: null,
    cutFee: null,
    ...over,
  }
}

function lab(over: Partial<LaborCostInput>): LaborCostInput {
  return {
    woItemId: "w1",
    woId: "wo1",
    woNumber: "WO-2026-0001",
    workDescription: "縫製",
    quantity: 100,
    unitPrice: 100,
    currency: "JPY",
    externalCategory: "SEWING",
    billingClassification: null,
    ...over,
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}

function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6
}

let passed = 0

// ① ROLL 取り切り（端数で反数+1）
;(() => {
  const skus = [sku("A", 100)]
  // requirement = 100 × 1.5 × 1.0 = 150 / rollLength 100 → ceil(1.5)=2反 × ¥50,000 = ¥100,000
  const materials = [
    mat({
      procurementMode: "ROLL",
      usagePerUnit: 1.5,
      lossRate: 0,
      rollLength: 100,
      rollPrice: 50000,
      rollCurrency: "JPY",
    }),
  ]
  const r = computeProductionCost(skus, materials, [], null)
  const row = r.sections[0].rows[0]
  assert(row.note === "2反", "①反数=2反")
  assert(approx(row.amountJpy ?? -1, 100000), "①生地コスト¥100,000")
  assert(!row.excluded, "①除外されない")
  assert(approx(r.materialTotalJpy, 100000), "①材料費Σ")
  assert(approx(r.unitCostJpy ?? -1, 1000), "①1枚原価=1000")
  passed++
})()

// ② METER＋カット代
;(() => {
  const skus = [sku("A", 100)]
  // requirement = 100 × 2 = 200 / ×¥300 = 60,000 ＋ カット代 5,000 = 65,000
  const materials = [
    mat({
      procurementMode: "METER",
      usagePerUnit: 2,
      lossRate: 0,
      unitPrice: 300,
      cutFee: 5000,
    }),
  ]
  const r = computeProductionCost(skus, materials, [], null)
  const row = r.sections[0].rows[0]
  assert(approx(row.amountJpy ?? -1, 65000), "②生地コスト＋カット代=65,000")
  assert(row.note === "カット代含む", "②カット代注記")
  passed++
})()

// ③ ROLL rollLength null → AMOUNT_UNDECIDED 除外
;(() => {
  const skus = [sku("A", 100)]
  const materials = [
    mat({
      procurementMode: "ROLL",
      usagePerUnit: 1.5,
      rollLength: null,
      rollPrice: 50000,
      rollCurrency: "JPY",
    }),
  ]
  const r = computeProductionCost(skus, materials, [], null)
  const row = r.sections[0].rows[0]
  assert(row.excluded, "③除外される")
  assert(row.excludeReason === "AMOUNT_UNDECIDED", "③理由=AMOUNT_UNDECIDED")
  assert(approx(r.materialTotalJpy, 0), "③材料費Σ=0")
  passed++
})()

// ④ 工賃 unitPrice null → AMOUNT_UNDECIDED 除外
;(() => {
  const skus = [sku("A", 100)]
  const labor = [lab({ unitPrice: null })]
  const r = computeProductionCost(skus, [], labor, null)
  const laborSec = r.sections.find((s) => s.group === "labor")
  assert(laborSec !== undefined, "④工賃セクション存在")
  assert(laborSec!.rows[0].excluded, "④工賃行除外")
  assert(
    laborSec!.rows[0].excludeReason === "AMOUNT_UNDECIDED",
    "④理由=AMOUNT_UNDECIDED",
  )
  assert(approx(r.laborTotalJpy, 0), "④工賃Σ=0")
  passed++
})()

// ⑤ INDIVIDUAL_BILLING が分子除外され別枠に出る
;(() => {
  const skus = [sku("A", 500)]
  const labor = [
    lab({ workDescription: "縫製", unitPrice: 800, quantity: 500 }), // 400,000 集計
    lab({
      woItemId: "w2",
      workDescription: "プリント版代",
      unitPrice: 30000,
      quantity: 1,
      externalCategory: "PROCESSING",
      billingClassification: "INDIVIDUAL_BILLING",
    }),
  ]
  const r = computeProductionCost(skus, [], labor, null)
  assert(approx(r.laborTotalJpy, 400000), "⑤工賃Σ=縫製のみ400,000")
  assert(approx(r.separateTotalJpy, 30000), "⑤別枠=版代30,000")
  const sep = r.sections.find((s) => s.group === "separate")
  assert(sep !== undefined, "⑤別枠セクション存在")
  assert(sep!.rows[0].excludeReason === "INDIVIDUAL_BILLING", "⑤理由=INDIVIDUAL_BILLING")
  // 1枚原価は版代を含めない = 400,000 / 500 = 800
  assert(approx(r.unitCostJpy ?? -1, 800), "⑤1枚原価に版代混入せず=800")
  passed++
})()

// ⑥ USD 換算合算
;(() => {
  const skus = [sku("A", 10)]
  // requirement = 10 × 1 = 10 / ×$12 = $120 → ×150 = ¥18,000
  const materials = [
    mat({
      procurementMode: "METER",
      usagePerUnit: 1,
      unitPrice: 12,
      currency: "USD",
    }),
  ]
  const r = computeProductionCost(skus, materials, [], 150)
  const row = r.sections[0].rows[0]
  assert(!row.excluded, "⑥USD行は換算され集計対象")
  assert(approx(row.amountOriginal ?? -1, 120), "⑥原通貨$120")
  assert(approx(row.amountJpy ?? -1, 18000), "⑥JPY換算¥18,000")
  assert(approx(r.materialTotalJpy, 18000), "⑥材料費Σ=18,000")
  passed++
})()

// ⑦ CNY 対象外除外
;(() => {
  const skus = [sku("A", 100)]
  const labor = [lab({ currency: "CNY", unitPrice: 50, quantity: 100 })]
  const r = computeProductionCost(skus, [], labor, 150)
  const laborSec = r.sections.find((s) => s.group === "labor")
  assert(laborSec!.rows[0].excluded, "⑦CNY行除外")
  assert(
    laborSec!.rows[0].excludeReason === "NON_TARGET_CURRENCY",
    "⑦理由=NON_TARGET_CURRENCY",
  )
  assert(approx(r.laborTotalJpy, 0), "⑦工賃Σ=0（対象外通貨）")
  passed++
})()

// ⑧ Σqty=0 ガード
;(() => {
  const skus = [sku("A", 0), sku("B", 0)]
  const materials = [mat({ unitPrice: 100 })]
  const r = computeProductionCost(skus, materials, [], null)
  assert(r.totalQuantity === 0, "⑧Σqty=0")
  assert(r.unitCostJpy === null, "⑧1枚原価は null（ゼロ除算ガード）")
  passed++
})()

// ⑨ 分母一致（#93 computeMaterialRequirements と同値）
;(() => {
  const skus = [sku("A", 100), sku("B", 50)]
  const reqItems: MaterialReqBomItem[] = [
    {
      id: "i1",
      itemLabel: "本体生地",
      itemCategory: "MAIN_FABRIC",
      usagePerUnit: 1,
      lossRate: 0,
      unit: "m",
      colorways: [],
    },
  ]
  const mr = computeMaterialRequirements(skus, reqItems)
  const mrQty = mr[0].breakdown.reduce((s, b) => s + b.quantity, 0)
  const pc = computeProductionCost(skus, [mat({})], [], null)
  assert(pc.totalQuantity === mrQty, "⑨分母が #93 と一致")
  assert(pc.totalQuantity === 150, "⑨分母=150")
  passed++
})()

// ⑩ ROLL の反数・買う量・残尺・取り切り枚数（B-133 表示用）
;(() => {
  const skus = [sku("A", 50)]
  // requirement = 50 × 6 × 1.1 = 330 / rollLength 12 → rolls=ceil(330/12)=28
  // purchased = 28×12 = 336 / remaining = 336−330 = 6
  // 1枚あたり所要 = 6×1.1 = 6.6 / maxUnits = floor(336/6.6) = 50
  const materials = [
    mat({
      procurementMode: "ROLL",
      usagePerUnit: 6,
      lossRate: 10,
      rollLength: 12,
      rollPrice: 700,
      rollCurrency: "JPY",
    }),
  ]
  const r = computeProductionCost(skus, materials, [], null)
  const row = r.sections[0].rows[0]
  assert(row.rolls === 28, "⑩反数=28")
  assert(approx(row.purchasedQuantity ?? -1, 336), "⑩買う量=336")
  assert(approx(row.remainingQuantity ?? -1, 6), "⑩残尺=6")
  assert(row.maxUnitsFromRolls === 50, "⑩取り切り枚数=50")
  // 計算不変: amountJpy = 28反 × 700 = 19,600
  assert(approx(row.amountJpy ?? -1, 19600), "⑩生地コスト=19,600")
  passed++
})()

// ⑪ rollLength null → rolls/purchased/remaining/maxUnits すべて null
;(() => {
  const skus = [sku("A", 50)]
  const materials = [
    mat({
      procurementMode: "ROLL",
      usagePerUnit: 6,
      lossRate: 10,
      rollLength: null,
      rollPrice: 700,
      rollCurrency: "JPY",
    }),
  ]
  const r = computeProductionCost(skus, materials, [], null)
  const row = r.sections[0].rows[0]
  assert(row.rolls === null, "⑪反数 null")
  assert(row.purchasedQuantity === null, "⑪買う量 null")
  assert(row.remainingQuantity === null, "⑪残尺 null")
  assert(row.maxUnitsFromRolls === null, "⑪取り切り枚数 null")
  passed++
})()

// ⑫ rollPrice=null かつ unitPrice/rollLength あり → 単価×原反長 で導出計算される（B-133 Step 16）
;(() => {
  const skus = [sku("A", 100)]
  // requirement = 100 × 2 × 1.05 = 210 / rollLength 50 → rolls=ceil(210/50)=5
  // 有効反単価 = 単価1000 × 原反長50 = 50,000 / amountOriginal = 5 × 50,000 = 250,000
  // purchased = 5×50 = 250 / remaining = 250−210 = 40
  // 1枚あたり所要 = 2×1.05 = 2.1 / maxUnits = floor(250/2.1) = 119
  const materials = [
    mat({
      procurementMode: "ROLL",
      usagePerUnit: 2,
      lossRate: 5,
      unitPrice: 1000,
      currency: "JPY",
      rollLength: 50,
      rollPrice: null,
      rollCurrency: null,
    }),
  ]
  const r = computeProductionCost(skus, materials, [], null)
  const row = r.sections[0].rows[0]
  assert(!row.excluded, "⑫導出値で計上され除外されない")
  assert(row.rollPriceDerived === true, "⑫rollPriceDerived=true")
  assert(row.rolls === 5, "⑫反数=5")
  assert(approx(row.unitPrice ?? -1, 50000), "⑫有効反単価=50,000")
  assert(approx(row.amountJpy ?? -1, 250000), "⑫生地コスト=250,000")
  assert(approx(row.purchasedQuantity ?? -1, 250), "⑫買う量=250")
  assert(approx(row.remainingQuantity ?? -1, 40), "⑫残尺=40")
  assert(row.maxUnitsFromRolls === 119, "⑫取り切り枚数=119")
  passed++
})()

// ⑬ 導出時の通貨は行通貨（currency）に従う（B-133 Step 16）
;(() => {
  const skus = [sku("A", 10)]
  // requirement = 10 × 1 = 10 / rollLength 50 → rolls=ceil(10/50)=1
  // 有効反単価 = 単価$12 × 原反長50 = $600 / amountOriginal = 1 × 600 = $600
  // 行通貨 USD で導出 → ×150 = ¥90,000
  const materials = [
    mat({
      procurementMode: "ROLL",
      usagePerUnit: 1,
      lossRate: 0,
      unitPrice: 12,
      currency: "USD",
      rollLength: 50,
      rollPrice: null,
      rollCurrency: null,
    }),
  ]
  const r = computeProductionCost(skus, materials, [], 150)
  const row = r.sections[0].rows[0]
  assert(row.rollPriceDerived === true, "⑬rollPriceDerived=true")
  assert(row.currency === "USD", "⑬導出通貨=行通貨USD")
  assert(approx(row.amountOriginal ?? -1, 600), "⑬原通貨$600")
  assert(approx(row.amountJpy ?? -1, 90000), "⑬JPY換算¥90,000")
  assert(!row.excluded, "⑬USD行は換算され集計対象")
  passed++
})()

console.log(`✓ production-cost: ${passed}/13 ケース PASS`)
