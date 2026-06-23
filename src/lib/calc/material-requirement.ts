/**
 * B-067 D4(ア): 資材所要量の集計（純TS・中立モジュール）。
 *
 * - "use client"/"use server" を付けない純関数。@prisma/client 非依存（SkuRow は中立型）。
 * - 数量マトリクス（SKU別 productionQuantity）× BOM 用尺（usagePerUnit・lossRate）から
 *   資材ごとの所要量を計算する。書き込みは行わない（read-only 計算ビュー専用）。
 * - 仕様: docs/specs/b-067-quantity-usage-po-spec-confirmation-v1_0-2026-06-23.md（D1〜D6）
 *   D1 集計軸=カラーウェイ別 / D2 ロス込み用尺は都度計算 / D3 連続量まで（丸めなし）
 *   D5 DIRECT のみ / D6 用尺未入力は除外・productionQuantity=0 は 0。
 */

import type { SkuRow } from "@/lib/types/sku"

/** BomItem から計算に必要な分だけを構造的に受ける薄い入力型（BomItemView 全体には依存しない）。 */
export type MaterialReqColorway = {
  productColorwayId: string
  colorwayCode?: string | null
  supplierColorCode: string
}

export type MaterialReqBomItem = {
  id: string
  itemLabel: string
  itemCategory: string
  usagePerUnit: number | null
  lossRate: number
  unit: string
  colorways: MaterialReqColorway[]
}

export type MaterialRequirementBreakdown = {
  colorwayId: string | null
  colorwayLabel: string | null
  supplierColorCode: string | null
  quantity: number
  totalUsage: number | null
  requirement: number | null
}

export type MaterialRequirementRow = {
  bomItemId: string
  itemLabel: string
  itemCategory: string
  unit: string
  breakdown: MaterialRequirementBreakdown[]
  status: "OK" | "USAGE_MISSING"
}

/** ロス込み用尺 = usagePerUnit × (1 + lossRate/100)。usagePerUnit=null は null（D2）。 */
function computeTotalUsage(
  usagePerUnit: number | null,
  lossRate: number,
): number | null {
  if (usagePerUnit === null) return null
  return usagePerUnit * (1 + lossRate / 100)
}

/**
 * 資材ごとの所要量を計算する。
 * - colorways あり: ProductColorway ごとに Σ(該当カラーウェイの SKU productionQuantity) × totalUsage。
 * - colorways なし: 全 SKU 合計 × totalUsage（colorwayId/Label=null）。
 * - usagePerUnit=null: status=USAGE_MISSING、requirement/totalUsage=null（数量だけは出す）。
 */
export function computeMaterialRequirements(
  skus: SkuRow[],
  items: MaterialReqBomItem[],
): MaterialRequirementRow[] {
  return items.map((item) => {
    const totalUsage = computeTotalUsage(item.usagePerUnit, item.lossRate)
    const status: MaterialRequirementRow["status"] =
      item.usagePerUnit === null ? "USAGE_MISSING" : "OK"

    let breakdown: MaterialRequirementBreakdown[]

    if (item.colorways.length > 0) {
      breakdown = item.colorways.map((cw) => {
        const quantity = skus
          .filter((s) => s.colorwayId === cw.productColorwayId)
          .reduce((sum, s) => sum + s.productionQuantity, 0)
        return {
          colorwayId: cw.productColorwayId,
          colorwayLabel: cw.colorwayCode ?? null,
          supplierColorCode: cw.supplierColorCode,
          quantity,
          totalUsage,
          requirement: totalUsage === null ? null : quantity * totalUsage,
        }
      })
    } else {
      const quantity = skus.reduce((sum, s) => sum + s.productionQuantity, 0)
      breakdown = [
        {
          colorwayId: null,
          colorwayLabel: null,
          supplierColorCode: null,
          quantity,
          totalUsage,
          requirement: totalUsage === null ? null : quantity * totalUsage,
        },
      ]
    }

    return {
      bomItemId: item.id,
      itemLabel: item.itemLabel,
      itemCategory: item.itemCategory,
      unit: item.unit,
      breakdown,
      status,
    }
  })
}
