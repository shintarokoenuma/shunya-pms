"use server"

import {
  Prisma,
  Currency,
  WorkOrderCategory,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * S-4c-1(G3/G4): SampleProduction のコスト集計（denormalized）。
 *
 * マッピング:
 * - totalMaterialCost = SP に紐づく live PO 明細 subtotal 合計（生地・付属・ボディ・版すべて）
 * - totalPatternCost  = live WO(workCategory=PATTERN|GRADING) 明細合計
 * - totalSewingCost   = live WO(workCategory=SAMPLE) 明細合計（縫製＋加工）
 * - totalRevisionCost = live WO(workCategory=REWORK) 明細合計
 * - totalCost         = 上記4列の総和
 *
 * 規則:
 * - subtotal=null（金額未定）は 0 扱い（除外）。
 * - currency != JPY の伝票は当面集計対象外（B-051）。
 * - workCategory=PRODUCTION/ADDITIONAL はどの列にも入れず totalCost にも含めない（サンプル原価でないため）。
 * - 親アクションの成功後に呼ぶ補助。失敗しても親を巻き込まない。
 */
export async function recomputeSampleProductionCosts(
  sampleProductionId: string,
): Promise<void> {
  try {
    const sp = await prisma.sampleProduction.findFirst({
      where: { id: sampleProductionId, deletedAt: null },
      select: { id: true, companyId: true },
    })
    if (!sp) return
    const companyId = sp.companyId

    // --- PO（資材費）: live PO の JPY 明細 subtotal 合計 ---
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        companyId,
        sampleProductionId,
        deletedAt: null,
        currency: Currency.JPY,
      },
      select: { id: true },
    })
    let totalMaterial = new Prisma.Decimal(0)
    if (pos.length > 0) {
      const poItems = await prisma.poItem.findMany({
        where: { poId: { in: pos.map((p) => p.id) }, subtotal: { not: null } },
        select: { subtotal: true },
      })
      for (const it of poItems) {
        if (it.subtotal) totalMaterial = totalMaterial.add(it.subtotal)
      }
    }

    // --- WO（作業費）: live WO を workCategory 別に集計 ---
    const wos = await prisma.workOrder.findMany({
      where: {
        companyId,
        samplProductionId: sampleProductionId, // 綴りミス温存(B-035)
        deletedAt: null,
        currency: Currency.JPY,
      },
      select: { id: true, workCategory: true },
    })

    let totalPattern = new Prisma.Decimal(0)
    let totalSewing = new Prisma.Decimal(0)
    let totalRevision = new Prisma.Decimal(0)

    if (wos.length > 0) {
      const woItems = await prisma.woItem.findMany({
        where: { woId: { in: wos.map((w) => w.id) }, subtotal: { not: null } },
        select: { woId: true, subtotal: true },
      })
      const catById = new Map(wos.map((w) => [w.id, w.workCategory]))
      for (const it of woItems) {
        if (!it.subtotal) continue
        const cat = catById.get(it.woId)
        if (
          cat === WorkOrderCategory.PATTERN ||
          cat === WorkOrderCategory.GRADING
        ) {
          totalPattern = totalPattern.add(it.subtotal)
        } else if (cat === WorkOrderCategory.SAMPLE) {
          totalSewing = totalSewing.add(it.subtotal)
        } else if (cat === WorkOrderCategory.REWORK) {
          totalRevision = totalRevision.add(it.subtotal)
        }
        // PRODUCTION / ADDITIONAL はサンプル原価でないため集計しない
      }
    }

    const totalCost = totalMaterial
      .add(totalPattern)
      .add(totalSewing)
      .add(totalRevision)

    await prisma.sampleProduction.update({
      where: { id: sampleProductionId },
      data: {
        totalMaterialCost: totalMaterial,
        totalPatternCost: totalPattern,
        totalSewingCost: totalSewing,
        totalRevisionCost: totalRevision,
        totalCost,
      },
    })
  } catch {
    // 集計の失敗は親アクションを巻き込まない
    return
  }
}
