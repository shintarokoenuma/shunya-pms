/**
 * (A) 量産見積 seed① 計算ロジックの検証（テストランナー非依存）。
 *
 * このリポジトリには vitest/jest が無いため、外部フレームワークを import せず
 * 純粋な assert（throw）で書く。tsc が通ること＝最低限の型/ロジック健全性の担保。
 * 手動実行: `npx tsx src/lib/production-estimate/calc.test.ts`
 *
 * ブリーフ §3 の 7 ケース＋PR-2 追加修正の 2 ケース:
 * ① サンプルコピー行の単価×量産数量の再計算　② ROLL 端数（反数 ceil）
 * ③ METER＋カット代　④ INDIVIDUAL_BILLING 由来行が分子除外・別枠表示
 * ⑤ USD 換算　⑥ estimateQuantity=0 ガード　⑦ 手打ち単価が自動値より優先される導出
 * ⑧ 付属 usagePerUnit=1 行の所要量=見積数量・perUnitJpy=単価×(1+ロス)
 * ⑨ materialPerUnitJpy + laborPerUnitJpy = autoUnitCostJpy
 * ⑩ procurementMode≠METER の行では cutFee を計算に含めない
 */

import {
  computeProductionEstimate,
  resolveFinalUnitPriceJpy,
  computeGrandTotalJpy,
  type ProductionEstimateLineForCalc,
} from "./calc"

