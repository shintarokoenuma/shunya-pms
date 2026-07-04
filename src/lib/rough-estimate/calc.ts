import { RoughEstimateCategory, InitialCostBillingMode } from "@prisma/client"

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

// =============================================================================
// B-2/B-3: 提示価格の内訳分離 ＋ 初期費用の請求方式（SEPARATE / INCLUDED）
// =============================================================================

/** 量産提示分＝原価×(1+利益率)。1枚原価（初期費用抜き）に利益率を乗せた額。 */
export function computeProductionPriceTotalJpy(
  autoCostTotalJpy: number,
  marginRatePercent: number | null | undefined,
): number {
  return round2(autoCostTotalJpy * (1 + (marginRatePercent ?? 0) / 100))
}

/**
 * INCLUDED（1枚単価にインクルーズ）で割り返しが可能か。
 * presentedMoq が null / 0 以下なら不可（0除算防止・silent fallback 禁止）。SEPARATE は常に可。
 */
export function isMoqValidForBillingMode(
  billingMode: InitialCostBillingMode,
  presentedMoq: number | null | undefined,
): boolean {
  if (billingMode === InitialCostBillingMode.SEPARATE) return true
  return presentedMoq != null && presentedMoq > 0
}

export type RoughEstimatePriceBreakdown = {
  autoCostTotalJpy: number
  autoPriceTotalJpy: number
  /** 量産提示分＝原価×(1+利益率)。 */
  productionPriceTotalJpy: number
  /** 初期費用提示分（別途・価格化後）＝ autoPriceTotalJpy − 量産提示分（B-3 の導出式・新規列は増やさない）。 */
  initialCostPriceTotalJpy: number
  belowMarginWarning: boolean
  billingMode: InitialCostBillingMode
  /** INCLUDED のとき presentedMoq>0 か（SEPARATE は常に true）。false は保存不可（バリデーションエラー）。 */
  moqValid: boolean
  /** 1枚あたり内訳（presentedMoq>0 のときのみ算出・無ければ null）。 */
  perUnit:
    | null
    | {
        /** 参考：1枚あたり原価（初期費用抜き）。 */
        costPerUnitJpy: number
        /** 1枚あたり量産提示（原価×(1+利益率)/moq）。 */
        productionPricePerUnitJpy: number
        /** 1枚あたり初期費用上乗せ（初期費用提示分/moq）。INCLUDED の肝。 */
        initialCostAddonPerUnitJpy: number
        /** INCLUDED の1枚あたり提示価格＝ autoPriceTotalJpy / moq（＝量産1枚＋初期費用上乗せ）。 */
        includedPerUnitPriceJpy: number
      }
}

/**
 * 保存済み合計（autoCost/autoPrice）から提示価格の内訳・1枚あたりを導出（B-3）。
 * 一覧テーブル（明細を持たない）と編集ダイアログの両方で使う共通関数。新規列は増やさない。
 */
export function computePriceBreakdownFromTotals(
  autoCostTotalJpy: number,
  autoPriceTotalJpy: number,
  marginRatePercent: number | null | undefined,
  billingMode: InitialCostBillingMode,
  presentedMoq: number | null | undefined,
): RoughEstimatePriceBreakdown {
  const productionPriceTotalJpy = computeProductionPriceTotalJpy(
    autoCostTotalJpy,
    marginRatePercent,
  )
  const initialCostPriceTotalJpy = round2(
    autoPriceTotalJpy - productionPriceTotalJpy,
  )
  const moqValid = isMoqValidForBillingMode(billingMode, presentedMoq)

  const perUnit =
    presentedMoq != null && presentedMoq > 0
      ? {
          costPerUnitJpy: round2(autoCostTotalJpy / presentedMoq),
          productionPricePerUnitJpy: round2(
            productionPriceTotalJpy / presentedMoq,
          ),
          initialCostAddonPerUnitJpy: round2(
            initialCostPriceTotalJpy / presentedMoq,
          ),
          includedPerUnitPriceJpy: round2(autoPriceTotalJpy / presentedMoq),
        }
      : null

  return {
    autoCostTotalJpy,
    autoPriceTotalJpy,
    productionPriceTotalJpy,
    initialCostPriceTotalJpy,
    belowMarginWarning: isBelowMarginWarning(marginRatePercent),
    billingMode,
    moqValid,
    perUnit,
  }
}
