/**
 * SKU 設計: SKU の共有型（中立モジュール・"use server"/prisma 非依存）。
 * client component が "use server" の actions ファイルから型を import すると
 * ブラウザバンドルに @prisma/client が漏れるため、型はここに置いて decouple する（PR #85 の轍）。
 */

/** 数量マトリクス等で使う SKU 1行（カラーウェイ × サイズ ＋ 数量群）。 */
export type SkuRow = {
  id: string
  colorwayId: string
  colorwayCode: string
  colorwayName: string
  colorCode: string // 後方互換・非正規化キャッシュ（旧設計の色文字列）
  colorName: string
  size: string
  sizeOrder: number
  orderedQuantity: number
  productionQuantity: number
  producedQuantity: number
  deliveredQuantity: number
  defectQuantity: number
  remainingStock: number
}
