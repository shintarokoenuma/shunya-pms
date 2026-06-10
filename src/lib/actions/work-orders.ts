"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  WorkOrderType,
  WorkOrderCategory,
  WorkOrderStatus,
  FactoryStatus,
  ContractorStatus,
  CostCategoryStatus,
  ProgressTaskType,
  type WorkOrder,
  type WoItem,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  workOrderInputSchema,
  workOrderListParamsSchema,
  type WorkOrderInput,
  type WorkOrderListParams,
} from "@/lib/validators/work-order"

/**
 * S-4b-2: 作業発注（WorkOrder / WoItem）Server Actions
 *
 * 設計方針（s-4b-order-creation-spec-confirmation v1.0 §4 / S-4b-1 PO の対構造）:
 * - WO は業務トランザクション。関数構成は list/get/create/update/soft-delete の5本 + 補助。
 * - 採番 WO-{年}-{4桁}（companyId×年・保存時 tx 確定）。
 *   ★リトライは Prisma P2002（unique 衝突）のみ。FK 違反等それ以外はそのまま伝播させ、
 *     「採番衝突」に偽装しない（PO 側の同修正は B-048）。
 * - 発注先は factoryId XOR contractorId。
 * - workType の決定: PROCESSING 起点はタスクの processingTypeId を引き継ぎ
 *   WO.workType = ProcessingType.workType をコピー（D2）。それ以外はフォーム値。
 * - workCategory はフォーム値（taskType から既定導出・変更可）。
 * - 起点（進行チェックリストのタスク）から progressTaskId / sampleProductionId を引き継ぐ。
 *   sampleProductionId があれば SampleProduction.productId を productId に導出。
 * - ヘッダ金額集計・JPY 換算・PDF・送付・承認は S-4c 送り。recomputeTaskStatus も呼ばない。
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
// 補助: フォーム select 用（工場 / 外注先 / 費目）
// =============================================================================
export type FactoryOption = { id: string; factoryCode: string; factoryName: string }
export type ContractorOption = {
  id: string
  contractorCode: string
  contractorName: string
}
export type CostCategoryOption = {
  id: string
  categoryCode: string
  categoryName: string
}

export async function listActiveFactoriesForWoSelect(): Promise<FactoryOption[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.factory.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: FactoryStatus.ACTIVE },
    select: { id: true, factoryCode: true, factoryName: true },
    orderBy: [{ factoryCode: "asc" }],
  })
}

export async function listActiveContractorsForWoSelect(): Promise<
  ContractorOption[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.contractor.findMany({
    where: {
      companyId: sess.companyId,
      deletedAt: null,
      status: ContractorStatus.ACTIVE,
    },
    select: { id: true, contractorCode: true, contractorName: true },
    orderBy: [{ contractorCode: "asc" }],
  })
}

export async function listActiveCostCategoriesForWoSelect(): Promise<
  CostCategoryOption[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.costCategory.findMany({
    where: {
      companyId: sess.companyId,
      deletedAt: null,
      status: CostCategoryStatus.ACTIVE,
    },
    select: { id: true, categoryCode: true, categoryName: true },
    orderBy: [{ level: "asc" }, { categoryCode: "asc" }],
  })
}

// =============================================================================
// 補助: 起点タスクから作成フォームの既定値を解決
// =============================================================================
export type WorkOrderCreateContext = {
  taskType: ProgressTaskType | null
  sampleProductionId: string | null
  processingTypeId: string | null
  processingTypeName: string | null
  suggestedWorkType: WorkOrderType
  suggestedWorkCategory: WorkOrderCategory
  /** 発注先の出し分け: 工場のみ / 外注のみ / 両方選択可 */
  orderToKind: "factory" | "contractor" | "either"
}

