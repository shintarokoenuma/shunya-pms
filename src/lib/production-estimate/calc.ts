/**
 * (A) 量産見積 seed① の計算コア（純TS・中立モジュール）。
 *
 * - "use client"/"use server" を付けない純関数。@prisma/client 非依存（型のみ／値 import なし）。
 * - 設計ソース:
 *   docs/specs/production-axis-spec-confirmation-v1_0-2026-07-16.md（§1-4 単価/量の source 分離・
 *     §1-5 絶対防衛線・§1-8 見積数量＝分母）
 *   docs/specs/qe-1-spec-confirmation-v1_0-2026-06-30.md §4-§5（取り切り ROLL / METER・通貨換算）
 *   docs/specs/qe-1-spec-addendum-v0_1-2026-07-12.md §2（カット代＝METER・行通貨）
 *   docs/specs/quotation-rough-estimate-spec-addendum-v0_2-2026-07-06.md（手打ち＝1枚単価粒度）
 *
 * 方針: 行の金額計算（ROLL 反数 ceil / METER＋カット代 / JPY・USD 換算）は
 *   src/lib/calc/production-cost.ts の computeProductionCost を「行単価エンジン」として流用する。
 *   PE 側では (a) 分母を見積数量 estimateQuantity（合成 SKU 1 行）に差し替え、
 *   (b) 分子を isSeparateBilling=false 行に限定（絶対防衛線）、
 *   (c) 別枠は presentedPriceManualJpy で独立集計する。
 *
 * ★絶対防衛線（§1-5）: isSeparateBilling=true 行は autoUnitCost の分子に入れない。
 *   別枠「別途請求項目（1枚原価外）」として presentedPriceManualJpy が入った行のみ別枠合計へ。
 */

import type { SkuRow } from "@/lib/types/sku"
import {
  computeProductionCost,
  type LaborCostInput,
  type MaterialCostInput,
  type ProductionCostCurrency,
  type ProductionCostExcludeReason,
  type ProductionCostRow,
} from "@/lib/calc/production-cost"

/** 見積明細 1 行の計算入力（Decimal は number 正規化済みで受ける）。 */
export type ProductionEstimateLineForCalc = {
  /** 行の識別子（ProductionEstimateItem.id・結果マッピング用）。 */
  id: string
  itemCategory: "MATERIAL" | "LABOR"
  /** 別枠計上（初期費用）。true は1枚原価の分子から外し別枠へ（絶対防衛線）。 */
  isSeparateBilling: boolean
  // ---- 量計算材料（生地行・usagePerUnit があれば「所要量ベース」行として扱う）----
  usagePerUnit: number | null
  lossRate: number
  procurementMode: "ROLL" | "METER" | null
  rollLength: number | null
  rollPrice: number | null
  rollCurrency: ProductionCostCurrency | null
  cutFee: number | null
  // ---- 単価・数量（付属・工賃行は unitPrice × quantity）----
  unitPrice: number | null
  currency: ProductionCostCurrency
  quantity: number | null
  unit: string | null
  /** 別枠行の手打ち提示額（別枠合計に計上されるのはこの値が入った行のみ）。 */
  presentedPriceManualJpy: number | null
}

/** 行ごとの計算結果（DB の subtotal/subtotalJpy 焼き込み・UI 表示の両用）。 */
export type ProductionEstimateRowResult = {
  itemId: string
  /** 原通貨での行小計（subtotal 列へ焼き込み）。 */
  subtotal: number | null
  /** JPY 換算後の行小計（subtotalJpy 列へ焼き込み）。 */
  subtotalJpy: number | null
  currency: ProductionCostCurrency
  excluded: boolean
  excludeReason: ProductionCostExcludeReason | null
  /** 1枚原価の分子に計上されたか（isSeparateBilling=false かつ換算成立）。 */
  counted: boolean
  /** 1枚あたり JPY = counted 行の subtotalJpy ÷ estimateQuantity（0 なら null・非 counted も null）。 */
  perUnitJpy: number | null
  isSeparateBilling: boolean
  /** 所要量ベース（生地行）か。false は unitPrice × quantity 行。 */
  isRequirementRow: boolean
}

