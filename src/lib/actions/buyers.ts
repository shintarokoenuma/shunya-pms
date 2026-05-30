"use server"

import { revalidatePath } from "next/cache"
import { Prisma, BuyerStatus, DeliveryDestinationStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  buyerBaseSchema,
  type BuyerInput,
} from "@/lib/validators/buyer"

/**
 * Phase 1A-11: バイヤーマスター Server Actions
 *
 * 設計方針:
 * - shunya-master-patterns v1.2 §5 の 8 関数構成（list / get / create / update /
 *   archive / restore / checkUsage / deletePermanently）
 * - 認証は auth() + 共通ヘルパー requireSession()（CostCategory / Contractor と同パターン）
 * - 物理削除は 4 重ガード（MASTER_ADMIN + ARCHIVED + 名前一致 + 参照ゼロ）
 * - 全 mutation で auditLog 自動記録
 *
 * 参照元（usage チェックの対象）:
 * - DeliveryDestination.buyerId（必須 FK、onDelete: Cascade）
 *   1A-10（DeliveryDestination）実装後、削除時にこの参照件数を確認
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type BuyerUsage = {
  deliveryDestinationCount: number
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
// 補助: フォームの Client セレクト用に ACTIVE な Client 候補を返す
// =============================================================================
export type ClientOption = {
  id: string
  clientCode: string
  companyName: string
}

export async function listActiveClientsForBuyerSelect(): Promise<ClientOption[]> {
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
// 1. 一覧取得（client を select 込みで返す）
// =============================================================================
export type ListBuyersParams = {
  q?: string
  clientId?: string
  status?: BuyerStatus
  page?: number
  pageSize?: number
}

export type BuyerListItem = Prisma.BuyerGetPayload<{
  select: {
    id: true
    buyerCode: true
    buyerName: true
    buyerNameEn: true
    clientId: true
    country: true
    status: true
    createdAt: true
    updatedAt: true
    client: {
      select: {
        id: true
        clientCode: true
        companyName: true
      }
    }
    _count: {
      select: {
        deliveryDestinations: true
      }
    }
  }
}>

export async function listBuyers(
  params: ListBuyersParams = {},
): Promise<
  ActionResult<{
    items: BuyerListItem[]
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

    const where: Prisma.BuyerWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (params.status) where.status = params.status
    if (params.clientId) where.clientId = params.clientId
    if (q.length > 0) {
      where.OR = [
        { buyerCode: { contains: q, mode: "insensitive" } },
        { buyerName: { contains: q, mode: "insensitive" } },
        { buyerNameEn: { contains: q, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.buyer.findMany({
        where,
        select: {
          id: true,
          buyerCode: true,
          buyerName: true,
          buyerNameEn: true,
          clientId: true,
          country: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
          _count: {
            select: {
              deliveryDestinations: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: [{ buyerCode: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.buyer.count({ where }),
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
// 2. 詳細取得（client 込み）
// =============================================================================
export async function getBuyer(id: string) {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const row = await prisma.buyer.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      include: {
        client: {
          select: {
            id: true,
            clientCode: true,
            companyName: true,
          },
        },
      },
    })
    if (!row) {
      return { ok: false as const, error: "バイヤーが見つかりません" }
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
export async function createBuyer(
  input: BuyerInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = buyerBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // buyerCode 重複の事前チェック
    const dup = await prisma.buyer.findFirst({
      where: {
        companyId: sess.companyId,
        buyerCode: data.buyerCode,
        deletedAt: null,
      },
    })
    if (dup) {
      return {
        ok: false,
        error: `バイヤーコード "${data.buyerCode}" は既に使用されています`,
      }
    }

    // clientId が指定されている場合は存在チェック
    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: data.clientId,
          companyId: sess.companyId,
          deletedAt: null,
        },
      })
      if (!client) {
        return {
          ok: false,
          error: "指定されたクライアントが見つかりません",
        }
      }
    }

    const created = await prisma.buyer.create({
      data: {
        companyId: sess.companyId,
        buyerCode: data.buyerCode,
        buyerName: data.buyerName,
        buyerNameEn: data.buyerNameEn || null,
        clientId: data.clientId,
        country: data.country,
        postalCode: data.postalCode || null,
        prefecture: data.prefecture || null,
        city: data.city || null,
        address: data.address || null,
        addressLine2: data.addressLine2 || null,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
        status: data.status,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "Buyer",
        entityId: created.id,
        afterData: {
          buyerCode: created.buyerCode,
          buyerName: created.buyerName,
          clientId: created.clientId,
          status: created.status,
        },
      },
    })

    revalidatePath("/buyers")
    if (created.clientId) {
      revalidatePath(`/clients/${created.clientId}`)
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
export async function updateBuyer(
  id: string,
  input: BuyerInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = buyerBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.buyer.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "バイヤーが見つかりません" }
    }

    // buyerCode 変更時のみ重複チェック
    if (existing.buyerCode !== data.buyerCode) {
      const dup = await prisma.buyer.findFirst({
        where: {
          companyId: sess.companyId,
          buyerCode: data.buyerCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (dup) {
        return {
          ok: false,
          error: `バイヤーコード "${data.buyerCode}" は既に使用されています`,
        }
      }
    }

    // clientId が指定されている場合は存在チェック
    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: data.clientId,
          companyId: sess.companyId,
          deletedAt: null,
        },
      })
      if (!client) {
        return {
          ok: false,
          error: "指定されたクライアントが見つかりません",
        }
      }
    }

    const updated = await prisma.buyer.update({
      where: { id },
      data: {
        buyerCode: data.buyerCode,
        buyerName: data.buyerName,
        buyerNameEn: data.buyerNameEn || null,
        clientId: data.clientId,
        country: data.country,
        postalCode: data.postalCode || null,
        prefecture: data.prefecture || null,
        city: data.city || null,
        address: data.address || null,
        addressLine2: data.addressLine2 || null,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
        status: data.status,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Buyer",
        entityId: id,
        beforeData: {
          buyerCode: existing.buyerCode,
          buyerName: existing.buyerName,
          clientId: existing.clientId,
          status: existing.status,
        },
        afterData: {
          buyerCode: updated.buyerCode,
          buyerName: updated.buyerName,
          clientId: updated.clientId,
          status: updated.status,
        },
      },
    })

    revalidatePath("/buyers")
    revalidatePath(`/buyers/${id}`)
    // 双方向リンク: 旧 clientId と新 clientId の両方を invalidate
    if (existing.clientId) {
      revalidatePath(`/clients/${existing.clientId}`)
    }
    if (updated.clientId && updated.clientId !== existing.clientId) {
      revalidatePath(`/clients/${updated.clientId}`)
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
// 5. アーカイブ（Phase 1A-10 で cascade オプション追加：パターン γ）
//
// 配下に ACTIVE な DeliveryDestination がある場合、UI でユーザーに
// 同時アーカイブを選択させる（デフォルト ON）。
// cascadeArchiveDestinations=true のとき、Buyer + 配下 DD を同一 tx で archive。
// =============================================================================
export type ArchiveBuyerOptions = {
  cascadeArchiveDestinations?: boolean
}

export async function archiveBuyer(
  id: string,
  options: ArchiveBuyerOptions = {},
): Promise<ActionResult<{ id: string; cascadedCount: number }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const cascade = options.cascadeArchiveDestinations ?? true

    const existing = await prisma.buyer.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "バイヤーが見つかりません" }
    }
    if (existing.status === BuyerStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブ済みです" }
    }

    const { cascadedCount, cascadedIds } = await prisma.$transaction(
      async (tx) => {
        await tx.buyer.update({
          where: { id },
          data: { status: BuyerStatus.ARCHIVED },
        })

        if (!cascade) {
          return { cascadedCount: 0, cascadedIds: [] as string[] }
        }

        // 連鎖アーカイブ対象を id 込みで取得（個別の revalidatePath に使う）
        const targets = await tx.deliveryDestination.findMany({
          where: {
            companyId: sess.companyId,
            buyerId: id,
            deletedAt: null,
            status: DeliveryDestinationStatus.ACTIVE,
          },
          select: { id: true },
        })
        if (targets.length === 0) {
          return { cascadedCount: 0, cascadedIds: [] as string[] }
        }

        await tx.deliveryDestination.updateMany({
          where: { id: { in: targets.map((t) => t.id) } },
          data: { status: DeliveryDestinationStatus.ARCHIVED },
        })

        return {
          cascadedCount: targets.length,
          cascadedIds: targets.map((t) => t.id),
        }
      },
    )

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Buyer",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: {
          status: BuyerStatus.ARCHIVED,
          cascadeArchiveDestinations: cascade,
          cascadedDestinationCount: cascadedCount,
        },
      },
    })

    revalidatePath("/buyers")
    revalidatePath(`/buyers/${id}`)
    if (existing.clientId) {
      revalidatePath(`/clients/${existing.clientId}`)
    }
    if (cascadedCount > 0) {
      revalidatePath("/delivery-destinations")
      for (const ddId of cascadedIds) {
        revalidatePath(`/delivery-destinations/${ddId}`)
      }
    }
    return { ok: true, data: { id, cascadedCount } }
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
export async function restoreBuyer(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.buyer.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "バイヤーが見つかりません" }
    }
    if (existing.status === BuyerStatus.ACTIVE) {
      return { ok: false, error: "既に稼働中です" }
    }

    await prisma.buyer.update({
      where: { id },
      data: { status: BuyerStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Buyer",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: BuyerStatus.ACTIVE },
      },
    })

    revalidatePath("/buyers")
    revalidatePath(`/buyers/${id}`)
    if (existing.clientId) {
      revalidatePath(`/clients/${existing.clientId}`)
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
// =============================================================================
export async function checkBuyerUsage(
  id: string,
): Promise<ActionResult<BuyerUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.buyer.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "バイヤーが見つかりません" }
    }

    const deliveryDestinationCount = await prisma.deliveryDestination.count({
      where: { buyerId: id },
    })

    return {
      ok: true,
      data: {
        deliveryDestinationCount,
        totalRefs: deliveryDestinationCount,
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
// 8. 物理削除（4 重ガード）
// =============================================================================
export async function deleteBuyerPermanently(
  id: string,
  confirmationName: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    // ガード 1: MASTER_ADMIN 権限
    if (sess.tenantType !== "MASTER_ADMIN") {
      return {
        ok: false,
        error: "物理削除はマスター管理者のみ実行可能です",
      }
    }

    const existing = await prisma.buyer.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "バイヤーが見つかりません" }
    }

    // ガード 2: ARCHIVED 状態
    if (existing.status !== BuyerStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みのバイヤーのみ物理削除できます",
      }
    }

    // ガード 3: 確認名一致
    if (confirmationName.trim() !== existing.buyerName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    // ガード 4: 参照ゼロ
    const usage = await checkBuyerUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return {
        ok: false,
        error: `このバイヤーは ${usage.data.deliveryDestinationCount} 件の納品先から参照されています。先に納品先を削除してください。`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.buyer.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "Buyer",
        entityId: id,
        beforeData: {
          buyerCode: existing.buyerCode,
          buyerName: existing.buyerName,
          clientId: existing.clientId,
          status: existing.status,
        },
      },
    })

    revalidatePath("/buyers")
    if (existing.clientId) {
      revalidatePath(`/clients/${existing.clientId}`)
    }
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
