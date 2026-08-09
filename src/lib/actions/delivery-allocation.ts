"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * B-108 PR2b 第2段: 引き当て候補の取得（read-only）。
 * 仕様: docs/specs/b-108-pr2-allocation-ui-spec-confirmation-v0_1-2026-08-08.md ④⑤⑥⑨⑫
 *
 * - 候補スコープはクライアント配下の全品番（§⑥・Product.clientId は NOT NULL 直持ち）。
 * - 品番グループ（1階層・ブランド名併記）を groups として返し、UI 側が束ねる。
 * - 品番が紐づかない WO/PO 明細は blocked（除外せず警告・§⑤）。
 * - ④ バッジは2種類を厳密に使い分ける:
 *     サンプル = sourceSampleProductionId（安定・正確に納品書番号を出す）
 *     発注     = 親 id（sourceWorkOrderId / sourcePurchaseOrderId）で「実績有無」のみ
 *   ★ sourceWoItemId / sourcePoItemId は判定に一切使わない（不安定・§⑫）。
 * - Product に brand relation は無い（house style: scalar FK のみ）。
 *   ブランド名は Brand を別クエリで引き Map で解決する。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
    tenantType: session.user.tenantType,
  }
}

/** 品番グループ（1階層・ブランド名は見出しに併記） */
export type AllocationProductGroup = {
  productId: string
  productCode: string
  productName: string
  /** Product.brandId は NOT NULL */
  brandId: string
  /** Brand が引けなかった場合のみ null */
  brandName: string | null
}

export type AllocationCandidateSample = {
  kind: "SAMPLE"
  sampleProductionId: string
  sampleNumber: string
  sampleRound: string
  title: string | null
  quantity: number
  productId: string
  /** ④ 情報バッジ: 引き当て済みの納品書番号（安定列で判定・正確） */
  deliveredIn: string[]
}

export type AllocationCandidateOrder = {
  kind: "WO" | "PO"
  /** 明細 id（不安定・best-effort。★フィルタ根拠にしない） */
  itemId: string
  /** 親 id（安定・バッジ根拠） */
  orderId: string
  orderNumber: string
  description: string
  quantity: number
  unit: string
  unitPrice: number | null
  productId: string
  /** ⑨ PoItem.quantity は Decimal。整数でなければ true（UI で警告・自動丸めなし） */
  hasFractionalQuantity: boolean
  isPhysicalAsset: boolean
  /** ④ 情報バッジ: この発注に納品実績があるか（★行単位ではない） */
  orderHasDelivery: boolean
}

export type AllocationCandidateBlocked = {
  kind: "WO" | "PO"
  orderNumber: string
  description: string
  /**
   * NO_PRODUCT      = 発注に品番が紐づいていない（§⑤）
   * PRODUCT_MISSING = 品番は指しているが Product が存在しない（物理削除済み）
   *                   ★黙って除外しない。§⑤ と同じ理由で警告として出す。
   */
  reason: "NO_PRODUCT" | "PRODUCT_MISSING"
}

export type AllocationCandidates = {
  groups: AllocationProductGroup[]
  samples: AllocationCandidateSample[]
  orders: AllocationCandidateOrder[]
  blocked: AllocationCandidateBlocked[]
}

const EMPTY: AllocationCandidates = {
  groups: [],
  samples: [],
  orders: [],
  blocked: [],
}

