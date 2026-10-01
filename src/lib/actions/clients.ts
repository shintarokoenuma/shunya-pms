"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withTenantContext } from "@/lib/with-tenant"
import { requireTenantContext, runWithoutTenantContext } from "@/lib/tenant-context"
import { writeAuditLog } from "@/lib/audit-log"
import { getEffectiveCompanyId } from "@/lib/tenant-context"
import type { z } from "zod"
import {
  createClientSchema,
  listClientsQuerySchema,
  primaryContactSchema,
  updateClientSchema,
  type CreateClientInput,
  type ListClientsQuery,
  type UpdateClientInput,
} from "@/lib/validators/client"

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

function normalizeForDb<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = { ...data }
  const stringFields = [
    "legalEntity",
    "phone",
    "email",
    "website",
    "address",
    "addressLine2",
    "billingPostalCode",
    "billingPrefecture",
    "billingCity",
    "billingAddress",
    "billingAddressLine2",
    "shippingPostalCode",
    "shippingPrefecture",
    "shippingCity",
    "shippingAddress",
    "shippingAddressLine2",
    "referrer",
    "notes",
    "taxId", // B-109 PR-2a: 空欄は null で保存（列は nullable）
    // B-252: 必須を外した項目も空欄は null で保存
    "postalCode",
    "prefecture",
    "city",
    "assignedToUserId", // D-5: 空は null（FK なので "" は入れない）
  ] as const
  for (const f of stringFields) {
    const v = result[f]
    if (typeof v === "string") {
      const trimmed = v.trim()
      result[f] = trimmed === "" ? null : trimmed
    }
  }
  return result as T
}

type PrimaryContactParsed = z.output<typeof primaryContactSchema>

/** B-252（D-4）: 姓か名のどちらかがあれば主担当の行を作る。両方空なら作らない（編集では既存を論理削除） */
function hasContactName(c: PrimaryContactParsed): boolean {
  return c.firstName.trim() !== "" || c.lastName.trim() !== ""
}

