"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  SampleProductionStatus,
  SampleRound,
  type SampleProduction,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  sampleProductionBaseSchema,
  changeSampleStatusSchema,
  type SampleProductionInput,
} from "@/lib/validators/sample-production"

/**
 * S-2: サンプル製作セット（SampleProduction）Server Actions
 *
 * 設計方針（仕様議事録 v1.0 2026-06-06 §5 / S-1 products を precedent）:
 * - SP番号採番：`SP-{西暦4桁}-{連番4桁}`（西暦＝作成時点の年。連番は companyId×西暦ごとに 0001 から）。
 *   保存時に transaction 内で確定し、衝突時はリトライ。UI はプレビューのみ。
 * - ラウンド系譜：parentSampleId 有無で分岐。親があれば roundOrder=親+1・sampleRound を自動マッピング。
 *   同じ productId を親から引き継ぐ。
 * - schema に `product` / parentSampleId の self-relation 宣言が無いため、Product も親子も **明示クエリ**
 *   （include 不使用・一覧は in 句で一括結合して N+1 回避）。
 * - status 遷移は changeSampleStatus（from/to を AuditLog に記録。専用履歴テーブルは無い）。
 * - archive は ARCHIVED status が無いため **deletedAt soft-delete** で表現。
 * - update の AuditLog snapshot は B-015/S-1 と同様に業務スカラ全件を載せ、型保険で網羅をコンパイル時強制。
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type SampleProductionUsage = {
  childSampleCount: number
  revisionCount: number
  totalRefs: number
}

// =============================================================================
// 認証ヘルパー
// =============================================================================
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
// Product manual join（schema に product リレーション宣言が無いため）
// =============================================================================
export type ProductSummary = {
  id: string
  productCode: string
  clientProductCode: string | null
  productName: string
  brandId: string
  season: string
}

async function fetchProductSummariesByIds(
  companyId: string,
  productIds: string[],
): Promise<Map<string, ProductSummary>> {
  if (productIds.length === 0) return new Map()
  const rows = await prisma.product.findMany({
    where: { id: { in: productIds }, companyId },
    select: {
      id: true,
      productCode: true,
      clientProductCode: true,
      productName: true,
      brandId: true,
      season: true,
    },
  })
  return new Map(rows.map((r) => [r.id, r satisfies ProductSummary]))
}

// =============================================================================
// ラウンドマッピング
// =============================================================================
function roundForOrder(order: number): SampleRound {
  if (order <= 1) return SampleRound.FIRST
  if (order === 2) return SampleRound.SECOND
  if (order === 3) return SampleRound.THIRD
  return SampleRound.ADDITIONAL
}

// =============================================================================
// SP番号採番
// =============================================================================
type SampleNumberFinder = {
  findFirst: (args: {
    where: { companyId: string; sampleNumber: { startsWith: string } }
    orderBy: { sampleNumber: "desc" }
    select: { sampleNumber: true }
  }) => Promise<{ sampleNumber: string } | null>
}

function sampleNumberPrefix(year: number): string {
  return `SP-${year}-`
}

async function computeNextSampleNumber(
  finder: SampleNumberFinder,
  companyId: string,
  prefix: string,
): Promise<string> {
  const last = await finder.findFirst({
    where: { companyId, sampleNumber: { startsWith: prefix } },
    orderBy: { sampleNumber: "desc" },
    select: { sampleNumber: true },
  })
  let nextNum = 1
  if (last) {
    const match = last.sampleNumber.match(/-(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`
}

/** UI のプレビュー専用：当年の次の SP 番号を返す（保存時に再計算・確定）。 */
export async function generateNextSampleNumberPreview(): Promise<
  ActionResult<{ preview: string }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess
    const year = new Date().getFullYear()
    const preview = await computeNextSampleNumber(
      prisma.sampleProduction,
      sess.companyId,
      sampleNumberPrefix(year),
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
// 1. 一覧取得
// =============================================================================
export type ListSampleProductionsParams = {
  q?: string
  productId?: string
  status?: SampleProductionStatus
  sampleRound?: SampleRound
  assignedToUserId?: string
  page?: number
  pageSize?: number
}

type SampleBaseRow = Pick<
  SampleProduction,
  | "id"
  | "sampleNumber"
  | "productId"
  | "sampleRound"
  | "roundOrder"
  | "parentSampleId"
  | "title"
  | "status"
  | "sampleQuantity"
  | "assignedToUserId"
  | "createdAt"
  | "updatedAt"
>

export type SampleProductionListItem = SampleBaseRow & {
  product: ProductSummary | null
}

export async function listSampleProductions(
  params: ListSampleProductionsParams = {},
): Promise<
  ActionResult<{
    items: SampleProductionListItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    const skip = (page - 1) * pageSize
    const q = (params.q ?? "").trim()

    const where: Prisma.SampleProductionWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (params.productId) where.productId = params.productId
    if (params.status) where.status = params.status
    if (params.sampleRound) where.sampleRound = params.sampleRound
    if (params.assignedToUserId) where.assignedToUserId = params.assignedToUserId
    if (q.length > 0) {
      where.OR = [
        { sampleNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.sampleProduction.findMany({
        where,
        select: {
          id: true,
          sampleNumber: true,
          productId: true,
          sampleRound: true,
          roundOrder: true,
          parentSampleId: true,
          title: true,
          status: true,
          sampleQuantity: true,
          assignedToUserId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ sampleNumber: "desc" }],
        skip,
        take: pageSize,
      }),
      prisma.sampleProduction.count({ where }),
    ])

    const productMap = await fetchProductSummariesByIds(
      sess.companyId,
      [...new Set(rows.map((r) => r.productId))],
    )

    const items: SampleProductionListItem[] = rows.map((r) => ({
      ...r,
      product: productMap.get(r.productId) ?? null,
    }))

    return {
      ok: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "一覧取得に失敗しました",
    }
  }
}

