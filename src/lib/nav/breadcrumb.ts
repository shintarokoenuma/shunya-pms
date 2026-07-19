/**
 * B-078-1: パンくず（ツリー表示）のセグメント構築（純関数・中立モジュール）。
 *
 * 根は常に品番カルテ（product-sample §4-1 の背骨）。品番に紐づかない伝票（product=null）は
 * 「{一覧} › {番号}」に退化する。表示は clientProductCode || productCode 主（§4-1(c)・
 * primaryProductCode ヘルパー流用）。
 */
import { primaryProductCode } from "@/lib/utils/product-code"

export type Crumb = { label: string; href?: string }

export type BreadcrumbProductRef = {
  id: string
  productCode: string
  clientProductCode: string | null
}
export type BreadcrumbSampleRef = { id: string; sampleNumber: string }

/**
 * 伝票（WO/PO/見積等）用パンくず。
 * - product あり: 品番カルテ › {品番} › [サンプル {番号} ›] {現在}
 * - product なし: {一覧label} › {現在}（野良伝票の退化表示）
 */
export function buildDocBreadcrumb(opts: {
  product: BreadcrumbProductRef | null
  sample: BreadcrumbSampleRef | null
  currentLabel: string
  listLabel: string
  listHref: string
}): Crumb[] {
  const { product, sample, currentLabel, listLabel, listHref } = opts
  if (!product) {
    return [{ label: listLabel, href: listHref }, { label: currentLabel }]
  }
  const segs: Crumb[] = [
    { label: "品番カルテ", href: "/products" },
    { label: primaryProductCode(product), href: `/products/${product.id}` },
  ]
  if (sample) {
    segs.push({
      label: `サンプル ${sample.sampleNumber}`,
      href: `/samples/${sample.id}`,
    })
  }
  segs.push({ label: currentLabel })
  return segs
}
