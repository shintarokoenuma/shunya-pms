"use server"

import { revalidatePath } from "next/cache"
import { Prisma, FactoryStatus, type FactoryType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  factoryInputSchema,
  type FactoryInput,
} from "@/lib/validators/factory"

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type FactoryUsage = {
  contactCount: number
  // 将来追加するリレーション（WO/Product 等）
  workOrderCount: number
  productCount: number
  totalRefs: number
}

// =============================================================================
// 一覧取得
// =============================================================================
export type ListFactoriesParams = {
  q?: string
  status?: FactoryStatus
  factoryType?: FactoryType
  page?: number
  pageSize?: number
}

export async function listFactories(params: ListFactoriesParams) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.FactoryWhereInput = {
    companyId,
    deletedAt: null,
  }

  if (params.status) {
    where.status = params.status
  }

  if (params.factoryType) {
    where.factoryTypes = { has: params.factoryType }
  }

  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim()
    where.OR = [
      { factoryName: { contains: q, mode: "insensitive" } },
      { factoryNameEn: { contains: q, mode: "insensitive" } },
      { factoryCode: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, factories] = await Promise.all([
    prisma.factory.count({ where }),
    prisma.factory.findMany({
      where,
      orderBy: [{ status: "asc" }, { factoryCode: "asc" }],
      skip,
      take: pageSize,
      include: {
        contacts: {
          where: { isPrimary: true, deletedAt: null },
          take: 1,
        },
      },
    }),
  ])

  return {
    factories,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  }
}

// =============================================================================
// 詳細取得
// =============================================================================
export async function getFactory(id: string) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const factory = await prisma.factory.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  })

  if (!factory) {
    throw new Error("工場が見つかりません")
  }

  return factory
}

// =============================================================================
// 新規作成
// =============================================================================
export async function createFactory(
  input: FactoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = factoryInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.factory.findFirst({
      where: {
        companyId,
        factoryCode: data.factoryCode,
        deletedAt: null,
      },
    })
    if (existing) {
      return {
        ok: false,
        error: `工場コード "${data.factoryCode}" は既に存在します`,
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const f = await tx.factory.create({
        data: {
          companyId,
          factoryCode: data.factoryCode,
          factoryName: data.factoryName,
          factoryNameEn: data.factoryNameEn || null,
          factoryTypes: data.factoryTypes,
          contractTypes: data.contractTypes,
          country: data.country,
          postalCode: data.postalCode || null,
          prefecture: data.prefecture || null,
          city: data.city || null,
          address: data.address || null,
          addressLine2: data.addressLine2 || null,
          addressEn: data.addressEn || null,
          phone: data.phone || null,
          fax: data.fax || null,
          email: data.email || null,
          chatTool: data.chatTool || null,
          chatToolId: data.chatToolId || null,
          preferredLanguage: data.preferredLanguage,
          preferredCurrency: data.preferredCurrency,
          timezone: data.timezone || null,
          taxId: data.taxId || null,
          isQualifiedInvoiceIssuer: data.isQualifiedInvoiceIssuer,
          paymentTermType: data.paymentTermType,
          closingDay: data.closingDay ?? null,
          paymentMonthOffset: data.paymentMonthOffset ?? null,
          paymentDay: data.paymentDay ?? null,
          monthlyCapacity: data.monthlyCapacity ?? null,
          minimumOrderQty: data.minimumOrderQty ?? null,
          averageLeadTimeDays: data.averageLeadTimeDays ?? null,
          assignedToUserId: data.assignedToUserId || null,
          notes: data.notes || null,
          status: data.status,
        },
      })

      const contact = data.primaryContact
      const displayName = `${contact.lastName} ${contact.firstName}`.trim()
      await tx.factoryContact.create({
        data: {
          companyId,
          factoryId: f.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          displayName,
          jobTitle: contact.jobTitle || null,
          department: contact.department || null,
          email: contact.email || null,
          phone: contact.phone || null,
          mobile: contact.mobile || null,
          isPrimary: true,
        },
      })

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "CREATE",
          entityType: "Factory",
          entityId: f.id,
          afterData: {
            factoryCode: f.factoryCode,
            factoryName: f.factoryName,
          },
        },
      })

      return f
    })

    revalidatePath("/factories")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "工場の作成に失敗しました",
    }
  }
}