// =============================================================================
// 2. 詳細取得（＋親子系譜・Product を明示クエリで付与）
// =============================================================================
export type SampleGenealogyNode = {
  id: string
  sampleNumber: string
  sampleRound: SampleRound
  roundOrder: number
  status: SampleProductionStatus
}

export type SampleProductionDetail = SampleProduction & {
  product: ProductSummary | null
  parent: SampleGenealogyNode | null
  children: SampleGenealogyNode[]
}

const GENEALOGY_SELECT = {
  id: true,
  sampleNumber: true,
  sampleRound: true,
  roundOrder: true,
  status: true,
} as const

export async function getSampleProduction(
  id: string,
): Promise<
  | { ok: true; data: SampleProductionDetail }
  | { ok: false; error: string }
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const row = await prisma.sampleProduction.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!row) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    const [productMap, parent, children] = await Promise.all([
      fetchProductSummariesByIds(sess.companyId, [row.productId]),
      row.parentSampleId
        ? prisma.sampleProduction.findFirst({
            where: {
              id: row.parentSampleId,
              companyId: sess.companyId,
              deletedAt: null,
            },
            select: GENEALOGY_SELECT,
          })
        : Promise.resolve(null),
      prisma.sampleProduction.findMany({
        where: {
          parentSampleId: row.id,
          companyId: sess.companyId,
          deletedAt: null,
        },
        select: GENEALOGY_SELECT,
        orderBy: { roundOrder: "asc" },
      }),
    ])

    return {
      ok: true,
      data: {
        ...row,
        product: productMap.get(row.productId) ?? null,
        parent,
        children,
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
// 3. 新規作成（SP採番 + ラウンド系譜を同一 transaction。parentSampleId 有無で分岐）
// =============================================================================
const CREATE_MAX_RETRIES = 3

export async function createSampleProduction(
  input: SampleProductionInput,
): Promise<ActionResult<{ id: string; sampleNumber: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = sampleProductionBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // 親（修正系譜）の解決：あれば roundOrder/productId を親から決める
    let roundOrder = 1
    let productId = data.productId
    if (data.parentSampleId) {
      const parent = await prisma.sampleProduction.findFirst({
        where: {
          id: data.parentSampleId,
          companyId: sess.companyId,
          deletedAt: null,
        },
        select: { id: true, productId: true, roundOrder: true },
      })
      if (!parent) {
        return { ok: false, error: "親サンプルが見つかりません" }
      }
      roundOrder = parent.roundOrder + 1
      productId = parent.productId // 系譜は同一 Product 配下
    }

    // Product 存在チェック
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!product) {
      return { ok: false, error: "対象の品番カルテが見つかりません" }
    }

    const sampleRound = roundForOrder(roundOrder)
    const year = new Date().getFullYear()
    const prefix = sampleNumberPrefix(year)
    const startDate = data.plannedStartDate ? new Date(data.plannedStartDate) : null
    const completionDate = data.plannedCompletionDate
      ? new Date(data.plannedCompletionDate)
      : null

    let created: { id: string; sampleNumber: string } | null = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < CREATE_MAX_RETRIES; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const sampleNumber = await computeNextSampleNumber(
            tx.sampleProduction,
            sess.companyId,
            prefix,
          )
          return tx.sampleProduction.create({
            data: {
              companyId: sess.companyId,
              productId,
              sampleNumber,
              sampleRound,
              roundOrder,
              parentSampleId: data.parentSampleId,
              title: data.title || null,
              description: data.description || null,
              sampleQuantity: data.sampleQuantity,
              plannedStartDate: startDate,
              plannedCompletionDate: completionDate,
              assignedToUserId: data.assignedToUserId,
              createdByUserId: sess.userId,
              internalNotes: data.internalNotes || null,
              status: SampleProductionStatus.PLANNING,
            },
            select: { id: true, sampleNumber: true },
          })
        })
        break
      } catch (e) {
        lastError = e
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue // sampleNumber unique 衝突：再試行
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
        entityType: "SampleProduction",
        entityId: created.id,
        afterData: {
          sampleNumber: created.sampleNumber,
          productId,
          parentSampleId: data.parentSampleId,
          sampleRound,
          roundOrder,
          status: SampleProductionStatus.PLANNING,
        },
      },
    })

    revalidatePath("/samples")
    revalidatePath(`/products/${productId}`)
    return { ok: true, data: { id: created.id, sampleNumber: created.sampleNumber } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新（productId / parentSampleId / sampleNumber / round は immutable。status は別関数）
// =============================================================================
export async function updateSampleProduction(
  id: string,
  input: SampleProductionInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = sampleProductionBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.sampleProduction.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    const startDate = data.plannedStartDate ? new Date(data.plannedStartDate) : null
    const completionDate = data.plannedCompletionDate
      ? new Date(data.plannedCompletionDate)
      : null

    const updated = await prisma.sampleProduction.update({
      where: { id },
      data: {
        // productId / parentSampleId / sampleNumber / sampleRound / roundOrder / status は immutable
        title: data.title || null,
        description: data.description || null,
        sampleQuantity: data.sampleQuantity,
        plannedStartDate: startDate,
        plannedCompletionDate: completionDate,
        assignedToUserId: data.assignedToUserId,
        internalNotes: data.internalNotes || null,
      },
    })

    // B-015/S-1: SampleProduction 業務スカラを全件 snapshot に載せる。
    // システム項目 (id/companyId/createdAt/updatedAt/deletedAt) のみ除外し、
    // satisfies Record<SampleProductionAuditField, unknown> で網羅をコンパイル時に強制する。
    type SampleProductionAuditField = Exclude<
      keyof typeof Prisma.SampleProductionScalarFieldEnum,
      "id" | "companyId" | "createdAt" | "updatedAt" | "deletedAt"
    >

    const snapshot = (
      r: SampleProduction,
    ): Record<SampleProductionAuditField, unknown> => ({
      productId: r.productId,
      sampleNumber: r.sampleNumber,
      sampleRound: r.sampleRound,
      roundOrder: r.roundOrder,
      parentSampleId: r.parentSampleId,
      title: r.title,
      description: r.description,
      specificationId: r.specificationId,
      patternVersionId: r.patternVersionId,
      designVersionId: r.designVersionId,
      patternWoId: r.patternWoId,
      sewingWoId: r.sewingWoId,
      status: r.status,
      sampleQuantity: r.sampleQuantity,
      plannedStartDate: r.plannedStartDate,
      plannedCompletionDate: r.plannedCompletionDate,
      actualStartDate: r.actualStartDate,
      actualCompletionDate: r.actualCompletionDate,
      totalPatternCost: r.totalPatternCost,
      totalMaterialCost: r.totalMaterialCost,
      totalSewingCost: r.totalSewingCost,
      totalRevisionCost: r.totalRevisionCost,
      totalCost: r.totalCost,
      currency: r.currency,
      isApproved: r.isApproved,
      approvedByUserId: r.approvedByUserId,
      approvedAt: r.approvedAt,
      clientApproved: r.clientApproved,
      clientApprovedAt: r.clientApprovedAt,
      clientFeedback: r.clientFeedback,
      shippedAt: r.shippedAt,
      shippingMethod: r.shippingMethod,
      trackingNumber: r.trackingNumber,
      hasPhotoRecord: r.hasPhotoRecord,
      photoUrls: r.photoUrls,
      internalNotes: r.internalNotes,
      createdByUserId: r.createdByUserId,
      assignedToUserId: r.assignedToUserId,
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "SampleProduction",
        entityId: id,
        beforeData: snapshot(existing),
        afterData: snapshot(updated),
      },
    })

    revalidatePath("/samples")
    revalidatePath(`/samples/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. status 手動遷移（from/to を AuditLog に記録。専用履歴テーブルは無い）
// =============================================================================
export async function changeSampleStatus(
  id: string,
  input: { status: SampleProductionStatus },
): Promise<ActionResult<{ id: string; status: SampleProductionStatus }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = changeSampleStatusSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: "ステータスが不正です" }
    }
    const nextStatus = parsed.data.status

    const existing = await prisma.sampleProduction.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true, status: true },
    })
    if (!existing) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }
    if (existing.status === nextStatus) {
      return { ok: false, error: "同じステータスです" }
    }

    await prisma.sampleProduction.update({
      where: { id },
      data: { status: nextStatus },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "STATUS_CHANGE",
        entityType: "SampleProduction",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: nextStatus },
      },
    })

    revalidatePath("/samples")
    revalidatePath(`/samples/${id}`)
    return { ok: true, data: { id, status: nextStatus } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ステータス変更に失敗しました",
    }
  }
}

// =============================================================================
// 6. アーカイブ（deletedAt セット＝soft-delete。ARCHIVED status が無いため）
// =============================================================================
export async function archiveSampleProduction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.sampleProduction.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    const now = new Date()
    await prisma.sampleProduction.update({
      where: { id },
      data: { deletedAt: now },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "SampleProduction",
        entityId: id,
        beforeData: { deletedAt: null },
        afterData: { deletedAt: now.toISOString() },
      },
    })

    revalidatePath("/samples")
    revalidatePath(`/samples/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 7. 復元（deletedAt クリア）
// =============================================================================
export async function restoreSampleProduction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // archive 済みを探すため deletedAt: null では絞らない（companyId は明示）
    const existing = await prisma.sampleProduction.findFirst({
      where: { id, companyId: sess.companyId },
      select: { id: true, deletedAt: true },
    })
    if (!existing) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }
    if (!existing.deletedAt) {
      return { ok: false, error: "アーカイブ済みではありません" }
    }

    const previouslyDeletedAt = existing.deletedAt
    await prisma.sampleProduction.update({
      where: { id },
      data: { deletedAt: null },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "SampleProduction",
        entityId: id,
        beforeData: { deletedAt: previouslyDeletedAt?.toISOString() ?? null },
        afterData: { deletedAt: null },
      },
    })

    revalidatePath("/samples")
    revalidatePath(`/samples/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 8. 紐付き確認（物理削除前のガード用）
//    子SP（parentSampleId がこの SP）と revisions をカウント。
// =============================================================================
export async function checkSampleProductionUsage(
  id: string,
): Promise<ActionResult<SampleProductionUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.sampleProduction.findFirst({
      where: { id, companyId: sess.companyId },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    const [childSampleCount, revisionCount] = await Promise.all([
      prisma.sampleProduction.count({
        where: { parentSampleId: id, companyId: sess.companyId },
      }),
      prisma.sampleRevision.count({ where: { sampleProductionId: id } }),
    ])

    return {
      ok: true,
      data: {
        childSampleCount,
        revisionCount,
        totalRefs: childSampleCount + revisionCount,
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "参照確認に失敗しました",
    }
  }
}

// =============================================================================
// 9. 物理削除（4 重ガード）
// =============================================================================
export async function deleteSampleProductionPermanently(
  id: string,
  confirmationName: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // ガード 1: MASTER_ADMIN
    if (sess.tenantType !== "MASTER_ADMIN") {
      return { ok: false, error: "物理削除はマスター管理者のみ実行可能です" }
    }

    const existing = await prisma.sampleProduction.findFirst({
      where: { id, companyId: sess.companyId },
      select: {
        id: true,
        sampleNumber: true,
        productId: true,
        deletedAt: true,
        status: true,
        parentSampleId: true,
      },
    })
    if (!existing) {
      return { ok: false, error: "サンプル製作セットが見つかりません" }
    }

    // ガード 2: archive 済み（deletedAt セット済み）
    if (!existing.deletedAt) {
      return {
        ok: false,
        error: "アーカイブ済みのサンプルのみ物理削除できます",
      }
    }

    // ガード 3: 確認名一致（sampleNumber で確認）
    if (confirmationName.trim() !== existing.sampleNumber) {
      return { ok: false, error: "確認名（SP番号）が一致しません" }
    }

    // ガード 4: 参照ゼロ
    const usage = await checkSampleProductionUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return {
        ok: false,
        error: `このサンプルは ${usage.data.childSampleCount} 件の修正サンプル・${usage.data.revisionCount} 件の修正記録から参照されています。`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.sampleProduction.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "SampleProduction",
        entityId: id,
        beforeData: {
          sampleNumber: existing.sampleNumber,
          productId: existing.productId,
          parentSampleId: existing.parentSampleId,
          status: existing.status,
        },
      },
    })

    revalidatePath("/samples")
    revalidatePath(`/products/${existing.productId}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
