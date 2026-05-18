"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withTenantContext } from "@/lib/with-tenant"
import { writeAuditLog } from "@/lib/audit-log"
import {
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
  type CreateClientInput,
  type ListClientsQuery,
  type UpdateClientInput,
} from "@/lib/validators/client"

// =============================================================================
// 共通型：Server Action の結果
// =============================================================================

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

// =============================================================================
// 一覧取得
// =============================================================================

export async function listClients(rawQuery: ListClientsQuery = {}) {
  return withTenantContext(async () => {
    const parsed = listClientsQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
      return {
        items: [],
        total: 0,
        page: 1,
        perPage: 20,
        totalPages: 0,
      }
    }

    const { q, status, businessType, country, sort, order, page, perPage } =
      parsed.data

    // Prisma Extension が companyId と deletedAt: null を自動付与する
    const where: Prisma.ClientWhereInput = {
      ...(status && { status }),
      ...(businessType && { businessType }),
      ...(country && { country }),
      ...(q && {
        OR: [
          { companyName: { contains: q, mode: "insensitive" } },
          { clientCode: { contains: q, mode: "insensitive" } },
          { legalEntity: { contains: q, mode: "insensitive" } },
        ],
      }),
    }

    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.client.count({ where }),
    ])

    return {
      items,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    }
  })
}

// =============================================================================
// 詳細取得
// =============================================================================

export async function getClient(id: string) {
  return withTenantContext(async () => {
    // findUnique は Extension で「クエリ後検証」されるので他テナント漏れなし
    return prisma.client.findUnique({ where: { id } })
  })
}

// =============================================================================
// 新規作成
// =============================================================================

export async function createClient(
  input: CreateClientInput
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const parsed = createClientSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: "入力内容に誤りがあります",
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    const data = parsed.data

    // clientCode の重複チェック（@@unique([companyId, clientCode])）
    const exists = await prisma.client.findFirst({
      where: { clientCode: data.clientCode },
    })
    if (exists) {
      return {
        ok: false,
        error: `クライアントコード「${data.clientCode}」は既に使用されています`,
        fieldErrors: {
          clientCode: ["このコードは既に使用されています"],
        },
      }
    }

    try {
      const { getTenantContext } = await import("@/lib/tenant-context")
      const created = await prisma.client.create({ data: data as Prisma.ClientUncheckedCreateInput })

      await writeAuditLog({
        action: "CREATE",
        entityType: "Client",
        entityId: created.id,
        afterData: { clientCode: created.clientCode, companyName: created.companyName },
        description: `クライアント新規作成: ${created.companyName}`,
      })

      revalidatePath("/clients")
      return { ok: true, data: { id: created.id } }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return {
          ok: false,
          error: "クライアントコードが重複しています",
          fieldErrors: { clientCode: ["このコードは既に使用されています"] },
        }
      }
      throw e
    }
  })
}

// =============================================================================
// 編集
// =============================================================================

export async function updateClient(
  id: string,
  input: UpdateClientInput
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const parsed = updateClientSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: "入力内容に誤りがあります",
        fieldErrors: parsed.error.flatten().fieldErrors,
      }
    }

    const data = parsed.data

    const before = await prisma.client.findUnique({ where: { id } })
    if (!before) {
      return { ok: false, error: "対象のクライアントが見つかりません" }
    }

    // clientCode を変更する場合、重複チェック
    if (data.clientCode && data.clientCode !== before.clientCode) {
      const exists = await prisma.client.findFirst({
        where: { clientCode: data.clientCode },
      })
      if (exists) {
        return {
          ok: false,
          error: `クライアントコード「${data.clientCode}」は既に使用されています`,
          fieldErrors: {
            clientCode: ["このコードは既に使用されています"],
          },
        }
      }
    }

    try {
      const { getTenantContext } = await import("@/lib/tenant-context")
      const after = await prisma.client.update({
        where: { id },
        data: data as Prisma.ClientUncheckedUpdateInput,
      })

      await writeAuditLog({
        action: "UPDATE",
        entityType: "Client",
        entityId: id,
        beforeData: {
          clientCode: before.clientCode,
          companyName: before.companyName,
          status: before.status,
        },
        afterData: {
          clientCode: after.clientCode,
          companyName: after.companyName,
          status: after.status,
        },
        description: `クライアント編集: ${after.companyName}`,
      })

      revalidatePath("/clients")
      revalidatePath(`/clients/${id}`)
      return { ok: true, data: { id } }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return {
          ok: false,
          error: "クライアントコードが重複しています",
          fieldErrors: { clientCode: ["このコードは既に使用されています"] },
        }
      }
      throw e
    }
  })
}

// =============================================================================
// 論理削除（status=ARCHIVED + deletedAt セット）
// =============================================================================

export async function softDeleteClient(
  id: string
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const before = await prisma.client.findUnique({ where: { id } })
    if (!before) {
      return { ok: false, error: "対象のクライアントが見つかりません" }
    }

    // Prisma Extension により delete() は禁止されているため、update で deletedAt を立てる
    await prisma.client.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "ARCHIVED",
      },
    })

    await writeAuditLog({
      action: "DELETE",
      entityType: "Client",
      entityId: id,
      beforeData: {
        clientCode: before.clientCode,
        companyName: before.companyName,
        status: before.status,
      },
      description: `クライアント論理削除: ${before.companyName}`,
    })

    revalidatePath("/clients")
    return { ok: true, data: { id } }
  })
}
