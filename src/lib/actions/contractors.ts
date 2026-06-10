"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  ContractorStatus,
  type ContractorSpecialty,
  type ContractorContractType,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  contractorInputSchema,
  type ContractorInput,
} from "@/lib/validators/contractor"

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type ContractorUsage = {
  contactCount: number
  // 将来追加するリレーション（WO/Product 等）
  workOrderCount: number
  productCount: number
  totalRefs: number
}

// =============================================================================
// Decimal 変換ヘルパー（料金体系用）
// validator は number | null で返すので、Prisma.Decimal に変換する
// =============================================================================
function toDecimalOrNull(v: number | null): Prisma.Decimal | null {
  if (v === null) return null
  return new Prisma.Decimal(v)
}

// =============================================================================
// 一覧取得
// =============================================================================
export type ListContractorsParams = {
  q?: string
  status?: ContractorStatus
  specialty?: ContractorSpecialty
  contractType?: ContractorContractType
  isIndividual?: boolean
  page?: number
  pageSize?: number
}

export async function listContractors(params: ListContractorsParams) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.ContractorWhereInput = {
    companyId,
    deletedAt: null,
  }

  if (params.status) {
    where.status = params.status
  }

  if (params.specialty) {
    where.specialties = { has: params.specialty }
  }

  if (params.contractType) {
    where.contractType = params.contractType
  }

  if (typeof params.isIndividual === "boolean") {
    where.isIndividual = params.isIndividual
  }

  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim()
    where.OR = [
      { contractorName: { contains: q, mode: "insensitive" } },
      { contractorNameEn: { contains: q, mode: "insensitive" } },
      { contractorCode: { contains: q, mode: "insensitive" } },
    ]
  }

  const [total, contractors] = await Promise.all([
    prisma.contractor.count({ where }),
    prisma.contractor.findMany({
      where,
      orderBy: [{ status: "asc" }, { contractorCode: "asc" }],
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
    contractors,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  }
}

// =============================================================================
// 詳細取得
// =============================================================================
export async function getContractor(id: string) {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const contractor = await prisma.contractor.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      contacts: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  })

  if (!contractor) {
    throw new Error("外注先が見つかりません")
  }

  return contractor
}

// =============================================================================
// 新規作成
// =============================================================================
export async function createContractor(
  input: ContractorInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = contractorInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.contractor.findFirst({
      where: {
        companyId,
        contractorCode: data.contractorCode,
        deletedAt: null,
      },
    })
    if (existing) {
      return {
        ok: false,
        error: `外注先コード "${data.contractorCode}" は既に存在します`,
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.contractor.create({
        data: {
          companyId,
          contractorCode: data.contractorCode,
          contractorName: data.contractorName,
          contractorNameEn: data.contractorNameEn || null,
          isIndividual: data.isIndividual,
          specialties: data.specialties,
          contractType: data.contractType,
          packageFee: toDecimalOrNull(data.packageFee),
          hourlyRate: toDecimalOrNull(data.hourlyRate),
          monthlyFee: toDecimalOrNull(data.monthlyFee),
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
          assignedToUserId: data.assignedToUserId || null,
          notes: data.notes || null,
          status: data.status,
        },
      })

      // 主担当作成は法人（isIndividual === false）かつ姓名入力ありのときのみ
      const contact = data.primaryContact
      const shouldCreateContact =
        data.isIndividual === false &&
        contact.firstName !== "" &&
        contact.lastName !== ""
      if (shouldCreateContact) {
        const displayName = `${contact.lastName} ${contact.firstName}`.trim()
        await tx.contractorContact.create({
          data: {
            companyId,
            contractorId: c.id,
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
          action: "CREATE",
          entityType: "Contractor",
          entityId: c.id,
          afterData: {
            contractorCode: c.contractorCode,
            contractorName: c.contractorName,
          },
        },
      })

      return c
    })

    revalidatePath("/contractors")
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "外注先の作成に失敗しました",
    }
  }
}

