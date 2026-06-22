import { SeasonType } from "@prisma/client"

/**
 * シーズン区分（SeasonType）共通モジュール（実装②・§6 案1）
 *
 * - year（年度）と seasonType（区分）から season 文字列を合成する（例 2026 + SS → "26SS"）。
 * - 採番・検索・一覧/詳細表示・PDF はすべて合成済み season 文字列を使う（無改修）。seasonType は
 *   入力の正規化＋将来の集計用の正規列。
 * - work-order-types.ts と同じ中立構成：enum は @prisma/client から import するが、このファイル自体は
 *   "use server" 非依存でクライアントから安全に import できる（index-browser 罠の回避）。
 *
 * Record は全 7 値を網羅（漏れると型エラーでコンパイルが落ちる）。
 */

export const SEASON_TYPE_LABELS: Record<SeasonType, string> = {
  SS: "春夏",
  AW: "秋冬",
  SP: "春",
  SU: "夏",
  FA: "秋",
  WI: "冬",
  SPOT: "スポット",
}

export const SEASON_TYPE_OPTIONS: Array<{
  value: SeasonType
  label: string
}> = (Object.keys(SEASON_TYPE_LABELS) as SeasonType[]).map((value) => ({
  value,
  label: SEASON_TYPE_LABELS[value],
}))

/**
 * year（4桁）と seasonType から season 文字列を合成する。
 * year 下2桁 + 区分。例: composeSeason(2026, "SS") → "26SS" / composeSeason(2026, "SPOT") → "26SPOT"。
 * year は 2000–2099 想定（フォームのプルダウンが現在年±で担保）。
 */
export function composeSeason(year: number, seasonType: SeasonType): string {
  return `${String(year).slice(-2)}${seasonType}`
}

/**
 * 既存 season 文字列（合成キャッシュ）から seasonType を逆引きする（編集初期値・移行で使用）。
 * 末尾の区分文字列が enum 値に一致すれば返す。一致しなければ null。
 */
export function parseSeasonType(season: string | null | undefined): SeasonType | null {
  if (!season) return null
  const upper = season.toUpperCase()
  for (const { value } of SEASON_TYPE_OPTIONS) {
    if (upper.endsWith(value)) return value
  }
  return null
}