/** taskType → 既定の workType / workCategory / 発注先種別。 */
function defaultsForTaskType(taskType: ProgressTaskType | null): {
  workType: WorkOrderType
  workCategory: WorkOrderCategory
  orderToKind: "factory" | "contractor" | "either"
} {
  switch (taskType) {
    case ProgressTaskType.PATTERN:
      return {
        workType: WorkOrderType.PATTERN_MAKING,
        workCategory: WorkOrderCategory.PATTERN,
        orderToKind: "contractor",
      }
    case ProgressTaskType.SEWING:
      return {
        workType: WorkOrderType.SEWING,
        workCategory: WorkOrderCategory.SAMPLE,
        orderToKind: "factory",
      }
    case ProgressTaskType.GRADING:
      return {
        workType: WorkOrderType.GRADING,
        workCategory: WorkOrderCategory.GRADING,
        orderToKind: "contractor",
      }
    case ProgressTaskType.PROCESSING:
      return {
        workType: WorkOrderType.WASHING, // PROCESSING は下で ProcessingType.workType に上書き
        workCategory: WorkOrderCategory.SAMPLE,
        orderToKind: "either",
      }
    default:
      return {
        workType: WorkOrderType.OTHER,
        workCategory: WorkOrderCategory.SAMPLE,
        orderToKind: "either",
      }
  }
}

export async function getWorkOrderCreateContext(
  progressTaskId: string,
): Promise<ActionResult<WorkOrderCreateContext>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const task = await prisma.progressTask.findFirst({
      where: { id: progressTaskId, companyId: sess.companyId, deletedAt: null },
      select: {
        taskType: true,
        sampleProductionId: true,
        processingTypeId: true,
      },
    })
    if (!task) return { ok: false, error: "起点タスクが見つかりません" }

    const def = defaultsForTaskType(task.taskType)
    let suggestedWorkType = def.workType
    let processingTypeName: string | null = null

    // PROCESSING 起点: ProcessingType.workType を既定に採用（D2）
    if (
      task.taskType === ProgressTaskType.PROCESSING &&
      task.processingTypeId
    ) {
      const pt = await prisma.processingType.findFirst({
        where: { id: task.processingTypeId, companyId: sess.companyId },
        select: { name: true, workType: true },
      })
      if (pt) {
        suggestedWorkType = pt.workType
        processingTypeName = pt.name
      }
    }

    return {
      ok: true,
      data: {
        taskType: task.taskType,
        sampleProductionId: task.sampleProductionId,
        processingTypeId: task.processingTypeId,
        processingTypeName,
        suggestedWorkType,
        suggestedWorkCategory: def.workCategory,
        orderToKind: def.orderToKind,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "起点タスクの取得に失敗しました",
    }
  }
}

// =============================================================================
// manual join サマリ
// =============================================================================
async function fetchFactorySummaries(companyId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, FactoryOption>()
  const rows = await prisma.factory.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, factoryCode: true, factoryName: true },
  })
  return new Map(rows.map((r) => [r.id, r]))
}

