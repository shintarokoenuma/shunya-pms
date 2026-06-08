"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  PurchaseOrderType,
  AllocationType,
  PurchaseOrderStatus,
  SupplierStatus,
  CostCategoryStatus,
  MaterialStatus,
  type PurchaseOrder,
  type PoItem,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  purchaseOrderInputSchema,
  purchaseOrderListParamsSchema,
  type PurchaseOrderInput,
  type PurchaseOrderListParams,
} from "@/lib/validators/purchase-order"

/**
 * S-4b-1: 仕入先発注（PurchaseOrder / PoItem）Server Actions
 *
 * 設計方針（s-4b-order-creation-spec-confirmation v1.0 §3）:
 * - PO は業務トランザクション（master-patterns 非適用）。関数構成は list/get/create/update/soft-delete の5本。
 * - 採番 PO-{年}-{4桁}（companyId×年・保存時 tx 確定・P2002 リトライ）。SP 採番を precedent に。
 * - poType=STANDARD / allocationType=DIRECT 固定。PoItem.subtotal=quantity×unitPrice を計算保存。
 * - 起点（進行チェックリスト FABRIC/TRIM/BODY タスク）から progressTaskId / sampleProductionId を引き継ぐ。
 *   sampleProductionId があれば SampleProduction.productId を primaryProductId に導出。
 * - ヘッダ金額集計（subtotal/totalAmount 等）は S-4c 送り（null のまま）。配分(SHARED/STOCK)も後続。
 * - house style: @relation traversal/include 不使用・明示クエリ + in 句一括結合。
 */

// =============================================================================
// 戻り値の型
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
    tenantType: session.user.tenantType,
  }
}

// =============================================================================
// 補助: フォーム select 用（発注先 / 費目 / 素材）
// =============================================================================
export type SupplierOption = { id: string; supplierCode: string; companyName: string }
export type CostCategoryOption = { id: string; categoryCode: string; categoryName: string }
export type MaterialOption = {
  id: string
  materialCode: string
  materialName: string
  unit: string
}

export async function listActiveSuppliersForPoSelect(): Promise<SupplierOption[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.supplier.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: SupplierStatus.ACTIVE },
    select: { id: true, supplierCode: true, companyName: true },
    orderBy: [{ supplierCode: "asc" }],
  })
}

export async function listActiveCostCategoriesForPoSelect(): Promise<
  CostCategoryOption[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.costCategory.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: CostCategoryStatus.ACTIVE },
    select: { id: true, categoryCode: true, categoryName: true },
    orderBy: [{ level: "asc" }, { categoryCode: "asc" }],
  })
}

export async function listActiveMaterialsForPoSelect(): Promise<MaterialOption[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.material.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: MaterialStatus.ACTIVE },
    select: { id: true, materialCode: true, materialName: true, unit: true },
    orderBy: [{ materialCode: "asc" }],
  })
}

// =============================================================================
// manual join サマリ
// =============================================================================
async function fetchSupplierSummaries(companyId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, SupplierOption>()
  const rows = await prisma.supplier.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, supplierCode: true, companyName: true },
  })
  return new Map(rows.map((r) => [r.id, r]))
}

async function fetchCostCategorySummaries(companyId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, CostCategoryOption>()
  const rows = await prisma.costCategory.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, categoryCode: true, categoryName: true },
  })
  return new Map(rows.map((r) => [r.id, r]))
}

// =============================================================================
// 採番（PO-{年}-{4桁}）
// =============================================================================
type PoNumberFinder = {
  findFirst: (args: {
    where: { companyId: string; poNumber: { startsWith: string } }
    orderBy: { poNumber: "desc" }
    select: { poNumber: true }
  }) => Promise<{ poNumber: string } | null>
}

function poNumberPrefix(year: number): string {
  return `PO-${year}-`
}