// =============================================================================
// 更新
// =============================================================================
export async function updateContractor(
  id: string,
  input: ContractorInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const parsed = contractorInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      }
    }
    const data = parsed.data

    const existing = await prisma.contractor.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "外注先が見つかりません" }
    }

    if (data.contractorCode !== existing.contractorCode) {
      const conflict = await prisma.contractor.findFirst({
        where: {
          companyId,
          contractorCode: data.contractorCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (conflict) {
        return {
          ok: false,
          error: `外注先コード "${data.contractorCode}" は既に存在します`,
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.contractor.update({
        where: { id },
        data: {
          contractorCode: data.contractorCode,
          contractorName: data.contractorName,
          contractorNameEn: data.contractorNameEn || null,
          isIndividual: data.isIndividual,
          specialties: data.specialties,
          contractType: data.contractType,
          packageFee: toDecimalOrNull(data.packageFee),
          hourlyRate: toDecimalOrNull(data.hourlyRate),
          monthlyFee: toDecimalOrNull(data.monthlyFee),
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
          assignedToUserId: data.assignedToUserId || null,
          notes: data.notes || null,
          status: data.status,
        },
      })

      // 主担当の更新ロジック
      // - isIndividual === true: 既存の主担当があれば論理削除（個人事業主は主担当不要）
      // - isIndividual === false かつ姓名入力あり: 主担当を upsert（既存があれば更新、なければ作成）
      // - isIndividual === false かつ姓名入力なし: validator で弾かれるのでここには来ない
      const contact = data.primaryContact
      const primary = await tx.contractorContact.findFirst({
        where: { contractorId: id, isPrimary: true, deletedAt: null },
      })

      if (data.isIndividual === true) {
        // 個人事業主に切り替えた場合は既存主担当を論理削除
        if (primary) {
          await tx.contractorContact.update({
            where: { id: primary.id },
            data: { deletedAt: new Date(), isPrimary: false },
          })
        }
      } else {
        const displayName = `${contact.lastName} ${contact.firstName}`.trim()
        if (primary) {
          await tx.contractorContact.update({
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
          await tx.contractorContact.create({
            data: {
              companyId,
              contractorId: id,
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
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: "UPDATE",
          entityType: "Contractor",
          entityId: id,
          beforeData: {
            contractorCode: existing.contractorCode,
            contractorName: existing.contractorName,
            status: existing.status,
          },
          afterData: {
            contractorCode: updated.contractorCode,
            contractorName: updated.contractorName,
            status: updated.status,
          },
        },
      })
    })

    revalidatePath("/contractors")
    revalidatePath(`/contractors/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "外注先の更新に失敗しました",
    }
  }
}

// =============================================================================
// アーカイブ
// =============================================================================
export async function archiveContractor(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.contractor.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の外注先が見つかりません" }
    }
    if (before.status === ContractorStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブされています" }
    }

    const after = await prisma.contractor.update({
      where: { id },
      data: { status: ContractorStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "Contractor",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/contractors")
    revalidatePath(`/contractors/${id}`)
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
export async function restoreContractor(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth()
    if (!session?.user) return { ok: false, error: "認証が必要です" }
    const companyId = session.user.companyId
    const userId = session.user.id
    if (!companyId || !userId)
      return { ok: false, error: "テナント情報が取得できません" }

    const before = await prisma.contractor.findFirst({
      where: { id, companyId, deletedAt: null },
    })
    if (!before) {
      return { ok: false, error: "対象の外注先が見つかりません" }
    }
    if (before.status !== ContractorStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブされていない外注先は復元できません",
      }
    }

    const after = await prisma.contractor.update({
      where: { id },
      data: { status: ContractorStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "UPDATE",
        entityType: "Contractor",
        entityId: id,
        beforeData: { status: before.status },
        afterData: { status: after.status },
      },
    })

    revalidatePath("/contractors")
    revalidatePath(`/contractors/${id}`)
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
export async function checkContractorUsage(id: string): Promise<ContractorUsage> {
  const session = await auth()
  if (!session?.user) throw new Error("認証が必要です")
  const companyId = session.user.companyId
  if (!companyId) throw new Error("テナント情報が取得できません")

  const contractor = await prisma.contractor.findFirst({
    where: { id, companyId },
  })
  if (!contractor) {
    throw new Error("外注先が見つかりません")
  }

  // ContractorContact は Cascade 削除されるので、本削除の阻害要因にしない
  const contactCount = await prisma.contractorContact.count({
    where: { contractorId: id, deletedAt: null },
  })

  // S-4b-2(E8): この外注先宛の作業発注（soft-delete 済みを除く）を実値化
  const workOrderCount = await prisma.workOrder.count({
    where: { companyId, contractorId: id, deletedAt: null },
  })

  return {
    contactCount,
    workOrderCount,
    productCount: 0,
    // 本削除ガード対象は WorkOrder（+ 将来 Product）。Contact は Cascade のため除外。
    totalRefs: workOrderCount,
  }
}

// =============================================================================
// 物理削除
// =============================================================================
export async function deleteContractorPermanently(
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

    const existing = await prisma.contractor.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return { ok: false, error: "外注先が見つかりません" }
    }

    if (existing.status !== ContractorStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みの外注先のみ物理削除できます",
      }
    }

    if (confirmationName.trim() !== existing.contractorName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    await runWithoutTenantContext(async () => {
      await prisma.$transaction(async (tx) => {
        await tx.contractorContact.deleteMany({ where: { contractorId: id } })
        await tx.contractor.delete({ where: { id } })
      })
    })

    await prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: "DELETE",
        entityType: "Contractor",
        entityId: id,
        beforeData: {
          contractorCode: existing.contractorCode,
          contractorName: existing.contractorName,
          status: existing.status,
        },
      },
    })

    revalidatePath("/contractors")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