export type ProductionEstimateCalcResult = {
  rows: ProductionEstimateRowResult[]
  estimateQuantity: number
  /** 計上された材料費（生地行）Σ JPY。 */
  materialNumeratorJpy: number
  /** 計上された工賃・付属Σ JPY。 */
  laborNumeratorJpy: number
  /** 分子 = 材料費Σ + 工賃・付属Σ（isSeparateBilling=false・換算成立行のみ）。 */
  numeratorJpy: number
  /** 材料費の1枚あたり = materialNumeratorJpy ÷ estimateQuantity（0 なら null）。 */
  materialPerUnitJpy: number | null
  /** 工賃・付属の1枚あたり = laborNumeratorJpy ÷ estimateQuantity（0 なら null）。 */
  laborPerUnitJpy: number | null
  /** 自動 1枚原価 = 分子 ÷ estimateQuantity（0 なら null・= materialPerUnitJpy + laborPerUnitJpy）。 */
  autoUnitCostJpy: number | null
  /** 自動 1枚単価 = autoUnitCostJpy ×(1 + marginRate/100)（どちらか null なら null）。 */
  autoUnitPriceJpy: number | null
  /** 別枠合計 = 別枠行の presentedPriceManualJpy Σ（値が入った行のみ・1枚原価外）。 */
  separateTotalJpy: number
}

/** 浮動小数の誤差を抑えて小数2桁へ丸める（JPY・Decimal(15,2) 保存前提）。 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** 所要量ベース（生地行）判定。usagePerUnit があれば用尺×量産数×(1+ロス) で量を導く。 */
function isRequirementRow(line: ProductionEstimateLineForCalc): boolean {
  return line.itemCategory === "MATERIAL" && line.usagePerUnit !== null
}

/** 分母のための合成 SKU（productionQuantity = estimateQuantity の 1 行）。 */
function syntheticSku(estimateQuantity: number): SkuRow {
  return {
    id: "__pe_synthetic__",
    colorwayId: "",
    colorwayCode: "",
    colorwayName: "",
    colorCode: "",
    colorName: "",
    size: "",
    sizeOrder: 0,
    orderedQuantity: 0,
    productionQuantity: estimateQuantity,
    producedQuantity: 0,
    deliveredQuantity: 0,
    defectQuantity: 0,
    remainingStock: 0,
  }
}

/**
 * 量産見積の自動値を計算する。
 * - 行金額は computeProductionCost に委譲（ROLL 反数 ceil・METER＋カット代・JPY/USD 換算）。
 * - 分子は isSeparateBilling=false・換算成立行の JPY 合算のみ（絶対防衛線）。
 * - autoUnitCostJpy = 分子 ÷ estimateQuantity（0 除算ガード）。
 * - autoUnitPriceJpy = autoUnitCostJpy ×(1 + marginRate/100)。marginRate null なら null。
 */
