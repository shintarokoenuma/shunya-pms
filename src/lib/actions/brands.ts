"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withTenantContext } from "@/lib/with-tenant"
import { writeAuditLog } from "@/lib/audit-log"
import { requireTenantContext, runWithoutTenantContext } from "@/lib/tenant-context"
import {
  createBrandSchema,
  listBrandsQuerySchema,
  updateBrandSchema,
  type CreateBrandInput,
  type ListBrandsQuery,
  type UpdateBrandInput,
} from "@/lib/validators/brand"

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

/** brandColors JSON 構築（main のみ） */
function buildBrandColors(mainColorHex: string): Prisma.InputJsonValue | null {
  const v = mainColorHex.trim()
  if (v === "") return null
  return { main: v }
}

function normalizeForDb<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = { ...data }
  const stringFields = ["brandNameEn", "logoUrl", "concept"] as const
  for (const f of stringFields) {
    const v = result[f]
    if (typeof v === "string") {
      const trimmed = v.trim()
      result[f] = trimmed === "" ? null : trimmed
    }
  }
  return result as T
}

// =============================================================================
// 一覧取得
// =============================================================================

export async function listBrands(rawQuery: ListBrandsQuery = {}) {
  return withTenantContext(async () => {
    const parsed = listBrandsQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
      return {
        items: [],
        total: 0,
        page: 1,
        perPage: 20,
        totalPages: 0,
      }
    }
    const { q, status, clientId, sort, order, page, perPage } = parsed.data
    const where: Prisma.BrandWhereInput = {
      ...(status && { status }),
      ...(clientId && { clientId }),
      ...(q && {
        OR: [
          { brandName: { contains: q, mode: "insensitive" } },
          { brandCode: { contains: q, mode: "insensitive" } },
          { brandNameEn: { contains: q, mode: "insensitive" } },
        ],
      }),
    }
    const [items, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
        },
      }),
      prisma.brand.count({ where }),
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

export async function getBrand(id: string) {
  return withTenantContext(async () => {
    return prisma.brand.findUnique({
      where: { id },
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
  })
}

// =============================================================================
// 新規作成
// =============================================================================

export async function createBrand(
  input: CreateBrandInput
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const parsed = createBrandSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: "入力内容に誤りがあります",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    const { mainColorHex, ...rest } = parsed.data
    const data = normalizeForDb(rest)
    const brandColors = buildBrandColors(mainColorHex)

    const exists = await prisma.brand.findFirst({
      where: { brandCode: data.brandCode as string },
    })
    if (exists) {
      return {
        ok: false,
        error: `ブランドコード「${data.brandCode}」は既に使用されています`,
        fieldErrors: {
          brandCode: ["このコードは既に使用されています"],
        },
      }
    }

    try {
      const created = await prisma.brand.create({
        data: {
          ...data,
          brandColors: brandColors as Prisma.InputJsonValue | undefined,
        } as unknown as Prisma.BrandUncheckedCreateInput,
      })

      await writeAuditLog({
        action: "CREATE",
        entityType: "Brand",
        entityId: created.id,
        afterData: {
          brandCode: created.brandCode,
          brandName: created.brandName,
          clientId: created.clientId,
        },
        description: `ブランド新規作成: ${created.brandName}`,
      })

      revalidatePath("/brands")
      revalidatePath(`/clients/${created.clientId}`)
      return { ok: true, data: { id: created.id } }
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return {
          ok: false,
          error: "ブランドコードが重複しています",
          fieldErrors: { brandCode: ["このコードは既に使用されています"] },
        }
      }
      throw e
    }
  })
}

// =============================================================================
// 編集
// =============================================================================

export async function updateBrand(
  id: string,
  input: UpdateBrandInput
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const parsed = updateBrandSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: "入力内容に誤りがあります",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    const { mainColorHex, ...rest } = parsed.data
    const data = normalizeForDb(rest)
    const brandColors = buildBrandColors(mainColorHex)

    const before = await prisma.brand.findUnique({ where: { id } })
    if (!before) {
      return { ok: false, error: "対象のブランドが見つかりません" }
    }

    if (data.brandCode && data.brandCode !== before.brandCode) {
      const exists = await prisma.brand.findFirst({
        where: { brandCode: data.brandCode as string },
      })
      if (exists) {
        return {
          ok: false,
          error: `ブランドコード「${data.brandCode}」は既に使用されています`,
          fieldErrors: {
            brandCode: ["このコードは既に使用されています"],
          },
        }
      }
    }

    try {
      const after = await prisma.brand.update({
        where: { id },
        data: {
          ...data,
          brandColors: brandColors as Prisma.InputJsonValue | undefined,
        } as unknown as Prisma.BrandUncheckedUpdateInput,
      })

      await writeAuditLog({
        action: "UPDATE",
        entityType: "Brand",
        entityId: id,
        beforeData: {
          brandCode: before.brandCode,
          brandName: before.brandName,
          status: before.status,
        },
        afterData: {
          brandCode: after.brandCode,
          brandName: after.brandName,
          status: after.status,
        },
        description: `ブランド編集: ${after.brandName}`,
      })

      revalidatePath("/brands")
      revalidatePath(`/brands/${id}`)
      revalidatePath(`/clients/${after.clientId}`)
      return { ok: true, data: { id } }
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return {
          ok: false,
          error: "ブランドコードが重複しています",
          fieldErrors: { brandCode: ["このコードは既に使用されています"] },
        }
      }
      throw e
    }
  })
}