async function computeNextPoNumber(
  finder: PoNumberFinder,
  companyId: string,
  prefix: string,
): Promise<string> {
  const last = await finder.findFirst({
    where: { companyId, poNumber: { startsWith: prefix } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.poNumber.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`
}

/** UI プレビュー専用：当年の次の PO 番号（保存時に再計算・確定）。 */
export async function generateNextPoNumberPreview(): Promise<
  ActionResult<{ preview: string }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const preview = await computeNextPoNumber(
      prisma.purchaseOrder,
      sess.companyId,
      poNumberPrefix(new Date().getFullYear()),
    )
    return { ok: true, data: { preview } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "採番プレビューに失敗しました",
    }
  }
}

// =============================================================================
// 1. 一覧
// =============================================================================
type PoBaseRow = Pick<
  PurchaseOrder,
  | "id"
  | "poNumber"
  | "supplierId"
  | "status"
  | "orderDate"
  | "currency"
  | "progressTaskId"
  | "sampleProductionId"
  | "createdAt"
>

export type PurchaseOrderListItem = PoBaseRow & {
  supplier: SupplierOption | null
}

export async function listPurchaseOrders(
  params: PurchaseOrderListParams = {} as PurchaseOrderListParams,
): Promise<
  ActionResult<{
    items: PurchaseOrderListItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const parsed = purchaseOrderListParamsSchema.parse(params)

    const skip = (parsed.page - 1) * parsed.pageSize
    const q = parsed.q.trim()

    const where: Prisma.PurchaseOrderWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (parsed.status) where.status = parsed.status
    if (parsed.supplierId) where.supplierId = parsed.supplierId
    if (parsed.sampleProductionId)
      where.sampleProductionId = parsed.sampleProductionId
    if (parsed.progressTaskId) where.progressTaskId = parsed.progressTaskId
    if (q.length > 0) {
      where.OR = [
        { poNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        select: {
          id: true,
          poNumber: true,
          supplierId: true,
          status: true,
          orderDate: true,
          currency: true,
          progressTaskId: true,
          sampleProductionId: true,
          createdAt: true,
        },
        orderBy: [{ poNumber: "desc" }],
        skip,
        take: parsed.pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    const supplierMap = await fetchSupplierSummaries(
      sess.companyId,
      [...new Set(rows.map((r) => r.supplierId))],
    )

    const items: PurchaseOrderListItem[] = rows.map((r) => ({
      ...r,
      supplier: supplierMap.get(r.supplierId) ?? null,
    }))

    return {
      ok: true,
      data: {
        items,
        total,
        page: parsed.page,
        pageSize: parsed.pageSize,
        totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)),
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "一覧取得に失敗しました",
    }
  }
}

/** 進行チェックリスト：指定タスク群に紐づく PO を一括取得（タスク行下の列挙用・N+1 回避）。 */
export type PoForTask = {
  id: string
  poNumber: string
  status: PurchaseOrderStatus
  progressTaskId: string | null
  supplier: SupplierOption | null
}

export async function listPurchaseOrdersByProgressTasks(
  progressTaskIds: string[],
): Promise<ActionResult<PoForTask[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const ids = [...new Set(progressTaskIds.filter(Boolean))]
    if (ids.length === 0) return { ok: true, data: [] }

    const rows = await prisma.purchaseOrder.findMany({
      where: {
        companyId: sess.companyId,
        deletedAt: null,
        progressTaskId: { in: ids },
      },
      select: {
        id: true,
        poNumber: true,
        status: true,
        progressTaskId: true,
        supplierId: true,
      },
      orderBy: [{ poNumber: "asc" }],
    })
    const supplierMap = await fetchSupplierSummaries(
      sess.companyId,
      [...new Set(rows.map((r) => r.supplierId))],
    )
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        poNumber: r.poNumber,
        status: r.status,
        progressTaskId: r.progressTaskId,
        supplier: supplierMap.get(r.supplierId) ?? null,
      })),
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "紐付き発注の取得に失敗しました",
    }
  }
}

// =============================================================================
// 2. 詳細（PoItem + supplier + costCategory 名を明示クエリで付与）
// =============================================================================
export type PurchaseOrderDetail = PurchaseOrder & {
  supplier: SupplierOption | null
  items: (PoItem & { costCategory: CostCategoryOption | null })[]
}

export async function getPurchaseOrder(
  id: string,
): Promise<{ ok: true; data: PurchaseOrderDetail } | { ok: false; error: string }> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!po) return { ok: false, error: "発注が見つかりません" }

    const items = await prisma.poItem.findMany({
      where: { poId: id },
      orderBy: { itemOrder: "asc" },
    })

    const [supplierMap, ccMap] = await Promise.all([
      fetchSupplierSummaries(sess.companyId, [po.supplierId]),
      fetchCostCategorySummaries(
        sess.companyId,
        [...new Set(items.map((i) => i.costCategoryId).filter((v): v is string => !!v))],
      ),
    ])

    return {
      ok: true,
      data: {
        ...po,
        supplier: supplierMap.get(po.supplierId) ?? null,
        items: items.map((i) => ({
          ...i,
          costCategory: i.costCategoryId ? ccMap.get(i.costCategoryId) ?? null : null,
        })),
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "詳細取得に失敗しました",
    }
  }
}

// =============================================================================
// 共通: 明細データ整形（v1.1: 単価未定なら unitPrice=null・subtotal=null。
//        単価があれば subtotal=quantity×unitPrice）
// =============================================================================
function buildItemRows(
  data: PurchaseOrderInput,
): Omit<Prisma.PoItemCreateManyInput, "poId">[] {
  return data.items.map((it, i) => {
    const hasPrice = it.unitPrice !== null && it.unitPrice !== undefined
    return {
      itemOrder: i,
      materialId: it.materialId,
      customItemName: it.materialId ? null : it.customItemName || null,
      description: it.description || null,
      supplierItemCode: it.supplierItemCode || null,
      designCode: it.designCode || null,
      sizeValue:
        it.sizeValue !== null && it.sizeValue !== undefined
          ? new Prisma.Decimal(Number(it.sizeValue))
          : null,
      sizeUnit: it.sizeUnit || null,
      colorCode: it.colorCode || null,
      specification: it.specification || null,
      notes: it.notes || null,
      quantity: new Prisma.Decimal(it.quantity),
      unit: it.unit,
      unitPrice: hasPrice ? new Prisma.Decimal(Number(it.unitPrice)) : null,
      subtotal: hasPrice
        ? new Prisma.Decimal(Number(it.quantity) * Number(it.unitPrice))
        : null,
      costCategoryId: it.costCategoryId,
      billingClassification: it.billingClassification,
      isPhysicalAsset: it.isPhysicalAsset,
      assetStorageStartDate: it.assetStorageStartDate
        ? new Date(it.assetStorageStartDate)
        : null,
      assetStorageExpiryDate: it.assetStorageExpiryDate
        ? new Date(it.assetStorageExpiryDate)
        : null,
    }
  })
}

// =============================================================================
// 3. 新規（採番 + PO + PoItem 群を同一 tx）
// =============================================================================
const CREATE_MAX_RETRIES = 3

export async function createPurchaseOrder(
  input: PurchaseOrderInput,
): Promise<ActionResult<{ id: string; poNumber: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = purchaseOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const supplier = await prisma.supplier.findFirst({
      where: { id: data.supplierId, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!supplier) return { ok: false, error: "指定された発注先が見つかりません" }

    // 起点ラウンドから品番を導出（任意）
    let primaryProductId: string | null = null
    if (data.sampleProductionId) {
      const sp = await prisma.sampleProduction.findFirst({
        where: {
          id: data.sampleProductionId,
          companyId: sess.companyId,
          deletedAt: null,
        },
        select: { productId: true },
      })
      primaryProductId = sp?.productId ?? null
    }

    const deliveryDate = data.expectedDeliveryDate
      ? new Date(data.expectedDeliveryDate)
      : null
    const itemRows = buildItemRows(data)
    const prefix = poNumberPrefix(new Date().getFullYear())

    let created: { id: string; poNumber: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const poNumber = await computeNextPoNumber(
            tx.purchaseOrder,
            sess.companyId,
            prefix,
          )
          const po = await tx.purchaseOrder.create({
            data: {
              companyId: sess.companyId,
              poNumber,
              supplierId: data.supplierId,
              primaryProductId,
              progressTaskId: data.progressTaskId,
              sampleProductionId: data.sampleProductionId,
              poType: PurchaseOrderType.STANDARD, // S-4b-1 固定
              allocationType: AllocationType.DIRECT, // S-4b-1 固定
              title: data.title || null,
              description: data.description || null,
              currency: data.currency,
              expectedDeliveryDate: deliveryDate,
              status: PurchaseOrderStatus.DRAFT,
              createdByUserId: sess.userId,
            },
            select: { id: true, poNumber: true },
          })
          await tx.poItem.createMany({
            data: itemRows.map((r) => ({ ...r, poId: po.id })),
          })
          return po
          // 遅延 DB での部分コミット孤児を防ぐ安全マージン（既定5秒→15秒）
        }, { timeout: 15000 })
        break
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue // poNumber unique 衝突：再試行
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
        entityType: "PurchaseOrder",
        entityId: created.id,
        afterData: {
          poNumber: created.poNumber,
          supplierId: data.supplierId,
          progressTaskId: data.progressTaskId,
          sampleProductionId: data.sampleProductionId,
          itemCount: itemRows.length,
          status: PurchaseOrderStatus.DRAFT,
        },
      },
    })

    revalidatePath("/purchase-orders")
    if (data.sampleProductionId) revalidatePath(`/samples/${data.sampleProductionId}`)
    return { ok: true, data: { id: created.id, poNumber: created.poNumber } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新（ヘッダ + 明細差し替え。明細は全削除→再作成）
// =============================================================================
type PoAuditField = Exclude<
  keyof typeof Prisma.PurchaseOrderScalarFieldEnum,
  "id" | "companyId" | "createdAt" | "updatedAt" | "deletedAt"
>

function poSnapshot(r: PurchaseOrder): Record<PoAuditField, unknown> {
  return {
    poNumber: r.poNumber,
    supplierId: r.supplierId,
    primaryProductId: r.primaryProductId,
    progressTaskId: r.progressTaskId,
    sampleProductionId: r.sampleProductionId,
    poType: r.poType,
    allocationType: r.allocationType,
    emailSubject: r.emailSubject,
    title: r.title,
    description: r.description,
    currency: r.currency,
    exchangeRateAtOrder: r.exchangeRateAtOrder,
    subtotal: r.subtotal,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
    totalAmountJpy: r.totalAmountJpy,
    paymentTermType: r.paymentTermType,
    paymentDueDate: r.paymentDueDate,
    isInternational: r.isInternational,
    bankFeeAmount: r.bankFeeAmount,
    bankFeeCurrency: r.bankFeeCurrency,
    expectedDeliveryDate: r.expectedDeliveryDate,
    actualDeliveryDate: r.actualDeliveryDate,
    isDeliveryDelayed: r.isDeliveryDelayed,
    deliveryAddress: r.deliveryAddress,
    deliveryNotes: r.deliveryNotes,
    hasTradeDocuments: r.hasTradeDocuments,
    outputLanguage: r.outputLanguage,
    templateId: r.templateId,
    poPdfUrl: r.poPdfUrl,
    poPdfGeneratedAt: r.poPdfGeneratedAt,
    status: r.status,
    sentAt: r.sentAt,
    sentMethod: r.sentMethod,
    sentTo: r.sentTo,
    sentByUserId: r.sentByUserId,
    approvedAt: r.approvedAt,
    approvedByUserId: r.approvedByUserId,
    acknowledgedAt: r.acknowledgedAt,
    acknowledgmentNotes: r.acknowledgmentNotes,
    receivedAt: r.receivedAt,
    receivedByUserId: r.receivedByUserId,
    receivedQualityCheck: r.receivedQualityCheck,
    lastStatusCheckAt: r.lastStatusCheckAt,
    createdByUserId: r.createdByUserId,
    assignedToUserId: r.assignedToUserId,
    internalNotes: r.internalNotes,
    supplierNotes: r.supplierNotes,
    orderDate: r.orderDate,
  } satisfies Record<PoAuditField, unknown>
}

export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = purchaseOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) return { ok: false, error: "発注が見つかりません" }

    if (existing.supplierId !== data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, companyId: sess.companyId, deletedAt: null },
        select: { id: true },
      })
      if (!supplier) return { ok: false, error: "指定された発注先が見つかりません" }
    }

    const deliveryDate = data.expectedDeliveryDate
      ? new Date(data.expectedDeliveryDate)
      : null
    const itemRows = buildItemRows(data)

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: data.supplierId,
          title: data.title || null,
          description: data.description || null,
          currency: data.currency,
          expectedDeliveryDate: deliveryDate,
          progressTaskId: data.progressTaskId,
          sampleProductionId: data.sampleProductionId,
        },
      })
      // 明細は全削除→再作成（PoItem は deletedAt を持たず PO 従属）
      await tx.poItem.deleteMany({ where: { poId: id } })
      await tx.poItem.createMany({
        data: itemRows.map((r) => ({ ...r, poId: id })),
      })
      return row
      // 遅延 DB での部分コミット孤児を防ぐ安全マージン（既定5秒→15秒）
    }, { timeout: 15000 })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "PurchaseOrder",
        entityId: id,
        beforeData: poSnapshot(existing),
        afterData: poSnapshot(updated),
      },
    })

    revalidatePath("/purchase-orders")
    revalidatePath(`/purchase-orders/${id}`)
    if (updated.sampleProductionId)
      revalidatePath(`/samples/${updated.sampleProductionId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. soft-delete（deletedAt セット。物理削除は S-4b-1 では作らない）
// =============================================================================
export async function deletePurchaseOrder(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, poNumber: true, sampleProductionId: true },
    })
    if (!existing) return { ok: false, error: "発注が見つかりません" }

    await prisma.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "PurchaseOrder",
        entityId: id,
        beforeData: { poNumber: existing.poNumber, softDelete: true },
      },
    })

    revalidatePath("/purchase-orders")
    if (existing.sampleProductionId)
      revalidatePath(`/samples/${existing.sampleProductionId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "削除に失敗しました",
    }
  }
}
