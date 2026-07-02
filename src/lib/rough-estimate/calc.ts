import { RoughEstimateCategory } from "@prisma/client"

/**
 * QE-1R（概算量産見積）集計の純関数群。
 *
 * 設計方針（実装ブリーフ §2）:
 * - 追加クエリなし・クライアント計算。呼び出し側は明細の subtotalJpy（JPY 換算済み）を渡す。
 * - "use server" 非依存の中立モジュール（season-types / work-order-types と同じく client からも安全に import 可）。
 *   @prisma/client からは enum のみ import（値はビルド時にインライン化・engine を引かない）。
 * - 金額は number（JPY・小数2桁想定）。DB 保存時に action 側で Prisma.Decimal(15,2) へ変換する。
 *
 * ★絶対防衛線（v0.1 §6）: 原価分子は MATERIAL / LABOR のみ。INITIAL_COST は 1 枚原価に混ぜない。
 *   ここが検算の要（computeAutoCostTotalJpy 参照）。
 */

/** 集計に必要な明細の最小形（費目区分と JPY 換算小計のみ）。 */
export type RoughEstimateLineForCalc = {
  itemCategory: RoughEstimateCategory
  /** JPY 換算済みの行小計。未定（単価未入力等）のときは null。 */
  subtotalJpy: number | null
}

/** 浮動小数の誤差を抑えて小数2桁へ丸める（JPY・Decimal(15,2) 保存前提）。 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function sumSubtotalJpy(lines: RoughEstimateLineForCalc[]): number {
  return lines.reduce((acc, l) => acc + (l.subtotalJpy ?? 0), 0)
}

/**
 * 原価集計（autoCostTotalJpy）＝ itemCategory ∈ {MATERIAL, LABOR} の subtotalJpy 合算。
 * ★INITIAL_COST は分子に入れない（v0.1 §6 絶対防衛線）。
 */
export function computeAutoCostTotalJpy(lines: RoughEstimateLineForCalc[]): number {
  const costLines = lines.filter(
    (l) =>
      l.itemCategory === RoughEstimateCategory.MATERIAL ||
      l.itemCategory === RoughEstimateCategory.LABOR,
  )
  return round2(sumSubtotalJpy(costLines))
}

/**
 * 初期費用の別枠合計（autoCostTotalJpy とは別に保持する内訳・分子外）。
 * 提示価格には乗るが 1 枚原価には混ぜないことを可視化するための内訳値。
 */
export function computeInitialCostTotalJpy(
  lines: RoughEstimateLineForCalc[],
): number {
  const initialLines = lines.filter(
    (l) => l.itemCategory === RoughEstimateCategory.INITIAL_COST,
  )
  return round2(sumSubtotalJpy(initialLines))
}

/**
 * 提示価格（自動・autoPriceTotalJpy）＝ 全費目（MATERIAL/LABOR/INITIAL_COST すべて）の
 * subtotalJpy に marginRate を適用 = Σ subtotalJpy ×(1 + marginRate/100)。
 * ※初期費用も価格化するが（v0.1 §5-1）、原価分子（computeAutoCostTotalJpy）には混ぜない。
 */
export function computeAutoPriceTotalJpy(
  lines: RoughEstimateLineForCalc[],
  marginRatePercent: number,
): number {
  const base = sumSubtotalJpy(lines)
  return round2(base * (1 + marginRatePercent / 100))
}

/**
 * 赤字警告条件（確定・v0.1 §5 後者採用）: 適用 marginRate が 0（未設定由来・明示入力を問わず一律）。
 * 理由の区別ロジックは持たない（null も 0 も同一に警告）。
 */
export function isBelowMarginWarning(
  marginRatePercent: number | null | undefined,
): boolean {
  return (marginRatePercent ?? 0) === 0
}

/** UI 表示・保存前計算のワンショット集計。 */
export type RoughEstimateSummary = {
  autoCostTotalJpy: number
  initialCostTotalJpy: number
  autoPriceTotalJpy: number
  /** 手打ち最終値（finalPriceManualJpy）の入力初期値＝自動提示価格。 */
  finalPriceManualJpyDefault: number
  belowMarginWarning: boolean
}

export function summarizeRoughEstimate(
  lines: RoughEstimateLineForCalc[],
  marginRatePercent: number | null | undefined,
): RoughEstimateSummary {
  const rate = marginRatePercent ?? 0
  const autoCostTotalJpy = computeAutoCostTotalJpy(lines)
  const initialCostTotalJpy = computeInitialCostTotalJpy(lines)
  const autoPriceTotalJpy = computeAutoPriceTotalJpy(lines, rate)
  return {
    autoCostTotalJpy,
    initialCostTotalJpy,
    autoPriceTotalJpy,
    finalPriceManualJpyDefault: autoPriceTotalJpy,
    belowMarginWarning: isBelowMarginWarning(marginRatePercent),
  }
}
