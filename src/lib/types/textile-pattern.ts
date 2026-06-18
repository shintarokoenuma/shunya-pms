/**
 * B-066: 柄マスター（TextilePattern）の共有型（中立モジュール・"use server"/prisma 非依存）。
 * client component が "use server" の actions ファイルから型を import すると
 * ブラウザバンドルに @prisma/client が漏れるため、型はここに置いて decouple する（PR #85 の轍）。
 */

export const TEXTILE_PATTERN_STATUS_VALUES = ["ACTIVE", "ARCHIVED"] as const
export type TextilePatternStatusValue =
  (typeof TEXTILE_PATTERN_STATUS_VALUES)[number]

/** 一覧/詳細で使う柄1行（種別名は typeId 緩い参照をアプリ側結合して付与）。 */
export type TextilePatternRow = {
  id: string
  patternNumber: string
  patternName: string
  typeId: string | null
  typeCode: string | null // typeId → TextilePatternType.typeCode（結合・無ければ null）
  typeName: string | null // typeId → TextilePatternType.typeName（結合・無ければ null）
  sortOrder: number
  status: string
}

/** 種別ドロップダウン用（ACTIVE な TextilePatternType）。 */
export type PatternTypeOption = {
  id: string
  typeCode: string
  typeName: string
}

/** B-066-③: pattern-picker 用（ACTIVE な TextilePattern・種別名付き）。 */
export type TextilePatternOption = {
  id: string
  patternNumber: string
  patternName: string
  typeCode: string | null
  typeName: string | null
}
