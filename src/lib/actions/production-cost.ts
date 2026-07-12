"use server"

import { WorkOrderCategory } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type {
  MaterialCostInput,
  LaborCostInput,
} from "@/lib/calc/production-cost"

/**
 * QE-1: 量産原価ビューの入力データ供給（読み取り専用）。
 *
 * - #93 資材所要量は既に page がロード済みだが、ROLL 取り切りに要る Material.rollLength/rollPrice/currency と
 *   PRODUCTION WorkOrder の WoItem 群は既存クエリで供給されないため、本 action で集約する。
 * - 計算・按分・除外判定は純関数 computeProductionCost 側（本 action は素材データの正規化のみ）。
 * - カット代（cutFee）と USD/JPY レートは画面の手入力（保存しない）ため本 action は返さない。
 * 仕様: docs/specs/qe-1-implementation-brief-2026-07-12.md §1(4)・§2
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type ProductionCostInputs = {
  materials: MaterialCostInput[]
  labor: LaborCostInput[]
}

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
  }
}

const toNum = (v: { toNumber: () => number } | null): number | null =>
  v == null ? null : v.toNumber()

export async function getProductionCostInputs(
  productId: string,
): Promise<ActionResult<ProductionCostInputs>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // ---- 材料費入力（BOM 行 ＋ ROLL 時の Material 反情報）----
    const bom = await prisma.bom.findFirst({
      where: { companyId: sess.companyId, productId, deletedAt: null },
      select: { id: true },
    })

    let materials: MaterialCostInput[] = []
    if (bom) {
      const items = await prisma.bomItem.findMany({
        where: { bomId: bom.id },
        orderBy: { itemOrder: "asc" },
      })
      const materialIds = [
        ...new Set(
          items
            .map((i) => i.materialId)
            .filter((v): v is string => !!v),
        ),
      ]
      const mats = materialIds.length
        ? await prisma.material.findMany({
            where: { id: { in: materialIds }, companyId: sess.companyId },
            select: {
              id: true,
              materialCode: true,
              materialName: true,
              rollLength: true,
              rollPrice: true,
              currency: true,
            },
          })
        : []
      const matMap = new Map(mats.map((m) => [m.id, m]))

      materials = items.map((it) => {
        const mat = it.materialId ? matMap.get(it.materialId) ?? null : null
        const itemLabel = mat
          ? `${mat.materialCode} ${mat.materialName}`
          : it.customMaterialName ?? "（名称未設定）"
        return {
          bomItemId: it.id,
          itemLabel,
          itemCategory: it.itemCategory,
          usagePerUnit: toNum(it.usagePerUnit),
          lossRate: it.lossRate.toNumber(),
          unit: it.unit,
          procurementMode: it.procurementMode,
          unitPrice: toNum(it.unitPrice),
          currency: it.currency,
          rollLength: mat ? toNum(mat.rollLength) : null,
          rollPrice: mat ? toNum(mat.rollPrice) : null,
          rollCurrency: mat ? mat.currency : null,
          cutFee: null, // 画面手入力（保存しない）
        }
      })
    }

    // ---- 工賃入力（PRODUCTION WorkOrder の WoItem）----
    const wos = await prisma.workOrder.findMany({
      where: {
        companyId: sess.companyId,
        productId,
        workCategory: WorkOrderCategory.PRODUCTION,
        deletedAt: null,
      },
      select: { id: true, woNumber: true },
    })
    const woById = new Map(wos.map((w) => [w.id, w]))

    let labor: LaborCostInput[] = []
    if (wos.length > 0) {
      const woItems = await prisma.woItem.findMany({
        where: { woId: { in: [...woById.keys()] } },
        orderBy: { itemOrder: "asc" },
      })
      const categoryIds = [
        ...new Set(
          woItems
            .map((i) => i.costCategoryId)
            .filter((v): v is string => !!v),
        ),
      ]
      const cats = categoryIds.length
        ? await prisma.costCategory.findMany({
            where: { id: { in: categoryIds }, companyId: sess.companyId },
            select: { id: true, externalCategory: true },
          })
        : []
      const catMap = new Map(cats.map((c) => [c.id, c.externalCategory]))

      labor = woItems.map((wi) => {
        const wo = woById.get(wi.woId)
        return {
          woItemId: wi.id,
          woId: wi.woId,
          woNumber: wo?.woNumber ?? "",
          workDescription: wi.workDescription,
          quantity: wi.quantity,
          unitPrice: toNum(wi.unitPrice),
          currency: wi.currency,
          externalCategory: wi.costCategoryId
            ? catMap.get(wi.costCategoryId) ?? null
            : null,
          billingClassification: wi.billingClassification,
        }
      })
    }

    return { ok: true, data: { materials, labor } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "原価データの取得に失敗しました",
    }
  }
}
