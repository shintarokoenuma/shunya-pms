"use server"

import { revalidatePath } from "next/cache"
import { Prisma, DeliveryDestinationStatus, BuyerStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  deliveryDestinationBaseSchema,
  type DeliveryDestinationInput,
} from "@/lib/validators/delivery-destination"

/**
 * Phase 1A-10: 納品先（DeliveryDestination）Server Actions
 *
 * 設計方針（spec 2026-05-27）:
 * - shunya-master-patterns v1.2 §5 の 8 関数構成（list / get / create / update /
 *   archive / restore / checkUsage / deletePermanently）
 * - buyerId は必須 FK（DD は必ず Buyer に紐づく）
 * - 一覧フィルタは buyerId + clientId（buyer.clientId 経由）+ status の 3 つ
 * - URL パラメータ連動（?buyerId=xxx / ?clientId=xxx）で自動フィルタ
 * - 双方向リンク: create / update / archive / restore / delete 時に Buyer / Client の
 *   詳細ページを revalidatePath で再生成
 *
 * 参照元（usage チェックの対象、Phase 1B 以降で追加）:
 * - SalesOrder.deliveryDestinationId
 * - DeliveryNote.deliveryDestinationId
 * - Invoice.deliveryDestinationId 等
 * Phase 1A 時点ではどれも未実装のため totalRefs は常に 0 を返す
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type DeliveryDestinationUsage = {
  // Phase 1B 以降で SO / DLV / INV / PO 等の参照件数を追加
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
// 補助 1: フォームの Buyer セレクト用に ACTIVE な Buyer 候補を返す
// =============================================================================
export type BuyerOption = {
  id: string
  buyerCode: string
  buyerName: string
  clientId: string | null
  clientCode: string | null
  companyName: string | null
}

export async function listActiveBuyersForDestinationSelect(): Promise<
  BuyerOption[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []

  const rows = await prisma.buyer.findMany({
    where: {
      companyId: sess.companyId,
      deletedAt: null,
      status: BuyerStatus.ACTIVE,
    },
    select: {
      id: true,
      buyerCode: true,
      buyerName: true,
      clientId: true,
      client: { select: { clientCode: true, companyName: true } },
    },
    orderBy: [{ buyerCode: "asc" }],
  })
  return rows.map((r) => ({
    id: r.id,
    buyerCode: r.buyerCode,
    buyerName: r.buyerName,
    clientId: r.clientId,
    clientCode: r.client?.clientCode ?? null,
    companyName: r.client?.companyName ?? null,
  }))
}

// =============================================================================
// 補助 2: フォーム / 一覧の Client セレクト用に ACTIVE な Client 候補を返す
// =============================================================================
export type ClientOptionForDestination = {
  id: string
  clientCode: string
  companyName: string
}

export async function listActiveClientsForDestinationFilter(): Promise<
  ClientOptionForDestination[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []

  const rows = await prisma.client.findMany({
    where: {
      companyId: sess.companyId,
      deletedAt: null,
      status: "ACTIVE",
    },
    select: { id: true, clientCode: true, companyName: true },
    orderBy: [{ clientCode: "asc" }],
  })
  return rows
}

// =============================================================================
// 補助 3: cascade archive ダイアログ用に Buyer 配下の ACTIVE な DD を返す
//        （Buyer archive 時のパターン γ 警告に使用）
// =============================================================================
export type ActiveDestinationsByBuyer = {
  count: number
  preview: { id: string; destinationCode: string; destinationName: string }[]
}

export async function listActiveDestinationsByBuyer(
  buyerId: string,
): Promise<ActionResult<ActiveDestinationsByBuyer>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const [count, preview] = await Promise.all([
      prisma.deliveryDestination.count({
        where: {
          companyId: sess.companyId,
          buyerId,
          deletedAt: null,
          status: DeliveryDestinationStatus.ACTIVE,
        },
      }),
      prisma.deliveryDestination.findMany({
        where: {
          companyId: sess.companyId,
          buyerId,
          deletedAt: null,
          status: DeliveryDestinationStatus.ACTIVE,
        },
        select: { id: true, destinationCode: true, destinationName: true },
        orderBy: [{ destinationCode: "asc" }],
        take: 5,
      }),
    ])

    return { ok: true, data: { count, preview } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "納品先一覧の取得に失敗しました",
    }
  }
}

// =============================================================================
// 1. 一覧取得
// =============================================================================
export type ListDeliveryDestinationsParams = {
  q?: string
  buyerId?: string
  clientId?: string
  status?: DeliveryDestinationStatus
  page?: number
  pageSize?: number
}

export type DeliveryDestinationListItem = Prisma.DeliveryDestinationGetPayload<{
  select: {
    id: true
    destinationCode: true
    destinationName: true
    buyerId: true
    country: true
    prefecture: true
    status: true
    createdAt: true
    updatedAt: true
    buyer: {
      select: {
        id: true
        buyerCode: true
        buyerName: true
        clientId: true
        client: {
          select: {
            id: true
            clientCode: true
            companyName: true
          }
        }
      }
    }
  }
}>

export async function listDeliveryDestinations(
  params: ListDeliveryDestinationsParams = {},
): Promise<
  ActionResult<{
    items: DeliveryDestinationListItem[]
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

    const where: Prisma.DeliveryDestinationWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (params.status) where.status = params.status
    if (params.buyerId) where.buyerId = params.buyerId
    if (params.clientId) {
      where.buyer = { clientId: params.clientId }
    }
    if (q.length > 0) {
      where.OR = [
        { destinationCode: { contains: q, mode: "insensitive" } },
        { destinationName: { contains: q, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.deliveryDestination.findMany({
        where,
        select: {
          id: true,
          destinationCode: true,
          destinationName: true,
          buyerId: true,
          country: true,
          prefecture: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          buyer: {
            select: {
              id: true,
              buyerCode: true,
              buyerName: true,
              clientId: true,
              client: {
                select: {
                  id: true,
                  clientCode: true,
                  companyName: true,
                },
              },
            },
          },
        },
        orderBy: [{ destinationCode: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.deliveryDestination.count({ where }),
    ])

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
// 2. 詳細取得
// =============================================================================
export async function getDeliveryDestination(id: string) {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const row = await prisma.deliveryDestination.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: {
        buyer: {
          select: {
            id: true,
            buyerCode: true,
            buyerName: true,
            clientId: true,
            client: {
              select: {
                id: true,
                clientCode: true,
                companyName: true,
              },
            },
          },
        },
      },
    })
    if (!row) {
      return { ok: false as const, error: "納品先が見つかりません" }
    }
    return { ok: true as const, data: row }
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "詳細取得に失敗しました",
    }
  }
}

// =============================================================================
// 3. 新規作成
// =============================================================================
export async function createDeliveryDestination(
  input: DeliveryDestinationInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = deliveryDestinationBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // destinationCode 重複チェック
    const dup = await prisma.deliveryDestination.findFirst({
      where: {
        companyId: sess.companyId,
        destinationCode: data.destinationCode,
        deletedAt: null,
      },
    })
    if (dup) {
      return {
        ok: false,
        error: `納品先コード "${data.destinationCode}" は既に使用されています`,
      }
    }

    // buyerId 存在チェック
    const buyer = await prisma.buyer.findFirst({
      where: {
        id: data.buyerId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true, clientId: true },
    })
    if (!buyer) {
      return { ok: false, error: "指定されたバイヤーが見つかりません" }
    }

    const created = await prisma.deliveryDestination.create({
      data: {
        companyId: sess.companyId,
        buyerId: data.buyerId,
        destinationCode: data.destinationCode,
        destinationName: data.destinationName,
        country: data.country,
        postalCode: data.postalCode || null,
        prefecture: data.prefecture || null,
        city: data.city || null,
        address: data.address || null,
        addressLine2: data.addressLine2 || null,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        deliveryNotes: data.deliveryNotes || null,
        preferredDeliveryDays: data.preferredDeliveryDays || null,
        preferredDeliveryHours: data.preferredDeliveryHours || null,
        timezone: data.timezone || null,
        notes: data.notes || null,
        status: data.status,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "DeliveryDestination",
        entityId: created.id,
        afterData: {
          destinationCode: created.destinationCode,
          destinationName: created.destinationName,
          buyerId: created.buyerId,
          status: created.status,
        },
      },
    })

    revalidatePath("/delivery-destinations")
    revalidatePath(`/buyers/${created.buyerId}`)
    if (buyer.clientId) {
      revalidatePath(`/clients/${buyer.clientId}`)
    }
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "作成に失敗しました",
    }
  }
}

// =============================================================================
// 4. 更新
// =============================================================================
export async function updateDeliveryDestination(
  id: string,
  input: DeliveryDestinationInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = deliveryDestinationBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.deliveryDestination.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: { buyer: { select: { clientId: true } } },
    })
    if (!existing) {
      return { ok: false, error: "納品先が見つかりません" }
    }

    // destinationCode 変更時のみ重複チェック
    if (existing.destinationCode !== data.destinationCode) {
      const dup = await prisma.deliveryDestination.findFirst({
        where: {
          companyId: sess.companyId,
          destinationCode: data.destinationCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (dup) {
        return {
          ok: false,
          error: `納品先コード "${data.destinationCode}" は既に使用されています`,
        }
      }
    }

    // buyerId 変更時のみ存在チェック
    let newBuyerClientId: string | null = existing.buyer.clientId
    if (existing.buyerId !== data.buyerId) {
      const buyer = await prisma.buyer.findFirst({
        where: {
          id: data.buyerId,
          companyId: sess.companyId,
          deletedAt: null,
        },
        select: { id: true, clientId: true },
      })
      if (!buyer) {
        return { ok: false, error: "指定されたバイヤーが見つかりません" }
      }
      newBuyerClientId = buyer.clientId
    }

    const updated = await prisma.deliveryDestination.update({
      where: { id },
      data: {
        buyerId: data.buyerId,
        destinationCode: data.destinationCode,
        destinationName: data.destinationName,
        country: data.country,
        postalCode: data.postalCode || null,
        prefecture: data.prefecture || null,
        city: data.city || null,
        address: data.address || null,
        addressLine2: data.addressLine2 || null,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        deliveryNotes: data.deliveryNotes || null,
        preferredDeliveryDays: data.preferredDeliveryDays || null,
        preferredDeliveryHours: data.preferredDeliveryHours || null,
        timezone: data.timezone || null,
        notes: data.notes || null,
        status: data.status,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "DeliveryDestination",
        entityId: id,
        beforeData: {
          destinationCode: existing.destinationCode,
          destinationName: existing.destinationName,
          buyerId: existing.buyerId,
          status: existing.status,
        },
        afterData: {
          destinationCode: updated.destinationCode,
          destinationName: updated.destinationName,
          buyerId: updated.buyerId,
          status: updated.status,
        },
      },
    })

    revalidatePath("/delivery-destinations")
    revalidatePath(`/delivery-destinations/${id}`)
    // 双方向リンク: 旧 buyer / 新 buyer / それぞれの client を invalidate
    revalidatePath(`/buyers/${existing.buyerId}`)
    if (updated.buyerId !== existing.buyerId) {
      revalidatePath(`/buyers/${updated.buyerId}`)
    }
    if (existing.buyer.clientId) {
      revalidatePath(`/clients/${existing.buyer.clientId}`)
    }
    if (newBuyerClientId && newBuyerClientId !== existing.buyer.clientId) {
      revalidatePath(`/clients/${newBuyerClientId}`)
    }
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "更新に失敗しました",
    }
  }
}

// =============================================================================
// 5. アーカイブ
// =============================================================================
export async function archiveDeliveryDestination(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.deliveryDestination.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: { buyer: { select: { clientId: true } } },
    })
    if (!existing) {
      return { ok: false, error: "納品先が見つかりません" }
    }
    if (existing.status === DeliveryDestinationStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブ済みです" }
    }

    await prisma.deliveryDestination.update({
      where: { id },
      data: { status: DeliveryDestinationStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "DeliveryDestination",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: DeliveryDestinationStatus.ARCHIVED },
      },
    })

    revalidatePath("/delivery-destinations")
    revalidatePath(`/delivery-destinations/${id}`)
    revalidatePath(`/buyers/${existing.buyerId}`)
    if (existing.buyer.clientId) {
      revalidatePath(`/clients/${existing.buyer.clientId}`)
    }
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 6. 復元
// =============================================================================
export async function restoreDeliveryDestination(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.deliveryDestination.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: { buyer: { select: { clientId: true } } },
    })
    if (!existing) {
      return { ok: false, error: "納品先が見つかりません" }
    }
    if (existing.status === DeliveryDestinationStatus.ACTIVE) {
      return { ok: false, error: "既に稼働中です" }
    }

    await prisma.deliveryDestination.update({
      where: { id },
      data: { status: DeliveryDestinationStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "DeliveryDestination",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: DeliveryDestinationStatus.ACTIVE },
      },
    })

    revalidatePath("/delivery-destinations")
    revalidatePath(`/delivery-destinations/${id}`)
    revalidatePath(`/buyers/${existing.buyerId}`)
    if (existing.buyer.clientId) {
      revalidatePath(`/clients/${existing.buyer.clientId}`)
    }
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 7. 紐付き確認（物理削除前のガード用）
//    Phase 1A 時点では業務トランザクション未実装のため常に totalRefs: 0
// =============================================================================
export async function checkDeliveryDestinationUsage(
  id: string,
): Promise<ActionResult<DeliveryDestinationUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.deliveryDestination.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "納品先が見つかりません" }
    }

    // Phase 1B 以降で SalesOrder / DeliveryNote / Invoice 等の参照件数を加算
    return {
      ok: true,
      data: { totalRefs: 0 },
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "参照確認に失敗しました",
    }
  }
}

// =============================================================================
// 8. 物理削除（4 重ガード）
// =============================================================================
export async function deleteDeliveryDestinationPermanently(
  id: string,
  confirmationName: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // ガード 1: MASTER_ADMIN
    if (sess.tenantType !== "MASTER_ADMIN") {
      return {
        ok: false,
        error: "物理削除はマスター管理者のみ実行可能です",
      }
    }

    const existing = await prisma.deliveryDestination.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: { buyer: { select: { clientId: true } } },
    })
    if (!existing) {
      return { ok: false, error: "納品先が見つかりません" }
    }

    // ガード 2: ARCHIVED
    if (existing.status !== DeliveryDestinationStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みの納品先のみ物理削除できます",
      }
    }

    // ガード 3: 確認名一致
    if (confirmationName.trim() !== existing.destinationName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    // ガード 4: 参照ゼロ
    const usage = await checkDeliveryDestinationUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return {
        ok: false,
        error: `この納品先は ${usage.data.totalRefs} 件の業務データから参照されています。`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.deliveryDestination.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "DeliveryDestination",
        entityId: id,
        beforeData: {
          destinationCode: existing.destinationCode,
          destinationName: existing.destinationName,
          buyerId: existing.buyerId,
          status: existing.status,
        },
      },
    })

    revalidatePath("/delivery-destinations")
    revalidatePath(`/buyers/${existing.buyerId}`)
    if (existing.buyer.clientId) {
      revalidatePath(`/clients/${existing.buyer.clientId}`)
    }
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
