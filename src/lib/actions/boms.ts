"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  MaterialStatus,
  SupplierStatus,
  type Bom,
  type BomItem,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { bomItemInputSchema, type BomItemInput } from "@/lib/validators/bom"

/**
 * QE-0b: BOM（資材表）Server Actions。
 * 仕様: docs/specs/qe-0-quotation-foundation-spec-confirmation-v1_0-2026-06-12.md
 * - Bom は Product 直結（QE-0a 案A）。version は QE-2 まで "1" 固定。
 * - BomItem は deletedAt を持たないため物理削除（Bom への cascade 子）。
 * - usageSource は QE-0b では MANUAL 固定・markingRecordId は UI 非対象（QE-0c）。
 * - house style: @relation traversal/include 不使用・明示クエリ + in 句一括結合・auditLog 記録。
 */

export type ActionResult<T = void> =
  | { ok: true; data: T extends void ? undefined : T }
  | { ok: false; error: string }

async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, error: "認証されていません" }
  }
  return {
    ok: true as const,
    companyId: session.user.companyId,
    userId: session.user.id,
  }
}

// =============================================================================
// フォーム select 用
// =============================================================================
export type BomMaterialOption = {
  id: string
  materialCode: string
  materialName: string
  unit: string
  primarySupplierId: string
  standardLossRate: string | null
  unitPrice: string | null
}
export type BomSupplierOption = {
  id: string
  supplierCode: string
  companyName: string
}

export async function listMaterialsForBomSelect(): Promise<BomMaterialOption[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  const rows = await prisma.material.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: MaterialStatus.ACTIVE },
    select: {
      id: true,
      materialCode: true,
      materialName: true,
      unit: true,
      primarySupplierId: true,
      standardLossRate: true,
      unitPrice: true,
    },
    orderBy: [{ materialCode: "asc" }],
  })
  // Decimal はクライアントへ渡すため文字列化
  return rows.map((r) => ({
    id: r.id,
    materialCode: r.materialCode,
    materialName: r.materialName,
    unit: r.unit,
    primarySupplierId: r.primarySupplierId,
    standardLossRate: r.standardLossRate?.toString() ?? null,
    unitPrice: r.unitPrice?.toString() ?? null,
  }))
}

export async function listSuppliersForBomSelect(): Promise<BomSupplierOption[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  return prisma.supplier.findMany({
    where: { companyId: sess.companyId, deletedAt: null, status: SupplierStatus.ACTIVE },
    select: { id: true, supplierCode: true, companyName: true },
    orderBy: [{ supplierCode: "asc" }],
  })
}

// =============================================================================
// 取得（Product 直結の現行 BOM + 明細）
// =============================================================================
export type BomItemRow = BomItem & {
  material: { id: string; materialCode: string; materialName: string } | null
  supplier: BomSupplierOption | null
}
export type BomDetail = Bom & { items: BomItemRow[] }

export async function getBomByProductId(
  productId: string,
): Promise<ActionResult<BomDetail | null>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const bom = await prisma.bom.findFirst({
      where: { companyId: sess.companyId, productId, deletedAt: null },
    })
    if (!bom) return { ok: true, data: null }

    const items = await prisma.bomItem.findMany({
      where: { bomId: bom.id },
      orderBy: { itemOrder: "asc" },
    })

    const materialIds = [
      ...new Set(items.map((i) => i.materialId).filter((v): v is string => !!v)),
    ]
    const supplierIds = [
      ...new Set(items.map((i) => i.supplierId).filter((v): v is string => !!v)),
    ]
    const [mats, sups] = await Promise.all([
      materialIds.length
        ? prisma.material.findMany({
            where: { id: { in: materialIds }, companyId: sess.companyId },
            select: { id: true, materialCode: true, materialName: true },
          })
        : Promise.resolve([]),
      supplierIds.length
        ? prisma.supplier.findMany({
            where: { id: { in: supplierIds }, companyId: sess.companyId },
            select: { id: true, supplierCode: true, companyName: true },
          })
        : Promise.resolve([]),
    ])
    const matMap = new Map(mats.map((m) => [m.id, m]))
    const supMap = new Map(sups.map((s) => [s.id, s]))

    return {
      ok: true,
      data: {
        ...bom,
        items: items.map((i) => ({
          ...i,
          material: i.materialId ? matMap.get(i.materialId) ?? null : null,
          supplier: i.supplierId ? supMap.get(i.supplierId) ?? null : null,
        })),
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "BOM 取得に失敗しました" }
  }
}

// =============================================================================
// BOM 作成（Product 起点・1品番1BOM・冪等）
// =============================================================================
export async function createBom(
  productId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const product = await prisma.product.findFirst({
      where: { id: productId, companyId: sess.companyId, deletedAt: null },
      select: { id: true },
    })
    if (!product) return { ok: false, error: "品番が見つかりません" }

    // 冪等: 既存 live BOM があればそれを返す
    const existing = await prisma.bom.findFirst({
      where: { companyId: sess.companyId, productId, deletedAt: null },
      select: { id: true },
    })
    if (existing) return { ok: true, data: { id: existing.id } }

    const bom = await prisma.bom.create({
      data: {
        companyId: sess.companyId,
        productId,
        version: "1", // QE-2 までは固定
      },
      select: { id: true },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "Bom",
        entityId: bom.id,
        afterData: { productId, version: "1" },
      },
    })

    revalidatePath(`/products/${productId}`)
    return { ok: true, data: { id: bom.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "BOM 作成に失敗しました" }
  }
}

