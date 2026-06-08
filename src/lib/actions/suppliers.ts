"use server"

import { revalidatePath } from "next/cache"
import { Prisma, SupplierStatus, type SupplierType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  supplierInputSchema,
  type SupplierInput,
} from "@/lib/validators/supplier"

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type SupplierUsage = {
  contactCount: number
  // 将来追加するリレーション（PO/Material 等）
  purchaseOrderCount: number
  materialCount: number
  totalRefs: number
}

// =============================================================================
// 一覧取得
// =============================================================================
export type ListSuppliersParams = {
  q?: string
  status?: SupplierStatus
  supplierType?: SupplierType
  page?: number
  pageSize?: number
}

export async function listSuppliers(params: ListSuppliersParams) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.SupplierWhereInput = {
    companyId,
    deletedAt: null,
  }

  if (params.status) {
    where.status = params.status
  }

  if (params.supplierType) {
    where.supplierType = { has: params.supplierType }
  }

  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim()
    where.OR = [
      { companyName: { contains: q, mode: "insensitive" } },
      { companyNameEn: { contains: q, mode: "insensitive" } },
      { supplierCode: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, suppliers] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: [{ status: "asc" }, { supplierCode: "asc" }],
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
    suppliers,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  }
}

// =============================================================================
// 詳細取得
// =============================================================================
export async function getSupplier(id: string) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const supplier = await prisma.supplier.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  })

  if (!supplier) {
    throw new Error("仕入先が見つかりません")
  }

  return supplier
}

// =============================================================================
// 新規作成
// =============================================================================
export async function createSupplier(
  input: SupplierInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = supplierInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.supplier.findFirst({
      where: {
        companyId,
        supplierCode: data.supplierCode,
        deletedAt: null,
      },
    })
    if (existing) {
      return {
        ok: false,
        error: `仕入先コード "${data.supplierCode}" は既に存在します`,
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const s = await tx.supplier.create({
        data: {
          companyId,
          supplierCode: data.supplierCode,
          companyName: data.companyName,
          companyNameEn: data.companyNameEn || null,
          supplierType: data.supplierType,
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
          website: data.website || null,
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
          assignedToUserId: data.assignedToUserId || null,
          notes: data.notes || null,
          status: data.status,
        },
      })

      const contact = data.primaryContact
      const displayName = `${contact.lastName} ${contact.firstName}`.trim()
      await tx.supplierContact.create({
        data: {
          companyId,
          supplierId: s.id,
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
          entityType: "Supplier",
          entityId: s.id,
          afterData: {
            supplierCode: s.supplierCode,
            companyName: s.companyName,
          },
        },
      })

      return s
    })

    revalidatePath("/suppliers")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "仕入先の作成に失敗しました",
    }
  }
}

// =============================================================================
// 更新
// =============================================================================
export async function updateSupplier(
  id: string,
  input: SupplierInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = supplierInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.supplier.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "仕入先が見つかりません" }
    }

    if (data.supplierCode !== existing.supplierCode) {
      const conflict = await prisma.supplier.findFirst({
        where: {
          companyId,
          supplierCode: data.supplierCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `仕入先コード "${data.supplierCode}" は既に存在します`,
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({
        where: { id },
        data: {
          supplierCode: data.supplierCode,
          companyName: data.companyName,
          companyNameEn: data.companyNameEn || null,
          supplierType: data.supplierType,
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
          website: data.website || null,
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
          assignedToUserId: data.assignedToUserId || null,
          notes: data.notes || null,
          status: data.status,
        },
      })

      // 主担当者の更新（既存 isPrimary を更新、無ければ作成）
      const contact = data.primaryContact
      const displayName = `${contact.lastName} ${contact.firstName}`.trim()
      const primary = await tx.supplierContact.findFirst({
        where: { supplierId: id, isPrimary: true, deletedAt: null },
      })
      if (primary) {
        await tx.supplierContact.update({
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
        await tx.supplierContact.create({
          data: {
            companyId,
            supplierId: id,
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
          entityType: "Supplier",
          entityId: id,
          beforeData: {
            supplierCode: existing.supplierCode,
            companyName: existing.companyName,
            status: existing.status,
          },
          afterData: {
            supplierCode: updated.supplierCode,
            companyName: updated.companyName,
            status: updated.status,
          },
        },
      })
    })

    revalidatePath("/suppliers")
    revalidatePath(`/suppliers/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "仕入先の更新に失敗しました",
    }
  }
}

// =============================================================================
// アーカイブ
// =============================================================================
export async function archiveSupplier(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.supplier.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の仕入先が見つかりません" }
    }
    if (before.status === SupplierStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブされています" }
    }

    const after = await prisma.supplier.update({
      where: { id },
      data: { status: SupplierStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "Supplier",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/suppliers")
    revalidatePath(`/suppliers/${id}`)
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
export async function restoreSupplier(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.supplier.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の仕入先が見つかりません" }
    }
    if (before.status !== SupplierStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブされていない仕入先は復元できません",
      }
    }

    const after = await prisma.supplier.update({
      where: { id },
      data: { status: SupplierStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "Supplier",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/suppliers")
    revalidatePath(`/suppliers/${id}`)
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
export async function checkSupplierUsage(id: string): Promise<SupplierUsage> {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const supplier = await prisma.supplier.findFirst({
    where: { id, companyId },
  })
  if (!supplier) {
    throw new Error("仕入先が見つかりません")
  }

  // SupplierContact は Cascade 削除されるので、本削除の阻害要因にしない
  const contactCount = await prisma.supplierContact.count({
    where: { supplierId: id, deletedAt: null },
  })

  // S-4b-1（E8）: 紐づく PO（soft-delete 済みは除外）を実カウント＝物理削除ガード
  const purchaseOrderCount = await prisma.purchaseOrder.count({
    where: { supplierId: id, companyId, deletedAt: null },
  })

  // 将来追加: Material のチェック
  return {
    contactCount,
    purchaseOrderCount,
    materialCount: 0,
    totalRefs: purchaseOrderCount,
  }
}

// =============================================================================
// 物理削除
// =============================================================================
export async function deleteSupplierPermanently(
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

    const existing = await prisma.supplier.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return { ok: false, error: "仕入先が見つかりません" }
    }

    if (existing.status !== SupplierStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みの仕入先のみ物理削除できます",
      }
    }

    if (confirmationName.trim() !== existing.companyName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    await runWithoutTenantContext(async () => {
      await prisma.$transaction(async (tx) => {
        await tx.supplierContact.deleteMany({ where: { supplierId: id } })
        await tx.supplier.delete({ where: { id } })
      })
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "DELETE",
        entityType: "Supplier",
        entityId: id,
        beforeData: {
          supplierCode: existing.supplierCode,
          companyName: existing.companyName,
          status: existing.status,
        },
      },
    })

    revalidatePath("/suppliers")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
