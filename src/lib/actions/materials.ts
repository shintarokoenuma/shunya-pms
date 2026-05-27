"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  MaterialStatus,
  MaterialType,
  SupplierStatus,
  type Material,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { runWithoutTenantContext } from "@/lib/tenant-context"
import {
  materialBaseSchema,
  type MaterialInput,
} from "@/lib/validators/material"

/**
 * Phase 1A-13a: 素材（Material）Server Actions
 *
 * 設計方針（spec 2026-05-27）:
 * - shunya-master-patterns v1.2 §5 標準の 8 関数構成
 * - 段階的実装：基本コアフィールドのみ。生地特有 / 規格 / 貿易 / 画像 / 色展開 /
 *   多言語（Zh/Vi）は Phase 1A-13b/13c で追加
 * - materialCode は手動入力（自動採番なし）
 *
 * Prisma スキーマ事情：
 * - Material.primarySupplierId は FK 列が存在するが、Prisma の relation も
 *   DB FK 制約も未定義（ModelCode の brandId と同じ穴）
 *   → Phase 1A-13a ではスキーマ変更を避けるため、Supplier は別クエリで join
 * - Material.categoryId は MaterialCategory への relation 定義済みだが、
 *   MaterialCategory 未実装のため Phase 1A-13a では Select disabled
 *
 * checkUsage の現状:
 * - BomItem / ProductMaterial / 在庫系などが materialId で参照する設計だが、
 *   Phase 1A はそれらが未実装。常に totalRefs: 0 を返す
 * - Phase 1B 以降で対応する各 transaction の count を加算する
 */

// =============================================================================
// 戻り値の型
// =============================================================================
export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