export function computeProductionEstimate(
  lines: ProductionEstimateLineForCalc[],
  estimateQuantity: number,
  marginRatePercent: number | null,
  exchangeRateUsdJpy: number | null,
): ProductionEstimateCalcResult {
  // 全行を computeProductionCost の行入力へ振り分け（付属/工賃は unitPrice × quantity ＝ labor 形）。
  const materials: MaterialCostInput[] = []
  const labor: LaborCostInput[] = []
  for (const line of lines) {
    if (isRequirementRow(line)) {
      materials.push({
        bomItemId: line.id,
        itemLabel: "",
        itemCategory: "MATERIAL",
        usagePerUnit: line.usagePerUnit,
        lossRate: line.lossRate,
        unit: line.unit ?? "",
        procurementMode: line.procurementMode,
        unitPrice: line.unitPrice,
        currency: line.currency,
        rollLength: line.rollLength,
        rollPrice: line.rollPrice,
        rollCurrency: line.rollCurrency,
        // カット代は METER 行のみ有効（ROLL/付属では計算に含めない・二重ガードの1段目）。
        cutFee: line.procurementMode === "METER" ? line.cutFee : null,
      })
    } else {
      labor.push({
        woItemId: line.id,
        woId: "",
        woNumber: "",
        workDescription: "",
        quantity: line.quantity ?? 0,
        unitPrice: line.unitPrice,
        currency: line.currency,
        externalCategory: null,
        // 別枠判定は PE 側の isSeparateBilling で行うため billingClassification は使わない。
        billingClassification: null,
      })
    }
  }

  // 行単価エンジンに委譲（分母は合成 SKU＝estimateQuantity）。行金額のみ使い、集計は PE 側で行う。
  const core = computeProductionCost(
    [syntheticSku(estimateQuantity)],
    materials,
    labor,
    exchangeRateUsdJpy,
  )
  const byId = new Map<string, ProductionCostRow>()
  for (const section of core.sections) {
    for (const row of section.rows) byId.set(row.key, row)
  }

  const rows: ProductionEstimateRowResult[] = []
  let materialNumeratorJpy = 0
  let laborNumeratorJpy = 0
  let separateTotalJpy = 0

  for (const line of lines) {
    const row = byId.get(line.id)
    const requirement = isRequirementRow(line)
    const subtotal = row?.amountOriginal ?? null
    const subtotalJpy = row?.amountJpy ?? null
    const excluded = row?.excluded ?? true
    const excludeReason = row?.excludeReason ?? "AMOUNT_UNDECIDED"
    const counted = !line.isSeparateBilling && !excluded && subtotalJpy !== null

    if (counted) {
      if (requirement) materialNumeratorJpy += subtotalJpy as number
      else laborNumeratorJpy += subtotalJpy as number
    }
    if (line.isSeparateBilling && line.presentedPriceManualJpy !== null) {
      separateTotalJpy += line.presentedPriceManualJpy
    }

    const perUnitJpy =
      counted && estimateQuantity > 0 && subtotalJpy !== null
        ? round2(subtotalJpy / estimateQuantity)
        : null

    rows.push({
      itemId: line.id,
      subtotal,
      subtotalJpy,
      currency: row?.currency ?? line.currency,
      excluded,
      excludeReason,
      counted,
      perUnitJpy,
      isSeparateBilling: line.isSeparateBilling,
      isRequirementRow: requirement,
    })
  }

  materialNumeratorJpy = round2(materialNumeratorJpy)
  laborNumeratorJpy = round2(laborNumeratorJpy)
  const numeratorJpy = round2(materialNumeratorJpy + laborNumeratorJpy)
  const materialPerUnitJpy =
    estimateQuantity > 0 ? round2(materialNumeratorJpy / estimateQuantity) : null
  const laborPerUnitJpy =
    estimateQuantity > 0 ? round2(laborNumeratorJpy / estimateQuantity) : null
  const autoUnitCostJpy =
    estimateQuantity > 0 ? round2(numeratorJpy / estimateQuantity) : null
  const autoUnitPriceJpy =
    autoUnitCostJpy !== null && marginRatePercent !== null
      ? round2(autoUnitCostJpy * (1 + marginRatePercent / 100))
      : null

  return {
    rows,
    estimateQuantity,
    materialNumeratorJpy,
    laborNumeratorJpy,
    numeratorJpy,
    materialPerUnitJpy,
    laborPerUnitJpy,
    autoUnitCostJpy,
    autoUnitPriceJpy,
    separateTotalJpy: round2(separateTotalJpy),
  }
}

/** 最終 1枚単価の解決（手打ち優先）。手打ち非 null なら手打ち・null なら自動。 */
export function resolveFinalUnitPriceJpy(
  autoUnitPriceJpy: number | null,
  finalUnitPriceManualJpy: number | null,
): { valueJpy: number | null; isManual: boolean } {
  if (finalUnitPriceManualJpy !== null) {
    return { valueJpy: finalUnitPriceManualJpy, isManual: true }
  }
  return { valueJpy: autoUnitPriceJpy, isManual: false }
}

/**
 * 総合計（表示のみ・列に保存しない）＝ 最終1枚単価 × 見積数量 ＋ 別枠合計。
 * 単価が未確定（null）なら null。
 */
export function computeGrandTotalJpy(
  finalUnitPriceJpy: number | null,
  estimateQuantity: number,
  separateTotalJpy: number,
): number | null {
  if (finalUnitPriceJpy === null) return null
  return round2(finalUnitPriceJpy * estimateQuantity + separateTotalJpy)
}