// =============================================================================
// 更新
// =============================================================================
export async function updateFactory(
  id: string,
  input: FactoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = factoryInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.factory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "工場が見つかりません" }
    }

    if (data.factoryCode !== existing.factoryCode) {
      const conflict = await prisma.factory.findFirst({
        where: {
          companyId,
          factoryCode: data.factoryCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `工場コード "${data.factoryCode}" は既に存在します`,
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.factory.update({
        where: { id },
        data: {
          factoryCode: data.factoryCode,
          factoryName: data.factoryName,
          factoryNameEn: data.factoryNameEn || null,
          factoryTypes: data.factoryTypes,
          contractTypes: data.contractTypes,
          country: data.country,
          postalCode: data.postalCode || null,
          prefecture: data.prefecture || null,
          city: data.city || null,
          address: data.address || null,
          addressLine2: data.addressLine2 || null,
          addressEn: data.addressEn || null,
          phone: data.phone || null,
          fax: data.fax || null,
          email: data.email || null,
          chatTool: data.chatTool || null,
          chatToolId: data.chatToolId || null,
          preferredLanguage: data.preferredLanguage,
          preferredCurrency: data.preferredCurrency,
          timezone: data.timezone || null,
          taxId: data.taxId || null,
          isQualifiedInvoiceIssuer: data.isQualifiedInvoiceIssuer,
          paymentTermType: data.paymentTermType,
          closingDay: data.closingDay ?? null,
          paymentMonthOffset: data.paymentMonthOffset ?? null,
          paymentDay: data.paymentDay ?? null,
          monthlyCapacity: data.monthlyCapacity ?? null,
          minimumOrderQty: data.minimumOrderQty ?? null,
          averageLeadTimeDays: data.averageLeadTimeDays ?? null,
          assignedToUserId: data.assignedToUserId || null,
          notes: data.notes || null,
          status: data.status,
        },
      })

      const contact = data.primaryContact
      const displayName = `${contact.lastName} ${contact.firstName}`.trim()
      const primary = await tx.factoryContact.findFirst({
        where: { factoryId: id, isPrimary: true, deletedAt: null },
      })
      if (primary) {
        await tx.factoryContact.update({
          where: { id: primary.id },
          data: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            displayName,
            jobTitle: contact.jobTitle || null,
            department: contact.department || null,
            email: contact.email || null,
            phone: contact.phone || null,
            mobile: contact.mobile || null,
          },
        })
      } else {
        await tx.factoryContact.create({
          data: {
            companyId,
            factoryId: id,
            firstName: contact.firstName,
            lastName: contact.lastName,
            displayName,
            jobTitle: contact.jobTitle || null,
            department: contact.department || null,
            email: contact.email || null,
            phone: contact.phone || null,
            mobile: contact.mobile || null,
            isPrimary: true,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          entityType: "Factory",
          entityId: id,
          beforeData: {
            factoryCode: existing.factoryCode,
            factoryName: existing.factoryName,
            status: existing.status,
          },
          afterData: {
            factoryCode: updated.factoryCode,
            factoryName: updated.factoryName,
            status: updated.status,
          },
        },
      })
    })

    revalidatePath("/factories")
    revalidatePath(`/factories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "工場の更新に失敗しました",
    }
  }
}

// =============================================================================
// アーカイブ
// =============================================================================
export async function archiveFactory(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.factory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の工場が見つかりません" }
    }
    if (before.status === FactoryStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブされています" }
    }

    const after = await prisma.factory.update({
      where: { id },
      data: { status: FactoryStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "Factory",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/factories")
    revalidatePath(`/factories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 復元
// =============================================================================
export async function restoreFactory(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.factory.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の工場が見つかりません" }
    }
    if (before.status !== FactoryStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブされていない工場は復元できません",
      }
    }

    const after = await prisma.factory.update({
      where: { id },
      data: { status: FactoryStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "Factory",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/factories")
    revalidatePath(`/factories/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "復元に失敗しました",
    }
  }
}

// =============================================================================
// 紐付きチェック
// =============================================================================
export async function checkFactoryUsage(id: string): Promise<FactoryUsage> {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const factory = await prisma.factory.findFirst({
    where: { id, companyId },
  })
  if (!factory) {
    throw new Error("工場が見つかりません")
  }

  // FactoryContact は Cascade 削除されるので、本削除の阻害要因にしない
  // 将来追加: WorkOrder / Product のチェック
  const contactCount = await prisma.factoryContact.count({
    where: { factoryId: id, deletedAt: null },
  })

  return {
    contactCount,
    workOrderCount: 0,
    productCount: 0,
    totalRefs: 0,
  }
}

// =============================================================================
// 物理削除
// =============================================================================
export async function deleteFactoryPermanently(
  id: string,
  confirmationName: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    })
    if (!company || company.tenantType !== "MASTER_ADMIN") {
      return {
        ok: false,
        error: "物理削除は MASTER_ADMIN テナントのみ実行できます",
      }
    }

    const existing = await prisma.factory.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return { ok: false, error: "工場が見つかりません" }
    }

    if (existing.status !== FactoryStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みの工場のみ物理削除できます",
      }
    }

    if (confirmationName.trim() !== existing.factoryName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    await runWithoutTenantContext(async () => {
      await prisma.$transaction(async (tx) => {
        await tx.factoryContact.deleteMany({ where: { factoryId: id } })
        await tx.factory.delete({ where: { id } })
      })
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "DELETE",
        entityType: "Factory",
        entityId: id,
        beforeData: {
          factoryCode: existing.factoryCode,
          factoryName: existing.factoryName,
          status: existing.status,
        },
      },
    })

    revalidatePath("/factories")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