async function fetchContractorSummaries(companyId: string, ids: string[]) {
  if (ids.length === 0) return new Map<string, ContractorOption>()
  const rows = await prisma.contractor.findMany({
    where: { id: { in: ids }, companyId },
    select: { id: true, contractorCode: true, contractorName: true },
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
// 採番（WO-{年}-{4桁}）
// =============================================================================
type WoNumberFinder = {
  findFirst: (args: {
    where: { companyId: string; woNumber: { startsWith: string } }
    orderBy: { woNumber: "desc" }
    select: { woNumber: true }
  }) => Promise<{ woNumber: string } | null>
}

function woNumberPrefix(year: number): string {
  return `WO-${year}-`
}

async function computeNextWoNumber(
  finder: WoNumberFinder,
  companyId: string,
  prefix: string,
): Promise<string> {
  const last = await finder.findFirst({
    where: { companyId, woNumber: { startsWith: prefix } },
    orderBy: { woNumber: "desc" },
    select: { woNumber: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.woNumber.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`
}

/** UI プレビュー専用：当年の次の WO 番号（保存時に再計算・確定）。 */
export async function generateNextWoNumberPreview(): Promise<
  ActionResult<{ preview: string }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const preview = await computeNextWoNumber(
      prisma.workOrder,
      sess.companyId,
      woNumberPrefix(new Date().getFullYear()),
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
type WoBaseRow = Pick<
  WorkOrder,
  | "id"
  | "woNumber"
  | "factoryId"
  | "contractorId"
  | "workType"
  | "workCategory"
  | "status"
  | "orderDate"
  | "currency"
  | "progressTaskId"
  | "samplProductionId"
  | "createdAt"
>

export type WorkOrderListItem = WoBaseRow & {
  factory: FactoryOption | null
  contractor: ContractorOption | null
}

export async function listWorkOrders(
  params: WorkOrderListParams = {} as WorkOrderListParams,
): Promise<
  ActionResult<{
    items: WorkOrderListItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const parsed = workOrderListParamsSchema.parse(params)

    const skip = (parsed.page - 1) * parsed.pageSize
    const q = parsed.q.trim()

    const where: Prisma.WorkOrderWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (parsed.status) where.status = parsed.status
    if (parsed.workType) where.workType = parsed.workType
    if (parsed.factoryId) where.factoryId = parsed.factoryId
    if (parsed.contractorId) where.contractorId = parsed.contractorId
    if (parsed.sampleProductionId)
      where.samplProductionId = parsed.sampleProductionId
    if (parsed.progressTaskId) where.progressTaskId = parsed.progressTaskId
    if (q.length > 0) {
      where.OR = [
        { woNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        select: {
          id: true,
          woNumber: true,
          factoryId: true,
          contractorId: true,
          workType: true,
          workCategory: true,
          status: true,
          orderDate: true,
          currency: true,
          progressTaskId: true,
          samplProductionId: true,
          createdAt: true,
        },
        orderBy: [{ woNumber: "desc" }],
        skip,
        take: parsed.pageSize,
      }),
      prisma.workOrder.count({ where }),
    ])

    const [factoryMap, contractorMap] = await Promise.all([
      fetchFactorySummaries(
        sess.companyId,
        [...new Set(rows.map((r) => r.factoryId).filter((v): v is string => !!v))],
      ),
      fetchContractorSummaries(
        sess.companyId,
        [
          ...new Set(
            rows.map((r) => r.contractorId).filter((v): v is string => !!v),
          ),
        ],
      ),
    ])

    const items: WorkOrderListItem[] = rows.map((r) => ({
      ...r,
      factory: r.factoryId ? factoryMap.get(r.factoryId) ?? null : null,
      contractor: r.contractorId
        ? contractorMap.get(r.contractorId) ?? null
        : null,
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

/** 進行チェックリスト：指定タスク群に紐づく WO を一括取得（タスク行下の列挙用・N+1 回避）。 */
export type WoForTask = {
  id: string
  woNumber: string
  status: WorkOrderStatus
  workType: WorkOrderType
  progressTaskId: string | null
  factory: FactoryOption | null
  contractor: ContractorOption | null
}

export async function listWorkOrdersByProgressTasks(
  progressTaskIds: string[],
): Promise<ActionResult<WoForTask[]>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const ids = [...new Set(progressTaskIds.filter(Boolean))]
    if (ids.length === 0) return { ok: true, data: [] }

    const rows = await prisma.workOrder.findMany({
      where: {
        companyId: sess.companyId,
        deletedAt: null,
        progressTaskId: { in: ids },
      },
      select: {
        id: true,
        woNumber: true,
        status: true,
        workType: true,
        progressTaskId: true,
        factoryId: true,
        contractorId: true,
      },
      orderBy: [{ woNumber: "asc" }],
    })
    const [factoryMap, contractorMap] = await Promise.all([
      fetchFactorySummaries(
        sess.companyId,
        [...new Set(rows.map((r) => r.factoryId).filter((v): v is string => !!v))],
      ),
      fetchContractorSummaries(
        sess.companyId,
        [
          ...new Set(
            rows.map((r) => r.contractorId).filter((v): v is string => !!v),
          ),
        ],
      ),
    ])
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        woNumber: r.woNumber,
        status: r.status,
        workType: r.workType,
        progressTaskId: r.progressTaskId,
        factory: r.factoryId ? factoryMap.get(r.factoryId) ?? null : null,
        contractor: r.contractorId
          ? contractorMap.get(r.contractorId) ?? null
          : null,
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
// 2. 詳細
// =============================================================================
export type WorkOrderDetail = WorkOrder & {
  factory: FactoryOption | null
  contractor: ContractorOption | null
  items: (WoItem & { costCategory: CostCategoryOption | null })[]
}

export async function getWorkOrder(
  id: string,
): Promise<{ ok: true; data: WorkOrderDetail } | { ok: false; error: string }> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const wo = await prisma.workOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!wo) return { ok: false, error: "作業発注が見つかりません" }

    const items = await prisma.woItem.findMany({
      where: { woId: id },
      orderBy: { itemOrder: "asc" },
    })

    const [factoryMap, contractorMap, ccMap] = await Promise.all([
      fetchFactorySummaries(sess.companyId, wo.factoryId ? [wo.factoryId] : []),
      fetchContractorSummaries(
        sess.companyId,
        wo.contractorId ? [wo.contractorId] : [],
      ),
      fetchCostCategorySummaries(
        sess.companyId,
        [
          ...new Set(
            items.map((i) => i.costCategoryId).filter((v): v is string => !!v),
          ),
        ],
      ),
    ])

    return {
      ok: true,
      data: {
        ...wo,
        factory: wo.factoryId ? factoryMap.get(wo.factoryId) ?? null : null,
        contractor: wo.contractorId
          ? contractorMap.get(wo.contractorId) ?? null
          : null,
        items: items.map((i) => ({
          ...i,
          costCategory: i.costCategoryId
            ? ccMap.get(i.costCategoryId) ?? null
            : null,
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
// 共通: 明細データ整形（単価未定なら unitPrice=null・subtotal=null。
//        単価があれば subtotal=quantity×unitPrice）
// =============================================================================
function buildItemRows(
  data: WorkOrderInput,
): Omit<Prisma.WoItemCreateManyInput, "woId">[] {
  return data.items.map((it, i) => {
    const hasPrice = it.unitPrice !== null && it.unitPrice !== undefined
    return {
      itemOrder: i,
      workDescription: it.workDescription,
      colorCode: it.colorCode || null,
      size: it.size || null,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: hasPrice ? new Prisma.Decimal(Number(it.unitPrice)) : null,
      subtotal: hasPrice
        ? new Prisma.Decimal(Number(it.quantity) * Number(it.unitPrice))
        : null,
      costCategoryId: it.costCategoryId,
      billingClassification: it.billingClassification,
      notes: it.notes || null,
    }
  })
}

/**
 * 発注先（factory XOR contractor）の存在確認と、起点タスクからの
 * workType / processingTypeId 解決を行う。
 */
async function resolveOrderTargets(
  companyId: string,
  data: WorkOrderInput,
): Promise<
  | { ok: true; workType: WorkOrderType; processingTypeId: string | null; productId: string | null }
  | { ok: false; error: string }
> {
  // 発注先存在チェック（FK 違反を tx 前に弾く）
  if (data.factoryId) {
    const f = await prisma.factory.findFirst({
      where: { id: data.factoryId, companyId, deletedAt: null },
      select: { id: true },
    })
    if (!f) return { ok: false, error: "指定された工場が見つかりません" }
  }
  if (data.contractorId) {
    const c = await prisma.contractor.findFirst({
      where: { id: data.contractorId, companyId, deletedAt: null },
      select: { id: true },
    })
    if (!c) return { ok: false, error: "指定された外注先が見つかりません" }
  }

  let workType = data.workType
  let processingTypeId = data.processingTypeId ?? null
  let productId: string | null = null

  // 起点タスクの解決（PROCESSING の workType 上書き・品番導出）
  if (data.progressTaskId) {
    const task = await prisma.progressTask.findFirst({
      where: { id: data.progressTaskId, companyId, deletedAt: null },
      select: { taskType: true, processingTypeId: true },
    })
    if (
      task?.taskType === ProgressTaskType.PROCESSING &&
      task.processingTypeId
    ) {
      processingTypeId = task.processingTypeId
      const pt = await prisma.processingType.findFirst({
        where: { id: task.processingTypeId, companyId },
        select: { workType: true },
      })
      if (pt) workType = pt.workType // D2: ProcessingType.workType をコピー
    }
  }

  if (data.sampleProductionId) {
    const sp = await prisma.sampleProduction.findFirst({
      where: { id: data.sampleProductionId, companyId, deletedAt: null },
      select: { productId: true },
    })
    productId = sp?.productId ?? null
  }

  return { ok: true, workType, processingTypeId, productId }
}

// =============================================================================
// 3. 新規（採番 + WO + WoItem 群を同一 tx）
// =============================================================================
const CREATE_MAX_RETRIES = 3

export async function createWorkOrder(
  input: WorkOrderInput,
): Promise<ActionResult<{ id: string; woNumber: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = workOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const resolved = await resolveOrderTargets(sess.companyId, data)
    if (!resolved.ok) return resolved

    const deliveryDate = data.expectedDeliveryDate
      ? new Date(data.expectedDeliveryDate)
      : null
    const itemRows = buildItemRows(data)
    const prefix = woNumberPrefix(new Date().getFullYear())

    let created: { id: string; woNumber: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx) => {
            const woNumber = await computeNextWoNumber(
              tx.workOrder,
              sess.companyId,
              prefix,
            )
            const wo = await tx.workOrder.create({
              data: {
                companyId: sess.companyId,
                woNumber,
                factoryId: data.factoryId,
                contractorId: data.contractorId,
                productId: resolved.productId,
                progressTaskId: data.progressTaskId,
                processingTypeId: resolved.processingTypeId,
                samplProductionId: data.sampleProductionId, // 綴りミスは温存(B-035)
                workType: resolved.workType,
                workCategory: data.workCategory,
                title: data.title || null,
                description: data.description || null,
                currency: data.currency,
                expectedDeliveryDate: deliveryDate,
                status: WorkOrderStatus.DRAFT,
                createdByUserId: sess.userId,
              },
              select: { id: true, woNumber: true },
            })
            await tx.woItem.createMany({
              data: itemRows.map((r) => ({ ...r, woId: wo.id })),
            })
            return wo
            // 遅延 DB での部分コミット孤児を防ぐ安全マージン（既定5秒→15秒）
          },
          { timeout: 15000 },
        )
        break
      } catch (e) {
        lastError = e
        // ★unique 衝突(P2002)のみリトライ。それ以外（FK 違反 P2003 等）は
        //   採番衝突に偽装せず即伝播させる。
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
        entityType: "WorkOrder",
        entityId: created.id,
        afterData: {
          woNumber: created.woNumber,
          factoryId: data.factoryId,
          contractorId: data.contractorId,
          workType: resolved.workType,
          workCategory: data.workCategory,
          processingTypeId: resolved.processingTypeId,
          progressTaskId: data.progressTaskId,
          sampleProductionId: data.sampleProductionId,
          itemCount: itemRows.length,
          status: WorkOrderStatus.DRAFT,
        },
      },
    })

    revalidatePath("/work-orders")
    if (data.sampleProductionId)
      revalidatePath(`/samples/${data.sampleProductionId}`)
    return { ok: true, data: { id: created.id, woNumber: created.woNumber } }
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
type WoAuditField = Exclude<
  keyof typeof Prisma.WorkOrderScalarFieldEnum,
  "id" | "companyId" | "createdAt" | "updatedAt" | "deletedAt"
>

function woSnapshot(r: WorkOrder): Record<WoAuditField, unknown> {
  return {
    woNumber: r.woNumber,
    factoryId: r.factoryId,
    contractorId: r.contractorId,
    productId: r.productId,
    modelCodeId: r.modelCodeId,
    progressTaskId: r.progressTaskId,
    processingTypeId: r.processingTypeId,
    workType: r.workType,
    workCategory: r.workCategory,
    title: r.title,
    description: r.description,
    currency: r.currency,
    exchangeRateAtOrder: r.exchangeRateAtOrder,
    subtotal: r.subtotal,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
    totalAmountJpy: r.totalAmountJpy,
    totalQuantity: r.totalQuantity,
    isCmtContract: r.isCmtContract,
    cmtMaterialNotes: r.cmtMaterialNotes,
    specificationVersion: r.specificationVersion,
    patternVersionId: r.patternVersionId,
    samplProductionId: r.samplProductionId,
    sampleRound: r.sampleRound,
    paymentTermType: r.paymentTermType,
    paymentDueDate: r.paymentDueDate,
    isInternational: r.isInternational,
    expectedDeliveryDate: r.expectedDeliveryDate,
    actualDeliveryDate: r.actualDeliveryDate,
    isDeliveryDelayed: r.isDeliveryDelayed,
    deliveryAddress: r.deliveryAddress,
    hasTradeDocuments: r.hasTradeDocuments,
    outputLanguage: r.outputLanguage,
    templateId: r.templateId,
    woPdfUrl: r.woPdfUrl,
    woPdfGeneratedAt: r.woPdfGeneratedAt,
    status: r.status,
    sentAt: r.sentAt,
    sentMethod: r.sentMethod,
    sentByUserId: r.sentByUserId,
    approvedAt: r.approvedAt,
    approvedByUserId: r.approvedByUserId,
    acknowledgedAt: r.acknowledgedAt,
    acknowledgmentNotes: r.acknowledgmentNotes,
    productionStartedAt: r.productionStartedAt,
    productionCompletedAt: r.productionCompletedAt,
    completedQuantity: r.completedQuantity,
    defectQuantity: r.defectQuantity,
    royaltyAmount: r.royaltyAmount,
    royaltyPaidAt: r.royaltyPaidAt,
    lastStatusCheckAt: r.lastStatusCheckAt,
    createdByUserId: r.createdByUserId,
    assignedToUserId: r.assignedToUserId,
    internalNotes: r.internalNotes,
    factoryNotes: r.factoryNotes,
    orderDate: r.orderDate,
  } satisfies Record<WoAuditField, unknown>
}

export async function updateWorkOrder(
  id: string,
  input: WorkOrderInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = workOrderInputSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.workOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) return { ok: false, error: "作業発注が見つかりません" }

    const resolved = await resolveOrderTargets(sess.companyId, data)
    if (!resolved.ok) return resolved

    const deliveryDate = data.expectedDeliveryDate
      ? new Date(data.expectedDeliveryDate)
      : null
    const itemRows = buildItemRows(data)

    const updated = await prisma.$transaction(
      async (tx) => {
        const row = await tx.workOrder.update({
          where: { id },
          data: {
            factoryId: data.factoryId,
            contractorId: data.contractorId,
            productId: resolved.productId,
            processingTypeId: resolved.processingTypeId,
            workType: resolved.workType,
            workCategory: data.workCategory,
            title: data.title || null,
            description: data.description || null,
            currency: data.currency,
            expectedDeliveryDate: deliveryDate,
            progressTaskId: data.progressTaskId,
            samplProductionId: data.sampleProductionId,
          },
        })
        // 明細は全削除→再作成（WoItem は deletedAt を持たず WO 従属）
        await tx.woItem.deleteMany({ where: { woId: id } })
        await tx.woItem.createMany({
          data: itemRows.map((r) => ({ ...r, woId: id })),
        })
        return row
      },
      { timeout: 15000 },
    )

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "WorkOrder",
        entityId: id,
        beforeData: woSnapshot(existing),
        afterData: woSnapshot(updated),
      },
    })

    revalidatePath("/work-orders")
    revalidatePath(`/work-orders/${id}`)
    if (updated.samplProductionId)
      revalidatePath(`/samples/${updated.samplProductionId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. soft-delete
// =============================================================================
export async function deleteWorkOrder(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.workOrder.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, woNumber: true, samplProductionId: true },
    })
    if (!existing) return { ok: false, error: "作業発注が見つかりません" }

    await prisma.workOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "WorkOrder",
        entityId: id,
        beforeData: { woNumber: existing.woNumber, softDelete: true },
      },
    })

    revalidatePath("/work-orders")
    if (existing.samplProductionId)
      revalidatePath(`/samples/${existing.samplProductionId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "削除に失敗しました",
    }
  }
}
