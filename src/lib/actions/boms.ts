"use server"

import { revalidatePath } from "next/cache"
import {
  Prisma,
  MaterialStatus,
  SupplierStatus,
  BomItemCategory,
  ProgressTaskType,
  type Bom,
  type BomItem,
  type Currency,
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

/** QE-0c: マーキング転記（系統B）用。当該品番の live MarkingRecord 一覧。 */
export type BomMarkingOption = {
  id: string
  markerName: string | null
  usagePerUnit: string // 着用尺 m（転記元）
  fabricWidth: string // cm
}
export async function listMarkingsForBomSelect(
  productId: string,
): Promise<BomMarkingOption[]> {
  const sess = await requireSession()
  if (!sess.ok) return []
  const rows = await prisma.markingRecord.findMany({
    where: { companyId: sess.companyId, productId, deletedAt: null },
    select: {
      id: true,
      markerName: true,
      usagePerUnit: true,
      fabricWidth: true,
    },
    orderBy: [{ createdAt: "desc" }],
  })
  return rows.map((r) => ({
    id: r.id,
    markerName: r.markerName,
    usagePerUnit: r.usagePerUnit.toString(),
    fabricWidth: r.fabricWidth.toString(),
  }))
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
// 明細データ整形（QE-0c: usageSource/markingRecordId・実務4カラム対応。
//   markingRecordId は validator で MANUAL のとき null 正規化済み）
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
    usageSource: data.usageSource,
    markingRecordId: data.markingRecordId,
    unitPrice:
      data.unitPrice !== null ? new Prisma.Decimal(Number(data.unitPrice)) : null,
    supplierItemCode: data.supplierItemCode || null,
    designCode: data.designCode || null,
    sizeValue:
      data.sizeValue !== null ? new Prisma.Decimal(Number(data.sizeValue)) : null,
    sizeUnit: data.sizeUnit,
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

// =============================================================================
// QE-0d: PO→BOM コスト引き当て
//   仕様: docs/specs/qe-0d-po-bom-cost-linkage-spec-confirmation-v1_0-2026-06-13.md（v1.1）
//   - 参照は purchaseOrderId（PO の id・不変）。PoItem.id は参照しない（PO 編集で再作成され
//     id が変わるため・spec §2-1）。値は引き当て時点でスナップショットコピー＝自動同期なし。
// =============================================================================

/** 取り込み候補の PoItem 1行（Decimal は client へ渡すため文字列化）。 */
export type PoItemImportRow = {
  id: string
  customItemName: string | null
  supplierItemCode: string | null
  designCode: string | null
  sizeValue: string | null
  sizeUnit: string | null
  colorCode: string | null
  color: string | null
  specification: string | null
  unitPrice: string | null // 未定は null
  currency: Currency
  unit: string
  quantity: string // 表示参考のみ・取り込まない
  alreadyInBom: boolean // 同一 bom 内に supplierItemCode 一致の既存 BomItem あり（C4・表示のみ）
}

/** 取り込みモーダルの PO 単位グループ。 */
export type PoImportGroup = {
  poId: string
  poNumber: string
  poType: string
  supplierId: string
  supplierLabel: string | null
  progressTaskId: string | null
  taskType: ProgressTaskType | null
  items: PoItemImportRow[]
}

/**
 * 同一品番（Product）に紐づく PO の PoItem 一覧を取り込み候補として返す（C1）。
 * PO に productId 直結が無いため、ProgressTask.productId 経由（progressTaskId）と
 * primaryProductId の OR で絞る。companyId スコープ・deletedAt:null。
 */
export async function listPoItemsForBomImport(
  productId: string,
): Promise<PoImportGroup[]> {
  const sess = await requireSession()
  if (!sess.ok) return []

  // ① 当該品番の ProgressTask（taskType 導出用）
  const tasks = await prisma.progressTask.findMany({
    where: { companyId: sess.companyId, productId },
    select: { id: true, taskType: true },
  })
  const taskTypeByTaskId = new Map(tasks.map((t) => [t.id, t.taskType]))
  const taskIds = tasks.map((t) => t.id)

  // ② 紐づく PO（progressTaskId in taskIds OR primaryProductId 一致）
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      companyId: sess.companyId,
      deletedAt: null,
      OR: [
        ...(taskIds.length ? [{ progressTaskId: { in: taskIds } }] : []),
        { primaryProductId: productId },
      ],
    },
    select: {
      id: true,
      poNumber: true,
      poType: true,
      supplierId: true,
      progressTaskId: true,
    },
    orderBy: [{ orderDate: "desc" }, { poNumber: "desc" }],
  })
  if (pos.length === 0) return []

  // ③ items・仕入先名・重複判定の素材を一括取得
  const poIds = pos.map((p) => p.id)
  const supplierIds = [...new Set(pos.map((p) => p.supplierId))]
  const [poItems, suppliers, bom] = await Promise.all([
    prisma.poItem.findMany({
      where: { poId: { in: poIds } },
      orderBy: [{ poId: "asc" }, { itemOrder: "asc" }],
    }),
    prisma.supplier.findMany({
      where: { id: { in: supplierIds }, companyId: sess.companyId },
      select: { id: true, supplierCode: true, companyName: true },
    }),
    prisma.bom.findFirst({
      where: { companyId: sess.companyId, productId, deletedAt: null },
      select: { id: true },
    }),
  ])
  const supLabel = new Map(
    suppliers.map((s) => [s.id, `${s.supplierCode} ${s.companyName}`]),
  )

  // 重複フラグ用: 既存 BOM の supplierItemCode 集合（C4・表示のみ）
  let existingCodes = new Set<string>()
  if (bom) {
    const existing = await prisma.bomItem.findMany({
      where: { bomId: bom.id, supplierItemCode: { not: null } },
      select: { supplierItemCode: true },
    })
    existingCodes = new Set(
      existing.map((e) => e.supplierItemCode).filter((v): v is string => !!v),
    )
  }

  const itemsByPo = new Map<string, PoItemImportRow[]>()
  for (const i of poItems) {
    const row: PoItemImportRow = {
      id: i.id,
      customItemName: i.customItemName,
      supplierItemCode: i.supplierItemCode,
      designCode: i.designCode,
      sizeValue: i.sizeValue?.toString() ?? null,
      sizeUnit: i.sizeUnit,
      colorCode: i.colorCode,
      color: i.color,
      specification: i.specification,
      unitPrice: i.unitPrice?.toString() ?? null,
      currency: i.currency,
      unit: i.unit,
      quantity: i.quantity.toString(),
      alreadyInBom: !!i.supplierItemCode && existingCodes.has(i.supplierItemCode),
    }
    const arr = itemsByPo.get(i.poId)
    if (arr) arr.push(row)
    else itemsByPo.set(i.poId, [row])
  }

  return pos.map((p) => ({
    poId: p.id,
    poNumber: p.poNumber,
    poType: p.poType,
    supplierId: p.supplierId,
    supplierLabel: supLabel.get(p.supplierId) ?? null,
    progressTaskId: p.progressTaskId,
    taskType: p.progressTaskId
      ? taskTypeByTaskId.get(p.progressTaskId) ?? null
      : null,
    items: itemsByPo.get(p.id) ?? [],
  }))
}