function normalizeContactForDb(c: PrimaryContactParsed) {
  const nz = (v: string | undefined) => ((v ?? "").trim() === "" ? null : (v ?? "").trim())
  return {
    firstName: c.firstName.trim(),
    lastName: c.lastName.trim(),
    displayName: `${c.lastName.trim()} ${c.firstName.trim()}`.trim(),
    email: nz(c.email),
    phone: nz(c.phone),
    jobTitle: nz(c.jobTitle),
    department: nz(c.department),
    isPrimary: true,
  }
}

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
    const cid = getEffectiveCompanyId()
    const [items, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * perPage,
        take: perPage,
        // B-252（D-7）: 一覧で「未入力」を出すために主担当の有無を取る（companyId・deletedAt: null を手書き）
        include: {
          contacts: {
            where: { companyId: cid, isPrimary: true, deletedAt: null },
            select: { id: true },
            take: 1,
          },
        },
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

export async function getClient(id: string) {
  return withTenantContext(async () => {
    return prisma.client.findUnique({
      where: { id },
      include: {
        contacts: {
          where: { isPrimary: true, deletedAt: null },
          take: 1,
        },
      },
    })
  })
}

export async function createClient(
  input: CreateClientInput
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const parsed = createClientSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: "入力内容に誤りがあります",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }
    }
    const {
      primaryContact,
      useSeparateBillingAddress,
      useSeparateShippingAddress,
      ...rest
    } = parsed.data

    // トグルOFFのときは billing*/shipping* を強制的に空文字に（normalizeForDb で null 化される）
    if (!useSeparateBillingAddress) {
      rest.billingPostalCode = ""
      rest.billingPrefecture = ""
      rest.billingCity = ""
      rest.billingAddress = ""
      rest.billingAddressLine2 = ""
    }
    if (!useSeparateShippingAddress) {
      rest.shippingPostalCode = ""
      rest.shippingPrefecture = ""
      rest.shippingCity = ""
      rest.shippingAddress = ""
      rest.shippingAddressLine2 = ""
    }

    const data = normalizeForDb(rest)
    const contactData = normalizeContactForDb(primaryContact)
    const cid = getEffectiveCompanyId()

    const exists = await prisma.client.findFirst({
      where: { clientCode: data.clientCode as string },
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
      const created = await prisma.client.create({
        data: data as unknown as Prisma.ClientUncheckedCreateInput,
      })

      // B-252（D-4）: 姓も名も空なら主担当は作らない
      if (hasContactName(primaryContact)) {
        const contact = await prisma.clientContact.create({
          data: {
            ...contactData,
            companyId: cid,
            clientId: created.id,
          } as Prisma.ClientContactUncheckedCreateInput,
        })

        await prisma.client.update({
          where: { id: created.id },
          data: { primaryContactId: contact.id },
        })
      }

      await writeAuditLog({
        action: "CREATE",
        entityType: "Client",
        entityId: created.id,
        afterData: {
          clientCode: created.clientCode,
          companyName: created.companyName,
        },
        description: `クライアント新規作成: ${created.companyName}`,
      })

      revalidatePath("/clients")
      return { ok: true, data: { id: created.id } }
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
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
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }
    }
    const {
      primaryContact,
      useSeparateBillingAddress,
      useSeparateShippingAddress,
      ...rest
    } = parsed.data

    // トグルOFFのときは billing*/shipping* を強制的に空文字に
    if (!useSeparateBillingAddress) {
      rest.billingPostalCode = ""
      rest.billingPrefecture = ""
      rest.billingCity = ""
      rest.billingAddress = ""
      rest.billingAddressLine2 = ""
    }
    if (!useSeparateShippingAddress) {
      rest.shippingPostalCode = ""
      rest.shippingPrefecture = ""
      rest.shippingCity = ""
      rest.shippingAddress = ""
      rest.shippingAddressLine2 = ""
    }

    const data = normalizeForDb(rest)
    const contactData = normalizeContactForDb(primaryContact)
    const cid = getEffectiveCompanyId()

    const before = await prisma.client.findUnique({
      where: { id },
      include: {
        contacts: {
          where: { isPrimary: true, deletedAt: null },
          take: 1,
        },
      },
    })
    if (!before) {
      return { ok: false, error: "対象のクライアントが見つかりません" }
    }

    if (data.clientCode && data.clientCode !== before.clientCode) {
      const exists = await prisma.client.findFirst({
        where: { clientCode: data.clientCode as string },
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
      const after = await prisma.client.update({
        where: { id },
        data: data as unknown as Prisma.ClientUncheckedUpdateInput,
      })

      const existingContact = before.contacts[0]
      let contactId: string | null
      if (!hasContactName(primaryContact)) {
        // B-252（D-4）: 姓も名も空にしたら既存の主担当を論理削除し、primaryContactId を外す
        if (existingContact) {
          await prisma.clientContact.update({
            where: { id: existingContact.id },
            data: { deletedAt: new Date(), isPrimary: false },
          })
        }
        contactId = null
      } else if (existingContact) {
        const updatedContact = await prisma.clientContact.update({
          where: { id: existingContact.id },
          data: contactData,
        })
        contactId = updatedContact.id
      } else {
        const newContact = await prisma.clientContact.create({
          data: {
            ...contactData,
            companyId: cid,
            clientId: id,
          } as Prisma.ClientContactUncheckedCreateInput,
        })
        contactId = newContact.id
      }

      if (after.primaryContactId !== contactId) {
        await prisma.client.update({
          where: { id },
          data: { primaryContactId: contactId },
        })
      }

      await writeAuditLog({
        action: "UPDATE",
        entityType: "Client",
        entityId: id,
        beforeData: {
          clientCode: before.clientCode,
          companyName: before.companyName,
          status: before.status,
          // B-109 PR-2a: 端数処理・適格事業者・登録番号の変更を記録に残す（D-35 で辿る前提）
          taxRoundingMode: before.taxRoundingMode,
          isQualifiedInvoiceIssuer: before.isQualifiedInvoiceIssuer,
          taxId: before.taxId,
        },
        afterData: {
          clientCode: after.clientCode,
          companyName: after.companyName,
          status: after.status,
          taxRoundingMode: after.taxRoundingMode,
          isQualifiedInvoiceIssuer: after.isQualifiedInvoiceIssuer,
          taxId: after.taxId,
        },
        description: `クライアント編集: ${after.companyName}`,
      })

      revalidatePath("/clients")
      revalidatePath(`/clients/${id}`)
      return { ok: true, data: { id } }
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
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

export async function archiveClient(
  id: string
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const before = await prisma.client.findUnique({ where: { id } })
    if (!before) {
      return { ok: false, error: "対象のクライアントが見つかりません" }
    }

    if (before.status === "ARCHIVED") {
      return { ok: false, error: "既にアーカイブされています" }
    }

    await prisma.client.update({
      where: { id },
      data: { status: "ARCHIVED" },
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "Client",
      entityId: id,
      beforeData: { status: before.status },
      afterData: { status: "ARCHIVED" },
      description: `クライアントアーカイブ: ${before.companyName}`,
    })

    revalidatePath("/clients")
    revalidatePath(`/clients/${id}`)
    return { ok: true, data: { id } }
  })
}

export async function restoreClient(
  id: string
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const before = await prisma.client.findUnique({ where: { id } })
    if (!before) {
      return { ok: false, error: "対象のクライアントが見つかりません" }
    }

    if (before.status !== "ARCHIVED") {
      return {
        ok: false,
        error: "アーカイブされていないクライアントは復元できません",
      }
    }

    await prisma.client.update({
      where: { id },
      data: { status: "ACTIVE" },
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "Client",
      entityId: id,
      beforeData: { status: "ARCHIVED" },
      afterData: { status: "ACTIVE" },
      description: `クライアント復元: ${before.companyName}`,
    })

    revalidatePath("/clients")
    revalidatePath(`/clients/${id}`)
    return { ok: true, data: { id } }
  })
}

