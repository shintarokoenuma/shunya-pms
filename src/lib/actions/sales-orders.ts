"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  Currency,
  SalesOrderStatus,
  type SkuMoqStatus,
  type OrderSourceType,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  salesOrderInputSchema,
  type SalesOrderInput,
} from "@/lib/validators/sales-order"

/**
 * B-148 PR-1: 受注（SalesOrder / SoItem）Server Actions。
 *
 * 設計根拠: docs/specs/sales-order-spec-confirmation-v1_0-2026-08-13.md（R-5〜R-11）
 *   ／ docs/specs/b-148-pr1-implementation-brief-2026-08-13.md（D-2〜D-8）
 *
 * house style は production-estimates.ts / work-orders.ts を踏襲:
 * - 採番 SO-{年}-{4桁}（companyId×年・tx 内確定・P2002 リトライのみ）。
 * - SalesOrder / SoItem は TENANT_MODELS 非対象＝companyId/deletedAt の自動注入は無い。
 *   よってヘッダは companyId を明示的に書き、SoItem の絞り込みは親 SalesOrder を経由する。
 * - 書き込み規則（ブリーフ §4-3）: productId=null 固定・version=1/isLatest=true・
 *   unitPrice/appliedMoqTierId/taxAmount/quotationId には書かない・totalAmount=subtotal（税抜）。
 */

// =============================================================================
// 型・ヘルパー
// =============================================================================
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
  }
}

/** Decimal → number（読み・null 保持）。 */
function dnum(v: Prisma.Decimal | null): number | null {
  return v != null ? Number(v) : null
}

/**
 * Sku.orderedQuantity の集計対象（D-4）。CONFIRMED 以降のみ受注実績としてカウントする。
 * TENTATIVE・CANCELLED・ON_HOLD は除外。
 */
const COUNTED_STATUSES: SalesOrderStatus[] = [
  SalesOrderStatus.CONFIRMED,
  SalesOrderStatus.IN_PRODUCTION,
  SalesOrderStatus.PARTIAL_DELIVERED,
  SalesOrderStatus.DELIVERED,
  SalesOrderStatus.COMPLETED,
]

function salesOrderNumberPrefix(year: number): string {
  return `SO-${year}-`
}

// SalesOrder は TENANT 非対象のため finder の where に companyId を明示する。
// PE/ModelCode と同じ「必要メソッドだけ構造的に受ける」方式（tx / prisma 両対応）。
type SoNumberFinder = {
  findFirst: (args: {
    where: { companyId: string; soNumber: { startsWith: string } }
    orderBy: { soNumber: "desc" }
    select: { soNumber: true }
  }) => Promise<{ soNumber: string } | null>
}