// =============================================================================
// アーカイブ（status のみ ARCHIVED に。deletedAt は触らない）
// =============================================================================

export async function archiveBrand(
  id: string
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const before = await prisma.brand.findUnique({ where: { id } })
    if (!before) {
      return { ok: false, error: "対象のブランドが見つかりません" }
    }

    if (before.status === "ARCHIVED") {
      return { ok: false, error: "既にアーカイブされています" }
    }

    await prisma.brand.update({
      where: { id },
      data: { status: "ARCHIVED" },
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "Brand",
      entityId: id,
      beforeData: { status: before.status },
      afterData: { status: "ARCHIVED" },
      description: `ブランドアーカイブ: ${before.brandName}`,
    })

    revalidatePath("/brands")
    revalidatePath(`/brands/${id}`)
    revalidatePath(`/clients/${before.clientId}`)
    return { ok: true, data: { id } }
  })
}

// =============================================================================
// 復元（ARCHIVED → ACTIVE）
// =============================================================================

export async function restoreBrand(
  id: string
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const before = await prisma.brand.findUnique({ where: { id } })
    if (!before) {
      return { ok: false, error: "対象のブランドが見つかりません" }
    }

    if (before.status !== "ARCHIVED") {
      return { ok: false, error: "アーカイブされていないブランドは復元できません" }
    }

    await prisma.brand.update({
      where: { id },
      data: { status: "ACTIVE" },
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "Brand",
      entityId: id,
      beforeData: { status: "ARCHIVED" },
      afterData: { status: "ACTIVE" },
      description: `ブランド復元: ${before.brandName}`,
    })

    revalidatePath("/brands")
    revalidatePath(`/brands/${id}`)
    revalidatePath(`/clients/${before.clientId}`)
    return { ok: true, data: { id } }
  })
}

// =============================================================================
// 紐付き調査（本削除の事前チェック）
// =============================================================================

export type BrandUsage = {
  modelCodeCount: number
  productCount: number
  totalRefs: number
}

export async function checkBrandUsage(id: string): Promise<BrandUsage> {
  return withTenantContext(async () => {
    const [modelCodeCount, productCount] = await Promise.all([
      prisma.modelCode.count({ where: { brandId: id } }),
      prisma.product.count({ where: { brandId: id } }),
    ])
    return {
      modelCodeCount,
      productCount,
      totalRefs: modelCodeCount + productCount,
    }
  })
}

// =============================================================================
// 本削除（MASTER_ADMIN のみ、アーカイブ済みのみ、紐付き0件のみ）
// =============================================================================

export async function deleteBrandPermanently(
  id: string,
  confirmName: string
): Promise<ActionResult<{ id: string }>> {
  return withTenantContext(async () => {
    const ctx = requireTenantContext()
    if (ctx.tenantType !== "MASTER_ADMIN") {
      return { ok: false, error: "本削除は MASTER_ADMIN のみ実行できます" }
    }

    const before = await prisma.brand.findUnique({ where: { id } })
    if (!before) {
      return { ok: false, error: "対象のブランドが見つかりません" }
    }

    if (before.status !== "ARCHIVED") {
      return {
        ok: false,
        error: "アーカイブ済みのブランドのみ本削除できます",
      }
    }

    // ブランド名確認
    if (confirmName.trim() !== before.brandName) {
      return {
        ok: false,
        error: "入力されたブランド名が一致しません",
      }
    }

    // 紐付きチェック
    const [modelCodeCount, productCount] = await Promise.all([
      prisma.modelCode.count({ where: { brandId: id } }),
      prisma.product.count({ where: { brandId: id } }),
    ])
    if (modelCodeCount > 0 || productCount > 0) {
      return {
        ok: false,
        error: `紐付くデータがあるため削除できません（モデルコード: ${modelCodeCount} 件、品番: ${productCount} 件）`,
      }
    }

    // AuditLog 先に書く（削除後は entityId のリレーションが切れるため）
    await writeAuditLog({
      action: "DELETE",
      entityType: "Brand",
      entityId: id,
      beforeData: {
        brandCode: before.brandCode,
        brandName: before.brandName,
        clientId: before.clientId,
        status: before.status,
      },
      description: `ブランド本削除: ${before.brandName}（${before.brandCode}）`,
    })

    // 物理削除（Extension の bypass を使う）
    await runWithoutTenantContext(async () => {
      await prisma.brand.delete({ where: { id } })
    })

    revalidatePath("/brands")
    revalidatePath(`/clients/${before.clientId}`)
    return { ok: true, data: { id } }
  })
}

// =============================================================================
// クライアント選択用：自テナントの Client 一覧
// =============================================================================

export async function listClientsForBrand() {
  return withTenantContext(async () => {
    return prisma.client.findMany({
      where: {
        status: { in: ["ACTIVE", "PROSPECT"] },
        deletedAt: null,
      },
      select: {
        id: true,
        clientCode: true,
        companyName: true,
      },
      orderBy: { companyName: "asc" },
    })
  })
}

// =============================================================================
// クライアント詳細用：特定クライアントのブランド一覧
// =============================================================================

export async function listBrandsByClient(clientId: string) {
  return withTenantContext(async () => {
    return prisma.brand.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
    })
  })
}
