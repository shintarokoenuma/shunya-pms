import { TaxRoundingMode } from "@prisma/client"

/**
 * 円未満の端数処理（B-109 D-22・D-23・D-31）。
 * ★必ず絶対値に適用して符号を戻す。JS の Math.round は負数で 0 方向に丸まらない
 *   （Math.round(-1.5) === -1）ため、赤伝（マイナス請求）で丸めの向きが反転する。
 * 呼び出し側は PR-2c（合計請求書）で入る。2a では定義だけを置く。
 */
export function applyTaxRounding(amount: number, mode: TaxRoundingMode): number {
  const sign = amount < 0 ? -1 : 1
  const abs = Math.abs(amount)
  switch (mode) {
    case "TRUNCATE":
      return sign * Math.floor(abs)
    case "ROUND_HALF_UP":
      return sign * Math.round(abs)
    case "CEILING":
      return sign * Math.ceil(abs)
  }
}