async function computeNextSoNumber(
  finder: SoNumberFinder,
  companyId: string,
  prefix: string,
): Promise<string> {
  const last = await finder.findFirst({
    where: { companyId, soNumber: { startsWith: prefix } },
    orderBy: { soNumber: "desc" },
    select: { soNumber: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.soNumber.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`
}

// =============================================================================
// ★Sku.orderedQuantity 再集計（PR-1 の中核・ブリーフ §5 / D-4）
//
// tx を Prisma.TransactionClient として渡すと $extends 済みクライアントで型が合わない
// （既知問題）。house style（PeNumberFinder/ModelCodeFinder）に倣い、必要な delegate
// （tx.soItem / tx.sku）だけを構造的に受け取る。呼び出しは常に同一 tx 内。
// =============================================================================
type SoItemAggregator = {
  aggregate: (args: {
    _sum: { orderedQuantity: true }
    where: {
      skuId: string
      so: {
        companyId: string
        deletedAt: null
        isLatest: boolean
        status: { in: SalesOrderStatus[] }
      }
    }
  }) => Promise<{ _sum: { orderedQuantity: number | null } }>
}
type SkuUpdater = {
  update: (args: {
    where: { id: string }
    data: { orderedQuantity: number }
  }) => Promise<unknown>
}

async function recomputeSkuOrderedQuantities(
  soItemDelegate: SoItemAggregator,
  skuDelegate: SkuUpdater,
  companyId: string,
  skuIds: string[],
): Promise<void> {
  const ids = [...new Set(skuIds.filter((v): v is string => !!v))]
  for (const skuId of ids) {
    const agg = await soItemDelegate.aggregate({
      _sum: { orderedQuantity: true },
      where: {
        skuId,
        so: {
          companyId,
          deletedAt: null,
          isLatest: true,
          status: { in: COUNTED_STATUSES },
        },
      },
    })
    // 該当 SoItem が0件なら _sum は null → 0 を書く（更新対象から外さない）。
    await skuDelegate.update({
      where: { id: skuId },
      data: { orderedQuantity: agg._sum.orderedQuantity ?? 0 },
    })
  }
}

/** 影響 SKU の品番カルテを revalidate（skuId → productId を引く）。 */
async function revalidateForSkus(skuIds: string[]): Promise<void> {
  const ids = [...new Set(skuIds.filter((v): v is string => !!v))]
  if (ids.length > 0) {
    const skus = await prisma.sku.findMany({
      where: { id: { in: ids } },
      select: { productId: true },
    })
    for (const pid of new Set(skus.map((s) => s.productId))) {
      revalidatePath(`/products/${pid}`)
    }
  }
  revalidatePath("/sales-orders")
}

/**
 * 入力の全 SKU が「その品番ブロックの productId 配下・自社・生存」であることを検証する。
 * クライアント任せにせず、Sku.productId と突き合わせる（ブリーフ §4-2）。
 * 併せて、明細行（SoItem 相当・skuId ごとに単価配布・小計計算）を組み立てて返す。
 */
type SoItemRow = {
  skuId: string
  orderedQuantity: number
  unitPrice: Prisma.Decimal
  subtotal: Prisma.Decimal
  currency: Currency
  moqStatus: SkuMoqStatus
  moqDecisionReason: string | null
}

async function buildAndValidateItems(
  companyId: string,
  input: SalesOrderInput,
): Promise<{ ok: true; rows: SoItemRow[] } | { ok: false; error: string }> {
  const allSkuIds = input.products.flatMap((p) => p.skus.map((s) => s.skuId))
  // skuId の重複（別ブロック含む）を禁止（@@unique([soId, skuId]) と整合）。
  if (new Set(allSkuIds).size !== allSkuIds.length) {
    return { ok: false, error: "同じ SKU が複数行にあります" }
  }

  const skus = await prisma.sku.findMany({
    where: { id: { in: allSkuIds } },
    select: { id: true, productId: true },
  })
  const skuProduct = new Map(skus.map((s) => [s.id, s.productId]))

  const rows: SoItemRow[] = []
  for (const p of input.products) {
    for (const s of p.skus) {
      const pid = skuProduct.get(s.skuId)
      if (pid === undefined) {
        return { ok: false, error: `SKU が見つかりません（${s.skuId}）` }
      }
      if (pid !== p.productId) {
        return {
          ok: false,
          error: "SKU が指定の品番の配下ではありません",
        }
      }
      const unitPrice = new Prisma.Decimal(p.unitPrice)
      rows.push({
        skuId: s.skuId,
        orderedQuantity: s.orderedQuantity,
        unitPrice,
        subtotal: unitPrice.mul(s.orderedQuantity),
        currency: input.currency,
        moqStatus: s.moqStatus,
        moqDecisionReason: s.moqDecisionReason || null,
      })
    }
  }
  return { ok: true, rows }
}

// =============================================================================
// DTO
// =============================================================================
export type SalesOrderItemDTO = {
  id: string
  skuId: string
  orderedQuantity: number
  unitPrice: number
  subtotal: number
  currency: Currency
  moqStatus: SkuMoqStatus
  moqDecisionReason: string | null
  productionQuantity: number | null
}

export type SalesOrderDTO = {
  id: string
  soNumber: string
  clientId: string
  buyerId: string | null
  sourceType: OrderSourceType
  buyerOrderNumber: string | null
  orderDate: string
  desiredDeliveryDate: string | null
  currency: Currency
  title: string | null
  internalNotes: string | null
  buyerSpecialRequests: string | null
  status: SalesOrderStatus
  originalFiles: unknown
  totalQuantity: number
  subtotal: number | null
  totalAmount: number | null
  items: SalesOrderItemDTO[]
}

export type SalesOrderListRow = {
  id: string
  soNumber: string
  clientId: string
  clientName: string
  buyerOrderNumber: string | null
  productCount: number
  totalQuantity: number
  status: SalesOrderStatus
  orderDate: string
}

// =============================================================================
// 1. 一覧
// =============================================================================
export async function listSalesOrders(): Promise<
  ActionResult<{ rows: SalesOrderListRow[] }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const orders = await prisma.salesOrder.findMany({
      where: { companyId: sess.companyId, deletedAt: null },
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        soNumber: true,
        clientId: true,
        buyerOrderNumber: true,
        totalQuantity: true,
        status: true,
        orderDate: true,
        items: { select: { skuId: true } },
      },
    })

    const allSkuIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.skuId)))]
    const skus = allSkuIds.length
      ? await prisma.sku.findMany({
          where: { id: { in: allSkuIds } },
          select: { id: true, productId: true },
        })
      : []
    const skuProduct = new Map(skus.map((s) => [s.id, s.productId]))

    const clientIds = [...new Set(orders.map((o) => o.clientId))]
    const clients = clientIds.length
      ? await prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, companyName: true },
        })
      : []
    const clientName = new Map(clients.map((c) => [c.id, c.companyName]))

    const rows: SalesOrderListRow[] = orders.map((o) => {
      const productIds = new Set(
        o.items
          .map((i) => skuProduct.get(i.skuId))
          .filter((v): v is string => !!v),
      )
      return {
        id: o.id,
        soNumber: o.soNumber,
        clientId: o.clientId,
        clientName: clientName.get(o.clientId) ?? "（不明なクライアント）",
        buyerOrderNumber: o.buyerOrderNumber,
        productCount: productIds.size,
        totalQuantity: o.totalQuantity,
        status: o.status,
        orderDate: o.orderDate.toISOString().slice(0, 10),
      }
    })
    return { ok: true, data: { rows } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "受注一覧の取得に失敗しました",
    }
  }
}

// =============================================================================
// 2. 取得（詳細・編集共用）
// =============================================================================
export async function getSalesOrder(
  id: string,
): Promise<ActionResult<SalesOrderDTO>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const so = await prisma.salesOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: { items: { orderBy: { createdAt: "asc" } } },
    })
    if (!so) return { ok: false, error: "受注が見つかりません" }

    return {
      ok: true,
      data: {
        id: so.id,
        soNumber: so.soNumber,
        clientId: so.clientId,
        buyerId: so.buyerId,
        sourceType: so.sourceType,
        buyerOrderNumber: so.buyerOrderNumber,
        orderDate: so.orderDate.toISOString().slice(0, 10),
        desiredDeliveryDate: so.desiredDeliveryDate
          ? so.desiredDeliveryDate.toISOString().slice(0, 10)
          : null,
        currency: so.currency,
        title: so.title,
        internalNotes: so.internalNotes,
        buyerSpecialRequests: so.buyerSpecialRequests,
        status: so.status,
        originalFiles: so.originalFiles ?? [],
        totalQuantity: so.totalQuantity,
        subtotal: dnum(so.subtotal),
        totalAmount: dnum(so.totalAmount),
        items: so.items.map((it) => ({
          id: it.id,
          skuId: it.skuId,
          orderedQuantity: it.orderedQuantity,
          unitPrice: Number(it.unitPrice),
          subtotal: Number(it.subtotal),
          currency: it.currency,
          moqStatus: it.moqStatus,
          moqDecisionReason: it.moqDecisionReason,
          productionQuantity: it.productionQuantity,
        })),
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "受注の取得に失敗しました",
    }
  }
}

const CREATE_MAX_RETRIES = 3

// =============================================================================
// 3. 作成
// =============================================================================
export async function createSalesOrder(
  input: unknown,
): Promise<ActionResult<{ id: string; soNumber: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = salesOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // クライアント所有確認（TENANT: companyId 自動注入）。
    const client = await prisma.client.findFirst({
      where: { id: data.clientId },
      select: { id: true },
    })
    if (!client) return { ok: false, error: "クライアントが見つかりません" }

    const built = await buildAndValidateItems(sess.companyId, data)
    if (!built.ok) return built
    const rows = built.rows

    const totalQuantity = rows.reduce((s, r) => s + r.orderedQuantity, 0)
    const subtotal = rows.reduce(
      (s, r) => s.add(r.subtotal),
      new Prisma.Decimal(0),
    )
    const affectedSkuIds = rows.map((r) => r.skuId)
    const prefix = salesOrderNumberPrefix(new Date().getFullYear())

    let created: { id: string; soNumber: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx) => {
            const soNumber = await computeNextSoNumber(
              tx.salesOrder,
              sess.companyId,
              prefix,
            )
            const header = await tx.salesOrder.create({
              data: {
                companyId: sess.companyId,
                soNumber,
                productId: null, // D-3: 品番は SoItem→Sku で辿る。SO には持たせない
                clientId: data.clientId,
                buyerId: data.buyerId,
                sourceType: data.sourceType,
                buyerOrderNumber: data.buyerOrderNumber || null,
                orderDate: new Date(data.orderDate),
                desiredDeliveryDate: data.desiredDeliveryDate
                  ? new Date(data.desiredDeliveryDate)
                  : null,
                currency: data.currency,
                title: data.title || null,
                internalNotes: data.internalNotes || null,
                buyerSpecialRequests: data.buyerSpecialRequests || null,
                status: data.status,
                originalFiles: data.originalFiles as Prisma.InputJsonValue,
                version: 1,
                isLatest: true,
                totalQuantity,
                subtotal,
                totalAmount: subtotal, // §1-1: 税抜合計。TAX_RATE を持ち込まない
                createdByUserId: sess.userId,
              },
              select: { id: true, soNumber: true },
            })
            await tx.soItem.createMany({
              data: rows.map((r) => ({
                soId: header.id,
                skuId: r.skuId,
                orderedQuantity: r.orderedQuantity,
                unitPrice: r.unitPrice,
                subtotal: r.subtotal,
                currency: r.currency,
                moqStatus: r.moqStatus,
                moqDecisionReason: r.moqDecisionReason,
              })),
            })
            await recomputeSkuOrderedQuantities(
              tx.soItem,
              tx.sku,
              sess.companyId,
              affectedSkuIds,
            )
            return header
          },
          { timeout: 15000 },
        )
        break
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue
        }
        throw e
      }
    }

    if (!created) {
      return {
        ok: false,
        error:
          lastError instanceof Error
            ? `採番衝突が解消されませんでした：${lastError.message}`
            : "採番衝突が解消されませんでした",
      }
    }

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "SalesOrder",
        entityId: created.id,
        afterData: {
          soNumber: created.soNumber,
          clientId: data.clientId,
          status: data.status,
          itemCount: rows.length,
          totalQuantity,
        },
      },
    })

    await revalidateForSkus(affectedSkuIds)
    return { ok: true, data: { id: created.id, soNumber: created.soNumber } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "受注の作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新（明細は upsert＋不在 skuId の deleteMany。B-124 の全削除→再作成を避ける）
// =============================================================================
export async function updateSalesOrder(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = salesOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.salesOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, items: { select: { skuId: true } } },
    })
    if (!existing) return { ok: false, error: "受注が見つかりません" }

    const built = await buildAndValidateItems(sess.companyId, data)
    if (!built.ok) return built
    const rows = built.rows

    const newSkuIds = rows.map((r) => r.skuId)
    const oldSkuIds = existing.items.map((i) => i.skuId)
    const unionSkuIds = [...new Set([...oldSkuIds, ...newSkuIds])]

    const totalQuantity = rows.reduce((s, r) => s + r.orderedQuantity, 0)
    const subtotal = rows.reduce(
      (s, r) => s.add(r.subtotal),
      new Prisma.Decimal(0),
    )

    await prisma.$transaction(
      async (tx) => {
        await tx.salesOrder.update({
          where: { id },
          data: {
            productId: null,
            clientId: data.clientId,
            buyerId: data.buyerId,
            sourceType: data.sourceType,
            buyerOrderNumber: data.buyerOrderNumber || null,
            orderDate: new Date(data.orderDate),
            desiredDeliveryDate: data.desiredDeliveryDate
              ? new Date(data.desiredDeliveryDate)
              : null,
            currency: data.currency,
            title: data.title || null,
            internalNotes: data.internalNotes || null,
            buyerSpecialRequests: data.buyerSpecialRequests || null,
            status: data.status,
            originalFiles: data.originalFiles as Prisma.InputJsonValue,
            totalQuantity,
            subtotal,
            totalAmount: subtotal,
          },
        })
        // upsert（@@unique([soId, skuId]) = soId_skuId）
        for (const r of rows) {
          await tx.soItem.upsert({
            where: { soId_skuId: { soId: id, skuId: r.skuId } },
            create: {
              soId: id,
              skuId: r.skuId,
              orderedQuantity: r.orderedQuantity,
              unitPrice: r.unitPrice,
              subtotal: r.subtotal,
              currency: r.currency,
              moqStatus: r.moqStatus,
              moqDecisionReason: r.moqDecisionReason,
            },
            update: {
              orderedQuantity: r.orderedQuantity,
              unitPrice: r.unitPrice,
              subtotal: r.subtotal,
              currency: r.currency,
              moqStatus: r.moqStatus,
              moqDecisionReason: r.moqDecisionReason,
            },
          })
        }
        // 入力から外れた skuId を削除
        await tx.soItem.deleteMany({
          where: { soId: id, skuId: { notIn: newSkuIds } },
        })
        await recomputeSkuOrderedQuantities(
          tx.soItem,
          tx.sku,
          sess.companyId,
          unionSkuIds,
        )
      },
      { timeout: 15000 },
    )

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "SalesOrder",
        entityId: id,
        afterData: {
          status: data.status,
          itemCount: rows.length,
          totalQuantity,
        },
      },
    })

    await revalidateForSkus(unionSkuIds)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "受注の更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. ステータス変更（★D-4 により受注数がここで増減する。再集計を必ず走らせる）
// =============================================================================
export async function updateSalesOrderStatus(
  id: string,
  status: SalesOrderStatus,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.salesOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true, items: { select: { skuId: true } } },
    })
    if (!existing) return { ok: false, error: "受注が見つかりません" }

    const skuIds = existing.items.map((i) => i.skuId)

    await prisma.$transaction(
      async (tx) => {
        await tx.salesOrder.update({
          where: { id },
          data: {
            status,
            ...(status === SalesOrderStatus.CONFIRMED
              ? { confirmedAt: new Date(), confirmedByUserId: sess.userId }
              : {}),
          },
        })
        await recomputeSkuOrderedQuantities(
          tx.soItem,
          tx.sku,
          sess.companyId,
          skuIds,
        )
      },
      { timeout: 15000 },
    )

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "SalesOrder",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status },
      },
    })

    await revalidateForSkus(skuIds)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ステータス変更に失敗しました",
    }
  }
}

// =============================================================================
// 6. キャンセル（status = CANCELLED。物理削除も soft delete もしない）
// =============================================================================
export async function cancelSalesOrder(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.salesOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true, items: { select: { skuId: true } } },
    })
    if (!existing) return { ok: false, error: "受注が見つかりません" }

    const skuIds = existing.items.map((i) => i.skuId)

    await prisma.$transaction(
      async (tx) => {
        await tx.salesOrder.update({
          where: { id },
          data: { status: SalesOrderStatus.CANCELLED },
        })
        await recomputeSkuOrderedQuantities(
          tx.soItem,
          tx.sku,
          sess.companyId,
          skuIds,
        )
      },
      { timeout: 15000 },
    )

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "SalesOrder",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: SalesOrderStatus.CANCELLED },
      },
    })

    await revalidateForSkus(skuIds)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "受注のキャンセルに失敗しました",
    }
  }
}

// =============================================================================
// 7.（read-only）品番カルテの受注セクション用集約（R-11・入力はしない）
// =============================================================================
export type SalesOrderKarteSku = {
  skuId: string
  colorName: string
  size: string
  sizeOrder: number
  orderedQuantity: number
  moqStatus: SkuMoqStatus
}
export type SalesOrderKarteOrder = {
  id: string
  soNumber: string
  status: SalesOrderStatus
}
export type SalesOrderKarteSection = {
  skus: SalesOrderKarteSku[]
  orders: SalesOrderKarteOrder[]
}

export async function getSalesOrderSectionForProduct(
  productId: string,
): Promise<ActionResult<SalesOrderKarteSection>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const product = await prisma.product.findFirst({
      where: { id: productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!product) return { ok: false, error: "品番が見つかりません" }

    // 品番配下の SKU（Sku は TENANT: companyId/deletedAt 自動注入）。
    const skus = await prisma.sku.findMany({
      where: { productId },
      orderBy: [{ colorCode: "asc" }, { sizeOrder: "asc" }],
      select: {
        id: true,
        colorName: true,
        size: true,
        sizeOrder: true,
        orderedQuantity: true,
        moqStatus: true,
      },
    })
    const skuIds = skus.map((s) => s.id)

    // この品番の SKU を含む SO（キャンセル含む・生存のみ）へのリンク。
    let orders: SalesOrderKarteOrder[] = []
    if (skuIds.length > 0) {
      const items = await prisma.soItem.findMany({
        where: {
          skuId: { in: skuIds },
          so: { companyId: sess.companyId, deletedAt: null },
        },
        select: { so: { select: { id: true, soNumber: true, status: true } } },
      })
      const map = new Map<string, SalesOrderKarteOrder>()
      for (const it of items) {
        if (!map.has(it.so.id)) {
          map.set(it.so.id, {
            id: it.so.id,
            soNumber: it.so.soNumber,
            status: it.so.status,
          })
        }
      }
      orders = [...map.values()].sort((a, b) =>
        b.soNumber.localeCompare(a.soNumber),
      )
    }

    return {
      ok: true,
      data: {
        skus: skus.map((s) => ({
          skuId: s.id,
          colorName: s.colorName,
          size: s.size,
          sizeOrder: s.sizeOrder,
          orderedQuantity: s.orderedQuantity,
          moqStatus: s.moqStatus,
        })),
        orders,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "受注セクションの取得に失敗しました",
    }
  }
}