export type MaterialUsage = {
  // Phase 1B 以降で BOM / ProductMaterial / 在庫の参照件数を追加
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
// 補助 1: フォーム / 一覧の Supplier セレクト用に ACTIVE な Supplier 候補を返す
// =============================================================================
export type SupplierOptionForMaterial = {
  id: string
  supplierCode: string
  companyName: string
}

export async function listActiveSuppliersForMaterialSelect(): Promise<
  SupplierOptionForMaterial[]
> {
  const sess = await requireSession()
  if (!sess.ok) return []

  const rows = await prisma.supplier.findMany({
    where: {
      companyId: sess.companyId,
      deletedAt: null,
      status: SupplierStatus.ACTIVE,
    },
    select: { id: true, supplierCode: true, companyName: true },
    orderBy: [{ supplierCode: "asc" }],
  })
  return rows
}

// =============================================================================
// 補助 2: Supplier サマリ（一覧 / 詳細で manual join するための型）
// =============================================================================
export type SupplierSummary = {
  id: string
  supplierCode: string
  companyName: string
}

async function fetchSupplierSummariesByIds(
  companyId: string,
  supplierIds: string[],
): Promise<Map<string, SupplierSummary>> {
  if (supplierIds.length === 0) return new Map()
  const rows = await prisma.supplier.findMany({
    where: { id: { in: supplierIds }, companyId },
    select: { id: true, supplierCode: true, companyName: true },
  })
  return new Map(rows.map((r) => [r.id, r]))
}

// =============================================================================
// 1. 一覧取得
// =============================================================================
export type ListMaterialsParams = {
  q?: string
  materialType?: MaterialType
  primarySupplierId?: string
  status?: MaterialStatus
  page?: number
  pageSize?: number
}

type MaterialListBaseRow = Pick<
  Material,
  | "id"
  | "materialCode"
  | "materialName"
  | "materialNameEn"
  | "materialType"
  | "primarySupplierId"
  | "unitPrice"
  | "currency"
  | "unit"
  | "status"
  | "createdAt"
  | "updatedAt"
>

export type MaterialListItem = MaterialListBaseRow & {
  supplier: SupplierSummary | null
}

export async function listMaterials(
  params: ListMaterialsParams = {},
): Promise<
  ActionResult<{
    items: MaterialListItem[]
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

    const where: Prisma.MaterialWhereInput = {
      companyId: sess.companyId,
      deletedAt: null,
    }
    if (params.status) where.status = params.status
    if (params.materialType) where.materialType = params.materialType
    if (params.primarySupplierId)
      where.primarySupplierId = params.primarySupplierId
    if (q.length > 0) {
      where.OR = [
        { materialCode: { contains: q, mode: "insensitive" } },
        { materialName: { contains: q, mode: "insensitive" } },
        { materialNameEn: { contains: q, mode: "insensitive" } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.material.findMany({
        where,
        select: {
          id: true,
          materialCode: true,
          materialName: true,
          materialNameEn: true,
          materialType: true,
          primarySupplierId: true,
          unitPrice: true,
          currency: true,
          unit: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ materialCode: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.material.count({ where }),
    ])

    const supplierIds = [
      ...new Set(rows.map((r) => r.primarySupplierId).filter((v): v is string => !!v)),
    ]
    const supplierMap = await fetchSupplierSummariesByIds(
      sess.companyId,
      supplierIds,
    )

    const items: MaterialListItem[] = rows.map((r) => ({
      ...r,
      supplier: r.primarySupplierId
        ? supplierMap.get(r.primarySupplierId) ?? null
        : null,
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
// 2. 詳細取得
// =============================================================================
export type MaterialDetail = Material & { supplier: SupplierSummary | null }

export async function getMaterial(
  id: string,
): Promise<
  | { ok: true; data: MaterialDetail }
  | { ok: false; error: string }
> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const row = await prisma.material.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!row) {
      return { ok: false, error: "素材が見つかりません" }
    }

    const supplierMap = row.primarySupplierId
      ? await fetchSupplierSummariesByIds(sess.companyId, [row.primarySupplierId])
      : new Map<string, SupplierSummary>()

    return {
      ok: true,
      data: {
        ...row,
        supplier: row.primarySupplierId
          ? supplierMap.get(row.primarySupplierId) ?? null
          : null,
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
// 3. 新規作成
// =============================================================================
export async function createMaterial(
  input: MaterialInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = materialBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    // materialCode 重複チェック
    const dup = await prisma.material.findFirst({
      where: {
        companyId: sess.companyId,
        materialCode: data.materialCode,
        deletedAt: null,
      },
    })
    if (dup) {
      return {
        ok: false,
        error: `素材コード "${data.materialCode}" は既に使用されています`,
      }
    }

    // primarySupplierId 存在チェック
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: data.primarySupplierId,
        companyId: sess.companyId,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!supplier) {
      return { ok: false, error: "指定された仕入先が見つかりません" }
    }

    const created = await prisma.material.create({
      data: {
        companyId: sess.companyId,
        materialCode: data.materialCode,
        materialName: data.materialName,
        materialNameEn: data.materialNameEn || null,
        materialType: data.materialType,
        categoryId: data.categoryId,
        primarySupplierId: data.primarySupplierId,
        unitPrice: data.unitPrice,
        currency: data.currency,
        unit: data.unit,
        minimumOrderQty: data.minimumOrderQty,
        specification: data.specification || null,
        notes: data.notes || null,
        status: data.status,
      },
      select: { id: true },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "Material",
        entityId: created.id,
        afterData: {
          materialCode: data.materialCode,
          materialName: data.materialName,
          materialType: data.materialType,
          primarySupplierId: data.primarySupplierId,
          status: data.status,
        },
      },
    })

    revalidatePath("/materials")
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
export async function updateMaterial(
  id: string,
  input: MaterialInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = materialBaseSchema.safeParse(input)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
    }
    const data = parsed.data

    const existing = await prisma.material.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "素材が見つかりません" }
    }

    // materialCode 変更時のみ重複チェック
    if (existing.materialCode !== data.materialCode) {
      const dup = await prisma.material.findFirst({
        where: {
          companyId: sess.companyId,
          materialCode: data.materialCode,
          deletedAt: null,
          NOT: { id },
        },
      })
      if (dup) {
        return {
          ok: false,
          error: `素材コード "${data.materialCode}" は既に使用されています`,
        }
      }
    }

    // primarySupplierId 変更時のみ存在チェック
    if (existing.primarySupplierId !== data.primarySupplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: data.primarySupplierId,
          companyId: sess.companyId,
          deletedAt: null,
        },
      })
      if (!supplier) {
        return { ok: false, error: "指定された仕入先が見つかりません" }
      }
    }

    const updated = await prisma.material.update({
      where: { id },
      data: {
        materialCode: data.materialCode,
        materialName: data.materialName,
        materialNameEn: data.materialNameEn || null,
        materialType: data.materialType,
        categoryId: data.categoryId,
        primarySupplierId: data.primarySupplierId,
        unitPrice: data.unitPrice,
        currency: data.currency,
        unit: data.unit,
        minimumOrderQty: data.minimumOrderQty,
        specification: data.specification || null,
        notes: data.notes || null,
        status: data.status,
      },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Material",
        entityId: id,
        beforeData: {
          materialCode: existing.materialCode,
          materialName: existing.materialName,
          materialType: existing.materialType,
          primarySupplierId: existing.primarySupplierId,
          status: existing.status,
        },
        afterData: {
          materialCode: updated.materialCode,
          materialName: updated.materialName,
          materialType: updated.materialType,
          primarySupplierId: updated.primarySupplierId,
          status: updated.status,
        },
      },
    })

    revalidatePath("/materials")
    revalidatePath(`/materials/${id}`)
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
export async function archiveMaterial(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.material.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "素材が見つかりません" }
    }
    if (existing.status === MaterialStatus.ARCHIVED) {
      return { ok: false, error: "既にアーカイブ済みです" }
    }

    await prisma.material.update({
      where: { id },
      data: { status: MaterialStatus.ARCHIVED },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Material",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: MaterialStatus.ARCHIVED },
      },
    })

    revalidatePath("/materials")
    revalidatePath(`/materials/${id}`)
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "アーカイブに失敗しました",
    }
  }
}