/** taskType → BomItemCategory 既定マッピング（C5・人が後修正前提）。 */
function defaultCategoryForTaskType(
  taskType: ProgressTaskType | null,
): BomItemCategory {
  if (taskType === ProgressTaskType.FABRIC) return BomItemCategory.MAIN_FABRIC
  if (taskType === ProgressTaskType.TRIM) return BomItemCategory.ACCESSORY
  return BomItemCategory.OTHER // BODY 含むその他
}

/**
 * チェックした PoItem を BomItem 新規行として一括起票（コスト軸引き当て）。
 * §4 マッピング厳守。costSource=PURCHASE_ORDER / purchaseOrderId=親PO.id /
 * usagePerUnit=null / usageSource=MANUAL（用尺は取り込まない）。
 */
export async function importPoItemsToBom(input: {
  bomId: string
  poItemIds: string[]
}): Promise<ActionResult<{ count: number }>> {
  try {
    const sess = await requireSession()
    if (!sess.ok) return sess

    const { bomId, poItemIds } = input
    if (!poItemIds || poItemIds.length === 0)
      return { ok: false, error: "取り込む明細が選択されていません" }

    const bom = await findBomInCompany(bomId, sess.companyId)
    if (!bom) return { ok: false, error: "BOM が見つかりません" }

    // PoItem 取得 → 親 PO の companyId 越境チェック（他社混入防止）
    const poItems = await prisma.poItem.findMany({
      where: { id: { in: poItemIds } },
    })
    if (poItems.length !== poItemIds.length)
      return { ok: false, error: "一部の発注明細が見つかりません" }

    const poIds = [...new Set(poItems.map((i) => i.poId))]
    const pos = await prisma.purchaseOrder.findMany({
      where: { id: { in: poIds }, companyId: sess.companyId },
      select: { id: true, supplierId: true, progressTaskId: true },
    })
    const poById = new Map(pos.map((p) => [p.id, p]))
    // 全 PoItem の親 PO が自社のものであることを保証
    if (poItems.some((i) => !poById.has(i.poId)))
      return { ok: false, error: "他社の発注明細は取り込めません" }

    // taskType（itemCategory 既定マッピング用）
    const taskIds = [
      ...new Set(
        pos.map((p) => p.progressTaskId).filter((v): v is string => !!v),
      ),
    ]
    const tasks = taskIds.length
      ? await prisma.progressTask.findMany({
          where: { id: { in: taskIds }, companyId: sess.companyId },
          select: { id: true, taskType: true },
        })
      : []
    const taskTypeByTaskId = new Map(tasks.map((t) => [t.id, t.taskType]))

    // itemOrder 連番（既存 max+1 起点）
    const last = await prisma.bomItem.findFirst({
      where: { bomId },
      orderBy: { itemOrder: "desc" },
      select: { itemOrder: true },
    })
    let order = (last?.itemOrder ?? -1) + 1

    const created = await prisma.$transaction(async (tx) => {
      const ids: string[] = []
      for (const i of poItems) {
        const po = poById.get(i.poId)!
        const taskType = po.progressTaskId
          ? taskTypeByTaskId.get(po.progressTaskId) ?? null
          : null
        const row = await tx.bomItem.create({
          data: {
            bomId,
            itemOrder: order++,
            itemCategory: defaultCategoryForTaskType(taskType),
            materialId: null,
            customMaterialName: i.customItemName,
            customMaterialNameEn: i.customItemNameEn,
            supplierId: po.supplierId, // 親 PO 由来
            // コスト軸引き当て
            costSource: "PURCHASE_ORDER",
            purchaseOrderId: i.poId,
            unitPrice: i.unitPrice,
            currency: i.currency,
            unit: i.unit,
            lossRate: new Prisma.Decimal(0),
            supplierItemCode: i.supplierItemCode,
            designCode: i.designCode,
            sizeValue: i.sizeValue,
            sizeUnit: i.sizeUnit,
            specification: i.specification,
            colorCode: i.colorCode,
            colorName: i.color,
            // 用尺軸は取り込まない
            usagePerUnit: null,
            usageSource: "MANUAL",
            markingRecordId: null,
          },
          select: { id: true },
        })
        ids.push(row.id)
        await tx.auditLog.create({
          data: {
            companyId: sess.companyId,
            userId: sess.userId,
            action: "CREATE",
            entityType: "BomItem",
            entityId: row.id,
            afterData: {
              bomId,
              source: "PO_IMPORT",
              poItemId: i.id,
              purchaseOrderId: i.poId,
              supplierItemCode: i.supplierItemCode,
            },
          },
        })
      }
      return ids
    })

    revalidatePath(`/products/${bom.productId}`)
    return { ok: true, data: { count: created.length } }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "発注明細の取り込みに失敗しました",
    }
  }
}
