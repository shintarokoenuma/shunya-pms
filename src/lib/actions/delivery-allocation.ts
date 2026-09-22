"use server"

import type { DeliveryNoteStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { SO_ALLOCATABLE_STATUSES } from "@/lib/validators/delivery-note"

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
 * - B-114 PR-1（§2-1）: 受注（量産）の候補 soItems を追加。1候補＝1 SoItem（＝1 SKU）。
 *   対象の受注は isLatest・status が SO_ALLOCATABLE_STATUSES。納品済／引当中は納品書明細の soItemId から算出。
 *   SoItem → Sku → ProductColorway は scalar FK なので別クエリ＋Map で解決する。
 */

/** 納品済みと数える納品書の状態（D-17） */
const DN_DELIVERED_STATUSES: DeliveryNoteStatus[] = ["DELIVERED", "RECEIVED"]
/** 他の納品書に引き当て中と数える納品書の状態 */
const DN_ALLOCATED_STATUSES: DeliveryNoteStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SHIPPED",
  "IN_TRANSIT",
]

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
  /** B-114: 量産行の先方品番の初期値 */
  clientProductCode: string | null
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

/** B-114 §2-1: 受注（量産）の候補。1候補＝1 SoItem（＝1 SKU） */
export type AllocationCandidateSoItem = {
  kind: "SO"
  soId: string
  soNumber: string
  soItemId: string
  skuId: string
  productId: string
  /** ProductColorway.clientColorName があればそれ、無ければ Sku.colorName */
  colorName: string
  size: string
  sizeOrder: number
  orderedQuantity: number
  /** SoItem.unitPrice（null 可） */
  unitPrice: number | null
  /** 納品書が DELIVERED / RECEIVED の明細の数量合計 */
  deliveredQuantity: number
  /** 納品書が DRAFT〜IN_TRANSIT の明細の数量合計（他の納品書に引き当て中） */
  allocatedQuantity: number
  /** ordered − delivered − allocated（マイナスは 0） */
  remainingQuantity: number
}

export type AllocationCandidates = {
  groups: AllocationProductGroup[]
  samples: AllocationCandidateSample[]
  orders: AllocationCandidateOrder[]
  blocked: AllocationCandidateBlocked[]
  soItems: AllocationCandidateSoItem[]
}

const EMPTY: AllocationCandidates = {
  groups: [],
  samples: [],
  orders: [],
  blocked: [],
  soItems: [],
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
      select: { id: true, productCode: true, productName: true, brandId: true, clientProductCode: true },
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
        clientProductCode: p.clientProductCode,
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

    // (g) B-114 §2-1: 受注（量産）の候補。
    const soItems = await listSoItemCandidates(companyId, clientId, products)

    return { ok: true, data: { groups, samples, orders, blocked, soItems } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "候補の取得に失敗しました",
    }
  }
}

// =============================================================================
// B-114 PR-1 §2-1: 受注（量産）の候補（1 SoItem ＝ 1 SKU）
// =============================================================================
async function listSoItemCandidates(
  companyId: string,
  clientId: string,
  products: { id: string; productCode: string }[],
): Promise<AllocationCandidateSoItem[]> {
  const sos = await prisma.salesOrder.findMany({
    where: {
      companyId,
      clientId,
      deletedAt: null,
      isLatest: true,
      status: { in: SO_ALLOCATABLE_STATUSES },
    },
    select: {
      id: true,
      soNumber: true,
      items: {
        select: { id: true, skuId: true, orderedQuantity: true, unitPrice: true },
      },
    },
  })
  if (sos.length === 0) return []

  const skuIds = [...new Set(sos.flatMap((so) => so.items.map((it) => it.skuId)))]
  if (skuIds.length === 0) return []

  // Sku（companyId スコープ・生存）。SoItem.skuId は scalar FK なので別クエリ。
  const skus = await prisma.sku.findMany({
    where: { id: { in: skuIds }, companyId, deletedAt: null },
    select: {
      id: true,
      productId: true,
      colorwayId: true,
      colorName: true,
      size: true,
      sizeOrder: true,
    },
  })
  const skuById = new Map(skus.map((s) => [s.id, s]))

  // 先方色名（ProductColorway.clientColorName・B-170）。
  const colorwayIds = [...new Set(skus.map((s) => s.colorwayId))]
  const colorways = colorwayIds.length
    ? await prisma.productColorway.findMany({
        where: { id: { in: colorwayIds }, companyId },
        select: { id: true, clientColorName: true },
      })
    : []
  const clientColorById = new Map(colorways.map((c) => [c.id, c.clientColorName]))

  // 納品済み／引当中（納品書明細の soItemId で集計・納品書は companyId・deletedAt null）。
  const soItemIds = sos.flatMap((so) => so.items.map((it) => it.id))
  const dnRows = await prisma.deliveryNoteItem.findMany({
    where: {
      soItemId: { in: soItemIds },
      deliveryNote: { companyId, deletedAt: null },
    },
    select: { soItemId: true, quantity: true, deliveryNote: { select: { status: true } } },
  })
  const delivered = new Map<string, number>()
  const allocated = new Map<string, number>()
  for (const r of dnRows) {
    if (!r.soItemId) continue
    if (DN_DELIVERED_STATUSES.includes(r.deliveryNote.status)) {
      delivered.set(r.soItemId, (delivered.get(r.soItemId) ?? 0) + r.quantity)
    } else if (DN_ALLOCATED_STATUSES.includes(r.deliveryNote.status)) {
      allocated.set(r.soItemId, (allocated.get(r.soItemId) ?? 0) + r.quantity)
    }
  }

  const productCodeById = new Map(products.map((p) => [p.id, p.productCode]))
  const out: AllocationCandidateSoItem[] = []
  for (const so of sos) {
    for (const it of so.items) {
      const sku = skuById.get(it.skuId)
      // Sku が引けない（削除済み）／このクライアント配下の品番でない SoItem は候補から外す。
      if (!sku || !productCodeById.has(sku.productId)) continue
      const d = delivered.get(it.id) ?? 0
      const a = allocated.get(it.id) ?? 0
      out.push({
        kind: "SO",
        soId: so.id,
        soNumber: so.soNumber,
        soItemId: it.id,
        skuId: it.skuId,
        productId: sku.productId,
        colorName: clientColorById.get(sku.colorwayId) || sku.colorName,
        size: sku.size,
        sizeOrder: sku.sizeOrder,
        orderedQuantity: it.orderedQuantity,
        unitPrice: it.unitPrice != null ? it.unitPrice.toNumber() : null,
        deliveredQuantity: d,
        allocatedQuantity: a,
        remainingQuantity: Math.max(it.orderedQuantity - d - a, 0),
      })
    }
  }
  // 並び: 受注番号 → 品番 → 色 → sizeOrder
  out.sort(
    (x, y) =>
      x.soNumber.localeCompare(y.soNumber) ||
      (productCodeById.get(x.productId) ?? "").localeCompare(productCodeById.get(y.productId) ?? "") ||
      x.colorName.localeCompare(y.colorName) ||
      x.sizeOrder - y.sizeOrder,
  )
  return out
}