// =============================================================================
// 6. 復元（ARCHIVED → ACTIVE）
// =============================================================================
export async function restoreMaterial(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.material.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "素材が見つかりません" }
    }
    if (existing.status !== MaterialStatus.ARCHIVED) {
      return { ok: false, error: "アーカイブ済みではありません" }
    }

    await prisma.material.update({
      where: { id },
      data: { status: MaterialStatus.ACTIVE },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "Material",
        entityId: id,
        beforeData: { status: existing.status },
        afterData: { status: MaterialStatus.ACTIVE },
      },
    })

    revalidatePath("/materials")
    revalidatePath(`/materials/${id}`)
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
//    Phase 1A 時点では BOM / ProductMaterial 等が未実装のため常に totalRefs: 0
// =============================================================================
export async function checkMaterialUsage(
  id: string,
): Promise<ActionResult<MaterialUsage>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.material.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) {
      return { ok: false, error: "素材が見つかりません" }
    }

    // Phase 1B 以降で BomItem / ProductMaterial / 在庫テーブルの参照件数を加算
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
export async function deleteMaterialPermanently(
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

    const existing = await prisma.material.findFirst({
      where: { id, companyId: sess.companyId, deletedAt: null },
    })
    if (!existing) {
      return { ok: false, error: "素材が見つかりません" }
    }

    // ガード 2: ARCHIVED
    if (existing.status !== MaterialStatus.ARCHIVED) {
      return {
        ok: false,
        error: "アーカイブ済みの素材のみ物理削除できます",
      }
    }

    // ガード 3: 確認名一致（materialName で確認）
    if (confirmationName.trim() !== existing.materialName) {
      return { ok: false, error: "確認名が一致しません" }
    }

    // ガード 4: 参照ゼロ
    const usage = await checkMaterialUsage(id)
    if (!usage.ok) return usage
    if (usage.data.totalRefs > 0) {
      return {
        ok: false,
        error: `この素材は ${usage.data.totalRefs} 件の業務データから参照されています。`,
      }
    }

    await runWithoutTenantContext(async () => {
      await prisma.material.delete({ where: { id } })
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "Material",
        entityId: id,
        beforeData: {
          materialCode: existing.materialCode,
          materialName: existing.materialName,
          materialType: existing.materialType,
          status: existing.status,
        },
      },
    })

    revalidatePath("/materials")
    return { ok: true, data: { id } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "物理削除に失敗しました",
    }
  }
}