export async function listAllocationCandidates(
  clientId: string,
): Promise<ActionResult<AllocationCandidates>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // (a) clientId 未指定なら空（ok）。
    if (!clientId) return { ok: true, data: EMPTY }

    const companyId = sess.companyId

    // (b) 品番グループ（§⑥・クライアント配下の全品番）。brand relation が無いため2クエリ。
    const products = await prisma.product.findMany({
      where: { companyId, clientId, deletedAt: null },
      select: { id: true, productCode: true, productName: true, brandId: true },
    })
    if (products.length === 0) return { ok: true, data: EMPTY }

    const productIds = products.map((p) => p.id)

    const brandIds = [...new Set(products.map((p) => p.brandId))]
    const brands = await prisma.brand.findMany({
      where: { companyId, id: { in: brandIds } },
      select: { id: true, brandName: true },
    })
    const brandNameById = new Map(brands.map((b) => [b.id, b.brandName]))

    const groups: AllocationProductGroup[] = products
      .map((p) => ({
        productId: p.id,
        productCode: p.productCode,
        productName: p.productName,
        brandId: p.brandId,
        brandName: brandNameById.get(p.brandId) ?? null,
      }))
      // ソート: brandName（null は末尾）→ productCode 昇順。
      .sort((a, b) => {
        if (a.brandName === null && b.brandName !== null) return 1
        if (a.brandName !== null && b.brandName === null) return -1
        if (a.brandName !== null && b.brandName !== null) {
          const byBrand = a.brandName.localeCompare(b.brandName)
          if (byBrand !== 0) return byBrand
        }
        return a.productCode.localeCompare(b.productCode)
      })

    const productIdSet = new Set(productIds)

    // 会社全体の生存品番 id（クライアント問わず）。
    // 「品番が物理削除済み（PRODUCT_MISSING）」と「他クライアントの発注（除外）」を
    // 区別するために使う。前者は §⑤ の趣旨で警告表示し、後者は黙って除外する。
    const aliveProductIds = new Set(
      (
        await prisma.product.findMany({
          where: { companyId, deletedAt: null },
          select: { id: true },
        })
      ).map((p) => p.id),
    )

    // (c) サンプル候補。productId in で絞る（孤児 SP は productIds に含まれず自然に除外）。
    const sampleRows = await prisma.sampleProduction.findMany({
      where: { companyId, deletedAt: null, productId: { in: productIds } },
      select: {
        id: true,
        sampleNumber: true,
        sampleRound: true,
        title: true,
        sampleQuantity: true,
        productId: true,
      },
      orderBy: { sampleNumber: "asc" },
    })
    const sampleIds = sampleRows.map((s) => s.id)

    // (d) WO 明細候補（relation 名は wo）。
    const woRows = await prisma.woItem.findMany({
      where: {
        billingClassification: "INDIVIDUAL_BILLING",
        wo: { companyId, deletedAt: null },
      },
      select: {
        id: true,
        workDescription: true,
        quantity: true,
        unit: true,
        unitPrice: true,
        wo: { select: { id: true, woNumber: true, productId: true } },
      },
    })

    // (e) PO 明細候補（relation 名は po）。
    const poRows = await prisma.poItem.findMany({
      where: {
        OR: [
          { billingClassification: "INDIVIDUAL_BILLING" },
          { isPhysicalAsset: true },
        ],
        po: { companyId, deletedAt: null },
      },
      select: {
        id: true,
        customItemName: true,
        description: true,
        quantity: true,
        unit: true,
        unitPrice: true,
        isPhysicalAsset: true,
        po: { select: { id: true, poNumber: true, primaryProductId: true } },
      },
    })

    // (f) ④ バッジ判定 — 2種類を厳密に分ける。
    // サンプル用（安定・正確・納品書番号を出す）。
    const deliveredBySample = new Map<string, Set<string>>()
    if (sampleIds.length > 0) {
      const dnSample = await prisma.deliveryNoteItem.findMany({
        where: {
          sourceSampleProductionId: { in: sampleIds },
          deliveryNote: { companyId, deletedAt: null },
        },
        select: {
          sourceSampleProductionId: true,
          deliveryNote: { select: { deliveryNumber: true } },
        },
      })
      for (const r of dnSample) {
        const spId = r.sourceSampleProductionId
        if (!spId) continue
        const set = deliveredBySample.get(spId) ?? new Set<string>()
        set.add(r.deliveryNote.deliveryNumber)
        deliveredBySample.set(spId, set)
      }
    }

    // 発注用（★親単位・存在有無のみ）。行 id は使わない。
    const woIds = [...new Set(woRows.map((w) => w.wo.id))]
    const poIds = [...new Set(poRows.map((p) => p.po.id))]
    const orderHasDelivery = new Set<string>()
    if (woIds.length > 0 || poIds.length > 0) {
      const dnOrder = await prisma.deliveryNoteItem.findMany({
        where: {
          OR: [
            { sourceWorkOrderId: { in: woIds } },
            { sourcePurchaseOrderId: { in: poIds } },
          ],
          deliveryNote: { companyId, deletedAt: null },
        },
        select: { sourceWorkOrderId: true, sourcePurchaseOrderId: true },
      })
      for (const r of dnOrder) {
        if (r.sourceWorkOrderId) orderHasDelivery.add(r.sourceWorkOrderId)
        if (r.sourcePurchaseOrderId)
          orderHasDelivery.add(r.sourcePurchaseOrderId)
      }
    }

    // 組み立て。
    const samples: AllocationCandidateSample[] = sampleRows.map((s) => ({
      kind: "SAMPLE",
      sampleProductionId: s.id,
      sampleNumber: s.sampleNumber,
      sampleRound: s.sampleRound,
      title: s.title,
      quantity: s.sampleQuantity,
      productId: s.productId,
      deliveredIn: [...(deliveredBySample.get(s.id) ?? new Set<string>())],
    }))

    const orders: AllocationCandidateOrder[] = []
    const blocked: AllocationCandidateBlocked[] = []

    for (const w of woRows) {
      // 1. 品番未設定 → NO_PRODUCT（警告）
      if (w.wo.productId === null) {
        blocked.push({
          kind: "WO",
          orderNumber: w.wo.woNumber,
          description: w.workDescription,
          reason: "NO_PRODUCT",
        })
        continue
      }
      // 2. 品番を指すが Product が物理削除済み → PRODUCT_MISSING（警告・黙って除外しない）
      if (!aliveProductIds.has(w.wo.productId)) {
        blocked.push({
          kind: "WO",
          orderNumber: w.wo.woNumber,
          description: w.workDescription,
          reason: "PRODUCT_MISSING",
        })
        continue
      }
      // 3. 他クライアントの発注は候補から除外（正当な除外・警告不要）。
      if (!productIdSet.has(w.wo.productId)) continue
      // 4. それ以外 → 候補
      orders.push({
        kind: "WO",
        itemId: w.id,
        orderId: w.wo.id,
        orderNumber: w.wo.woNumber,
        description: w.workDescription,
        quantity: w.quantity, // Int
        unit: w.unit,
        unitPrice: w.unitPrice != null ? w.unitPrice.toNumber() : null,
        productId: w.wo.productId,
        hasFractionalQuantity: false, // WoItem.quantity は Int
        isPhysicalAsset: false, // WoItem に isPhysicalAsset は無い
        orderHasDelivery: orderHasDelivery.has(w.wo.id),
      })
    }

    for (const p of poRows) {
      const desc = p.customItemName ?? p.description ?? "（品名なし）"
      // 1. 品番未設定 → NO_PRODUCT（警告）
      if (p.po.primaryProductId === null) {
        blocked.push({
          kind: "PO",
          orderNumber: p.po.poNumber,
          description: desc,
          reason: "NO_PRODUCT",
        })
        continue
      }
      // 2. 品番を指すが Product が物理削除済み → PRODUCT_MISSING（警告）
      if (!aliveProductIds.has(p.po.primaryProductId)) {
        blocked.push({
          kind: "PO",
          orderNumber: p.po.poNumber,
          description: desc,
          reason: "PRODUCT_MISSING",
        })
        continue
      }
      // 3. 他クライアントの発注は除外。
      if (!productIdSet.has(p.po.primaryProductId)) continue
      // 4. それ以外 → 候補
      // ⑨: Decimal を Number 化。整数でなければ警告フラグ（自動で丸めない）。
      const qtyNum = p.quantity.toNumber()
      orders.push({
        kind: "PO",
        itemId: p.id,
        orderId: p.po.id,
        orderNumber: p.po.poNumber,
        description: desc,
        quantity: qtyNum,
        unit: p.unit,
        unitPrice: p.unitPrice != null ? p.unitPrice.toNumber() : null,
        productId: p.po.primaryProductId,
        hasFractionalQuantity: !Number.isInteger(qtyNum),
        isPhysicalAsset: p.isPhysicalAsset,
        orderHasDelivery: orderHasDelivery.has(p.po.id),
      })
    }

    return { ok: true, data: { groups, samples, orders, blocked } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "候補の取得に失敗しました",
    }
  }
}