export type ClientUsage = {
  brandCount: number
  inquiryCount: number
  productCount: number
  totalRefs: number
}

export async function checkClientUsage(id: string): Promise<ClientUsage> {
  return withTenantContext(async () => {
    const [brandCount, inquiryCount, productCount] = await Promise.all([
      prisma.brand.count({ where: { clientId: id } }),
      prisma.inquiry.count({ where: { existingClientId: id } }),
      prisma.product.count({ where: { clientId: id } }),
    ])
    return {
      brandCount,
      inquiryCount,
      productCount,
      totalRefs: brandCount + inquiryCount + productCount,
    }
  })
}

export async function deleteClientPermanently(
  id: string,
  confirmName: string
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const ctx = requireTenantContext()
    if (ctx.tenantType !== "MASTER_ADMIN") {
      return { ok: false, error: "本削除は MASTER_ADMIN のみ実行できます" }
    }

    const before = await prisma.client.findUnique({ where: { id } })
    if (!before) {
      return { ok: false, error: "対象のクライアントが見つかりません" }
    }

    if (before.status !== "ARCHIVED") {
      return {
        ok: false,
        error: "アーカイブ済みのクライアントのみ本削除できます",
      }
    }

    if (confirmName.trim() !== before.companyName) {
      return { ok: false, error: "入力された会社名が一致しません" }
    }

    const [brandCount, inquiryCount, productCount] = await Promise.all([
      prisma.brand.count({ where: { clientId: id } }),
      prisma.inquiry.count({ where: { existingClientId: id } }),
      prisma.product.count({ where: { clientId: id } }),
    ])

    if (brandCount + inquiryCount + productCount > 0) {
      const parts: string[] = []
      if (brandCount > 0) parts.push(`ブランド: ${brandCount} 件`)
      if (inquiryCount > 0) parts.push(`問い合わせ: ${inquiryCount} 件`)
      if (productCount > 0) parts.push(`品番: ${productCount} 件`)
      return {
        ok: false,
        error: `紐付くデータがあるため削除できません（${parts.join("、")}）`,
      }
    }

    await writeAuditLog({
      action: "DELETE",
      entityType: "Client",
      entityId: id,
      beforeData: {
        clientCode: before.clientCode,
        companyName: before.companyName,
        status: before.status,
      },
      description: `クライアント本削除: ${before.companyName}（${before.clientCode}）`,
    })

    await runWithoutTenantContext(async () => {
      await prisma.client.delete({ where: { id } })
    })

    revalidatePath("/clients")
    return { ok: true, data: { id } }
  })
}

export async function listAssignableUsers() {
  return withTenantContext(async () => {
    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        isExternalUser: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
      },
      orderBy: { createdAt: "asc" },
    })
    return users.map((u) => ({
      id: u.id,
      name: u.displayName ?? `${u.lastName} ${u.firstName}`,
      email: u.email,
    }))
  })
}