// =============================================================================
// 明細データ整形（QE-0b: usageSource は MANUAL 固定）
// =============================================================================
function buildItemData(
  data: BomItemInput,
): Omit<Prisma.BomItemUncheckedCreateInput, "bomId" | "itemOrder"> {
  return {
    itemCategory: data.itemCategory,
    materialId: data.materialId,
    customMaterialName: data.materialId ? null : data.customMaterialName || null,
    supplierId: data.supplierId,
    usagePerUnit:
      data.usagePerUnit !== null
        ? new Prisma.Decimal(Number(data.usagePerUnit))
        : null,
    unit: data.unit,
    lossRate: new Prisma.Decimal(Number(data.lossRate)),
    procurementMode: data.procurementMode,
    usageSource: "MANUAL", // QE-0b 固定（系統B は QE-0c）
    unitPrice:
      data.unitPrice !== null ? new Prisma.Decimal(Number(data.unitPrice)) : null,
    colorCode: data.colorCode || null,
    colorName: data.colorName || null,
    notes: data.notes || null,
  }
}

async function findBomInCompany(bomId: string, companyId: string) {
  return prisma.bom.findFirst({
    where: { id: bomId, companyId, deletedAt: null },
    select: { id: true, productId: true },
  })
}

// =============================================================================
// 明細 追加
// =============================================================================
export async function addBomItem(
  bomId: string,
  input: BomItemInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = bomItemInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }
    const bom = await findBomInCompany(bomId, sess.companyId)
    if (!bom) return { ok: false, error: "BOM が見つかりません" }

    const last = await prisma.bomItem.findFirst({
      where: { bomId },
      orderBy: { itemOrder: "desc" },
      select: { itemOrder: true },
    })
    const itemOrder = (last?.itemOrder ?? -1) + 1

    const created = await prisma.bomItem.create({
      data: { ...buildItemData(parsed.data), bomId, itemOrder },
      select: { id: true },
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "CREATE",
        entityType: "BomItem",
        entityId: created.id,
        afterData: {
          bomId,
          itemCategory: parsed.data.itemCategory,
          materialId: parsed.data.materialId,
          customMaterialName: parsed.data.customMaterialName || null,
        },
      },
    })

    revalidatePath(`/products/${bom.productId}`)
    return { ok: true, data: { id: created.id } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "明細追加に失敗しました" }
  }
}

// =============================================================================
// 明細 更新
// =============================================================================
export async function updateBomItem(
  itemId: string,
  input: BomItemInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const parsed = bomItemInputSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" }
    }

    const existing = await prisma.bomItem.findFirst({ where: { id: itemId } })
    if (!existing) return { ok: false, error: "明細が見つかりません" }
    const bom = await findBomInCompany(existing.bomId, sess.companyId)
    if (!bom) return { ok: false, error: "BOM が見つかりません" }

    const updated = await prisma.bomItem.update({
      where: { id: itemId },
      data: buildItemData(parsed.data),
    })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "UPDATE",
        entityType: "BomItem",
        entityId: itemId,
        beforeData: {
          itemCategory: existing.itemCategory,
          materialId: existing.materialId,
          customMaterialName: existing.customMaterialName,
          usagePerUnit: existing.usagePerUnit?.toString() ?? null,
          unit: existing.unit,
          lossRate: existing.lossRate.toString(),
          unitPrice: existing.unitPrice?.toString() ?? null,
        },
        afterData: {
          itemCategory: updated.itemCategory,
          materialId: updated.materialId,
          customMaterialName: updated.customMaterialName,
          usagePerUnit: updated.usagePerUnit?.toString() ?? null,
          unit: updated.unit,
          lossRate: updated.lossRate.toString(),
          unitPrice: updated.unitPrice?.toString() ?? null,
        },
      },
    })

    revalidatePath(`/products/${bom.productId}`)
    return { ok: true, data: { id: itemId } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "明細更新に失敗しました" }
  }
}

// =============================================================================
// 明細 削除（BomItem は deletedAt が無いため物理削除）
// =============================================================================
export async function deleteBomItem(
  itemId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const existing = await prisma.bomItem.findFirst({ where: { id: itemId } })
    if (!existing) return { ok: false, error: "明細が見つかりません" }
    const bom = await findBomInCompany(existing.bomId, sess.companyId)
    if (!bom) return { ok: false, error: "BOM が見つかりません" }

    await prisma.bomItem.delete({ where: { id: itemId } })

    await prisma.auditLog.create({
      data: {
        companyId: sess.companyId,
        userId: sess.userId,
        action: "DELETE",
        entityType: "BomItem",
        entityId: itemId,
        beforeData: {
          bomId: existing.bomId,
          itemCategory: existing.itemCategory,
          materialId: existing.materialId,
          customMaterialName: existing.customMaterialName,
          physicalDelete: true,
        },
      },
    })

    revalidatePath(`/products/${bom.productId}`)
    return { ok: true, data: { id: itemId } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "明細削除に失敗しました" }
  }
}