function line(
  over: Partial<ProductionEstimateLineForCalc>,
): ProductionEstimateLineForCalc {
  return {
    id: "l1",
    itemCategory: "LABOR",
    isSeparateBilling: false,
    usagePerUnit: null,
    lossRate: 0,
    procurementMode: null,
    rollLength: null,
    rollPrice: null,
    rollCurrency: null,
    cutFee: null,
    unitPrice: null,
    currency: "JPY",
    quantity: null,
    unit: null,
    presentedPriceManualJpy: null,
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

// ① サンプルコピー行の単価×量産数量の再計算（工賃 200 × 100 枚 = 20,000／利益率40%）
;(() => {
  const lines = [line({ id: "sew", unitPrice: 200, quantity: 100 })]
  const r = computeProductionEstimate(lines, 100, 40, null)
  assert(approx(r.laborNumeratorJpy, 20000), "①工賃Σ=20,000")
  assert(approx(r.numeratorJpy, 20000), "①分子=20,000")
  assert(approx(r.autoUnitCostJpy ?? -1, 200), "①1枚原価=200")
  assert(approx(r.autoUnitPriceJpy ?? -1, 280), "①1枚単価=280（×1.4）")
  assert(r.rows[0].counted, "①計上される")
  passed++
})()

// ② ROLL 端数（用尺1.5 × 100枚 = 150 / 反長100 → ceil=2反 × ¥50,000 = ¥100,000）
;(() => {
  const lines = [
    line({
      id: "fabric",
      itemCategory: "MATERIAL",
      usagePerUnit: 1.5,
      lossRate: 0,
      procurementMode: "ROLL",
      rollLength: 100,
      rollPrice: 50000,
      rollCurrency: "JPY",
    }),
  ]
  const r = computeProductionEstimate(lines, 100, null, null)
  assert(approx(r.materialNumeratorJpy, 100000), "②材料費Σ=¥100,000")
  assert(approx(r.autoUnitCostJpy ?? -1, 1000), "②1枚原価=1000")
  assert(r.autoUnitPriceJpy === null, "②marginRate null → 単価 null")
  assert(r.rows[0].isRequirementRow, "②所要量ベース行")
  passed++
})()

// ③ METER＋カット代（用尺1 × 100 × (1+0.1) = 110 × ¥100 ＋ カット代¥5,000 = ¥16,000）
;(() => {
  const lines = [
    line({
      id: "meter",
      itemCategory: "MATERIAL",
      usagePerUnit: 1,
      lossRate: 10,
      procurementMode: "METER",
      unitPrice: 100,
      cutFee: 5000,
      currency: "JPY",
    }),
  ]
  const r = computeProductionEstimate(lines, 100, null, null)
  assert(approx(r.materialNumeratorJpy, 16000), "③材料費Σ=¥16,000（カット代込み）")
  assert(approx(r.autoUnitCostJpy ?? -1, 160), "③1枚原価=160")
  passed++
})()

// ④ INDIVIDUAL_BILLING 由来行（別枠・presentedPriceManualJpy）が分子除外され別枠に出る
;(() => {
  const lines = [
    line({ id: "sew", unitPrice: 200, quantity: 100 }),
    line({
      id: "pattern",
      unitPrice: 30000,
      quantity: 1,
      isSeparateBilling: true,
      presentedPriceManualJpy: 30000,
    }),
  ]
  const r = computeProductionEstimate(lines, 100, 40, null)
  assert(approx(r.numeratorJpy, 20000), "④分子は縫製のみ=20,000（版代は除外）")
  assert(approx(r.autoUnitCostJpy ?? -1, 200), "④1枚原価=200（版代混入なし）")
  assert(approx(r.separateTotalJpy, 30000), "④別枠合計=¥30,000")
  const sep = r.rows.find((x) => x.itemId === "pattern")
  assert(sep !== undefined && !sep.counted, "④別枠行は counted=false")
  assert(sep !== undefined && sep.isSeparateBilling, "④別枠行フラグ")
  passed++
})()

// ⑤ USD 換算（$10 × 100 = $1,000 × レート150 = ¥150,000）
;(() => {
  const lines = [
    line({ id: "usd-sew", unitPrice: 10, quantity: 100, currency: "USD" }),
  ]
  const r = computeProductionEstimate(lines, 100, null, 150)
  assert(approx(r.numeratorJpy, 150000), "⑤USD 換算=¥150,000")
  assert(approx(r.autoUnitCostJpy ?? -1, 1500), "⑤1枚原価=1500")
  // レート未入力なら除外（分子に入らない）
  const noRate = computeProductionEstimate(lines, 100, null, null)
  assert(approx(noRate.numeratorJpy, 0), "⑤レート null → USD 行除外（分子0）")
  assert(!noRate.rows[0].counted, "⑤レート null → counted=false")
  passed++
})()

// ⑥ estimateQuantity=0 ガード（0 除算せず null）
;(() => {
  const lines = [line({ id: "sew", unitPrice: 200, quantity: 100 })]
  const r = computeProductionEstimate(lines, 0, 40, null)
  assert(r.autoUnitCostJpy === null, "⑥estimateQuantity=0 → 原価 null")
  assert(r.autoUnitPriceJpy === null, "⑥estimateQuantity=0 → 単価 null")
  passed++
})()

// ⑦ 手打ち単価が自動値より優先される導出
;(() => {
  const manual = resolveFinalUnitPriceJpy(280, 300)
  assert(manual.valueJpy === 300 && manual.isManual, "⑦手打ち優先（300・isManual）")
  const auto = resolveFinalUnitPriceJpy(280, null)
  assert(auto.valueJpy === 280 && !auto.isManual, "⑦手打ち null → 自動280")
  // 総合計 = 単価×数量 + 別枠合計（表示のみ）
  const total = computeGrandTotalJpy(300, 100, 30000)
  assert(approx(total ?? -1, 60000), "⑦総合計=300×100+30,000=¥60,000")
  assert(computeGrandTotalJpy(null, 100, 0) === null, "⑦単価 null → 総合計 null")
  passed++
})()

// ⑧ 付属 usagePerUnit=1 行（案A）: 所要量=見積数量×(1+ロス)・perUnitJpy=単価×(1+ロス)
;(() => {
  // ロス 0: 所要量=見積数量（100）・単価100 → 行小計 10,000・perUnitJpy 100
  const flat = [
    line({ id: "acc", itemCategory: "MATERIAL", usagePerUnit: 1, lossRate: 0, unitPrice: 100 }),
  ]
  const r0 = computeProductionEstimate(flat, 100, null, null)
  assert(approx(r0.rows[0].subtotalJpy ?? -1, 10000), "⑧所要量=見積数量（100×¥100）")
  assert(approx(r0.rows[0].perUnitJpy ?? -1, 100), "⑧perUnitJpy=単価（ロス0）")
  assert(r0.rows[0].isRequirementRow, "⑧付属も所要量ベース")
  // ロス 10: perUnitJpy=単価×1.1
  const loss = [
    line({ id: "acc", itemCategory: "MATERIAL", usagePerUnit: 1, lossRate: 10, unitPrice: 100 }),
  ]
  const r1 = computeProductionEstimate(loss, 100, null, null)
  assert(approx(r1.rows[0].perUnitJpy ?? -1, 110), "⑧perUnitJpy=単価×(1+ロス)=110")
  passed++
})()

// ⑨ materialPerUnitJpy + laborPerUnitJpy = autoUnitCostJpy
;(() => {
  const lines = [
    line({ id: "fab", itemCategory: "MATERIAL", usagePerUnit: 1, lossRate: 0, procurementMode: "METER", unitPrice: 1500 }),
    line({ id: "sew", unitPrice: 500, quantity: 100 }),
  ]
  const r = computeProductionEstimate(lines, 100, null, null)
  assert(approx(r.materialPerUnitJpy ?? -1, 1500), "⑨材料費/枚=1500")
  assert(approx(r.laborPerUnitJpy ?? -1, 500), "⑨工賃/枚=500")
  assert(
    approx((r.materialPerUnitJpy ?? 0) + (r.laborPerUnitJpy ?? 0), r.autoUnitCostJpy ?? -1),
    "⑨材料/枚+工賃/枚=1枚原価",
  )
  assert(approx(r.autoUnitCostJpy ?? -1, 2000), "⑨1枚原価=2000")
  passed++
})()

// ⑩ procurementMode≠METER（付属/ROLL）の cutFee は計算に含めない
;(() => {
  // 付属（procurementMode=null）に cutFee を渡しても行小計は 単価×所要量 のみ（カット代 無視）
  const acc = [
    line({ id: "acc", itemCategory: "MATERIAL", usagePerUnit: 1, lossRate: 0, unitPrice: 100, cutFee: 9999 }),
  ]
  const r = computeProductionEstimate(acc, 100, null, null)
  assert(approx(r.rows[0].subtotalJpy ?? -1, 10000), "⑩付属の cutFee は無視（¥10,000）")
  // METER 行なら cutFee 加算される（対照）
  const meter = [
    line({ id: "m", itemCategory: "MATERIAL", usagePerUnit: 1, lossRate: 0, procurementMode: "METER", unitPrice: 100, cutFee: 5000 }),
  ]
  const rm = computeProductionEstimate(meter, 100, null, null)
  assert(approx(rm.rows[0].subtotalJpy ?? -1, 15000), "⑩METER は cutFee 加算（対照・¥15,000）")
  passed++
})()

console.log(`✓ production-estimate calc: ${passed}/10 ケース PASS`)
