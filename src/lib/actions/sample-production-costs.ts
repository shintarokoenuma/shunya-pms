"use server"

import {
  Prisma,
  Currency,
  WorkOrderCategory,
  type PurchaseOrderStatus,
  type WorkOrderStatus,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

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

// =============================================================================
// S-4c-1.5: コスト集計の明細内訳（read 系・表示用）
// =============================================================================
export type CostBreakdownExcludeReason =
  | "AMOUNT_UNDECIDED"
  | "NON_JPY"
  | "CATEGORY"

export type CostBreakdownRow = {
  docType: "PO" | "WO"
  docId: string
  docNumber: string
  docStatus: PurchaseOrderStatus | WorkOrderStatus
  itemName: string
  quantity: number
  unit: string
  unitPrice: number | null
  subtotal: number | null
  currency: Currency
  excluded: boolean
  excludeReason: CostBreakdownExcludeReason | null
}

export type CostBreakdownSection = {
  key: "material" | "pattern" | "sewing" | "revision" | "other"
  label: string
  rows: CostBreakdownRow[]
  /** 集計対象（excluded=false）行の小計合計 */
  subtotal: number
}

function dec(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const n =
    typeof value === "number"
      ? value
      : "toNumber" in value
        ? value.toNumber()
        : Number(value)
  return Number.isFinite(n) ? n : null
}

/** WO の workCategory → 内訳セクション key（PRODUCTION/ADDITIONAL は other=集計対象外）。 */
function woSectionKey(
  category: WorkOrderCategory,
): CostBreakdownSection["key"] {
  switch (category) {
    case WorkOrderCategory.PATTERN:
    case WorkOrderCategory.GRADING:
      return "pattern"
    case WorkOrderCategory.SAMPLE:
      return "sewing"
    case WorkOrderCategory.REWORK:
      return "revision"
    default:
      return "other" // PRODUCTION / ADDITIONAL
  }
}

export async function getSampleProductionCostBreakdown(
  sampleProductionId: string,
): Promise<ActionResult<{ sections: CostBreakdownSection[] }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証されていません" }
    const companyId = session.user.companyId

    const sp = await prisma.sampleProduction.findFirst({
      where: { id: sampleProductionId, companyId },
      select: { id: true },
    })
    if (!sp) return { ok: false, error: "サンプル製作セットが見つかりません" }

    const sections: Record<
      CostBreakdownSection["key"],
      CostBreakdownSection
    > = {
      material: { key: "material", label: "資材費（PO）", rows: [], subtotal: 0 },
      pattern: {
        key: "pattern",
        label: "パターン・グレーディング代（WO）",
        rows: [],
        subtotal: 0,
      },
      sewing: { key: "sewing", label: "縫製・加工費（WO）", rows: [], subtotal: 0 },
      revision: {
        key: "revision",
        label: "やり直し費（WO）",
        rows: [],
        subtotal: 0,
      },
      other: {
        key: "other",
        label: "その他の作業発注（集計対象外）",
        rows: [],
        subtotal: 0,
      },
    }

    const pushRow = (
      key: CostBreakdownSection["key"],
      row: CostBreakdownRow,
    ) => {
      sections[key].rows.push(row)
      if (!row.excluded && row.subtotal !== null) {
        sections[key].subtotal += row.subtotal
      }
    }

    // --- PO（資材費）---
    const pos = await prisma.purchaseOrder.findMany({
      where: { companyId, sampleProductionId, deletedAt: null },
      select: { id: true, poNumber: true, status: true, currency: true },
      orderBy: { poNumber: "asc" },
    })
    if (pos.length > 0) {
      const poItems = await prisma.poItem.findMany({
        where: { poId: { in: pos.map((p) => p.id) } },
        orderBy: [{ poId: "asc" }, { itemOrder: "asc" }],
      })
      // materialId → 素材名 一括解決
      const materialIds = [
        ...new Set(
          poItems
            .map((i) => i.materialId)
            .filter((v): v is string => !!v),
        ),
      ]
      const materialMap = new Map<string, string>()
      if (materialIds.length > 0) {
        const mats = await prisma.material.findMany({
          where: { id: { in: materialIds }, companyId },
          select: { id: true, materialName: true },
        })
        for (const m of mats) materialMap.set(m.id, m.materialName)
      }
      const poById = new Map(pos.map((p) => [p.id, p]))
      for (const it of poItems) {
        const po = poById.get(it.poId)!
        const sub = dec(it.subtotal)
        const nonJpy = po.currency !== Currency.JPY
        const undecided = sub === null
        const excluded = nonJpy || undecided
        pushRow("material", {
          docType: "PO",
          docId: po.id,
          docNumber: po.poNumber,
          docStatus: po.status,
          itemName:
            it.customItemName ??
            (it.materialId ? materialMap.get(it.materialId) ?? "（素材）" : "（品目未設定）"),
          quantity: dec(it.quantity) ?? 0,
          unit: it.unit,
          unitPrice: dec(it.unitPrice),
          subtotal: sub,
          currency: po.currency,
          excluded,
          excludeReason: nonJpy ? "NON_JPY" : undecided ? "AMOUNT_UNDECIDED" : null,
        })
      }
    }

    // --- WO（作業費）---
    const wos = await prisma.workOrder.findMany({
      where: { companyId, samplProductionId: sampleProductionId, deletedAt: null },
      select: {
        id: true,
        woNumber: true,
        status: true,
        currency: true,
        workCategory: true,
      },
      orderBy: { woNumber: "asc" },
    })
    if (wos.length > 0) {
      const woItems = await prisma.woItem.findMany({
        where: { woId: { in: wos.map((w) => w.id) } },
        orderBy: [{ woId: "asc" }, { itemOrder: "asc" }],
      })
      const woById = new Map(wos.map((w) => [w.id, w]))
      for (const it of woItems) {
        const wo = woById.get(it.woId)!
        const key = woSectionKey(wo.workCategory)
        const sub = dec(it.subtotal)
        const nonJpy = wo.currency !== Currency.JPY
        const undecided = sub === null
        const isOther = key === "other"
        const excluded = isOther || nonJpy || undecided
        pushRow(key, {
          docType: "WO",
          docId: wo.id,
          docNumber: wo.woNumber,
          docStatus: wo.status,
          itemName: it.workDescription,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: dec(it.unitPrice),
          subtotal: sub,
          currency: wo.currency,
          excluded,
          excludeReason: isOther
            ? "CATEGORY"
            : nonJpy
              ? "NON_JPY"
              : undecided
                ? "AMOUNT_UNDECIDED"
                : null,
        })
      }
    }

    // 明細のあるセクションのみ返す（順序固定）
    const order: CostBreakdownSection["key"][] = [
      "material",
      "pattern",
      "sewing",
      "revision",
      "other",
    ]
    return {
      ok: true,
      data: {
        sections: order
          .map((k) => sections[k])
          .filter((s) => s.rows.length > 0),
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "内訳取得に失敗しました",
    }
  }
}
