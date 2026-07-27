"use server"

import { WorkOrderType, WorkOrderCategory } from "@prisma/client"
import {
  getProductionOrderGenerationContext,
  type ActionResult,
  type GenLine,
} from "@/lib/actions/production-estimates"
import { createPurchaseOrder } from "@/lib/actions/purchase-orders"
import { createWorkOrder } from "@/lib/actions/work-orders"
import {
  generateProductionOrdersInputSchema,
  type GenerateProductionOrdersInput,
} from "@/lib/validators/production-order-generation"
import {
  computeMaterialProcurement,
  computeRequirement,
  type MaterialCostInput,
  type ProductionCostCurrency,
  type ProductionCostProcurementMode,
} from "@/lib/calc/production-cost"
import type {
  PoItemInput,
  PurchaseOrderInput,
} from "@/lib/validators/purchase-order"
import type {
  WoItemInput,
  WorkOrderInput,
} from "@/lib/validators/work-order"

/**
 * (B) 量産発注生成パイプライン（write 系・§5）。
 *
 * 設計原則:
 * - 生成は既存 createPurchaseOrder / createWorkOrder を呼ぶ（採番 tx・P2002 リトライ・
 *   DRAFT・監査の house style を再利用。自前 tx で採番を複製しない）。
 * - 文書間は非アトミック。途中失敗時は生成済み DRAFT を報告して停止する。
 * - PO は仕入先別・WO は相手先別。生地行はカラーウェイ別に明細分割（calc 純関数を流用）。
 */

export type GenerateProductionOrdersResult = {
  productId: string
  createdPos: { id: string; poNumber: string }[]
  createdWos: { id: string; woNumber: string }[]
  /** 途中失敗時のメッセージ（生成済み DRAFT は createdPos/Wos に入る）。 */
  partialError?: string
}

/** PoItemInput を既定値つきで組む（createPurchaseOrder が再 parse するため型を満たすだけ）。 */
function poItem(partial: Partial<PoItemInput>): PoItemInput {
  return {
    materialId: null,
    productColorwayId: null,
    customItemName: "",
    description: "",
    supplierItemCode: "",
    designCode: "",
    sizeValue: null,
    sizeUnit: null,
    colorCode: "",
    specification: "",
    notes: "",
    quantity: 0,
    unit: "",
    unitPrice: null,
    currency: undefined,
    costCategoryId: null,
    billingClassification: null,
    isPhysicalAsset: false,
    assetStorageStartDate: null,
    assetStorageExpiryDate: null,
    ...partial,
  } as PoItemInput
}

function woItem(partial: Partial<WoItemInput>): WoItemInput {
  return {
    workDescription: "",
    colorCode: "",
    size: "",
    quantity: 0,
    unit: "枚",
    unitPrice: null,
    currency: undefined,
    costCategoryId: null,
    billingClassification: null,
    notes: "",
    ...partial,
  } as WoItemInput
}

/** GenLine → calc の MaterialCostInput（色別数量で回すため totalQuantity は呼び出し側が渡す）。 */
function toMaterialCostInput(line: GenLine): MaterialCostInput {
  return {
    bomItemId: line.peItemId,
    itemLabel: line.itemName,
    itemCategory: "MATERIAL",
    usagePerUnit: line.usagePerUnit,
    lossRate: line.lossRate,
    unit: line.unit ?? "",
    procurementMode: (line.procurementMode as ProductionCostProcurementMode) ?? null,
    unitPrice: line.unitPrice,
    currency: line.currency as ProductionCostCurrency,
    rollLength: line.rollLength,
    rollPrice: line.rollPrice,
    rollCurrency: (line.rollCurrency as ProductionCostCurrency | null) ?? null,
    cutFee: line.cutFee,
  }
}

export async function generateProductionOrders(
  input: GenerateProductionOrdersInput,
): Promise<ActionResult<GenerateProductionOrdersResult>> {
  const parsed = generateProductionOrdersInputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: first?.message ?? "入力内容に誤りがあります" }
  }
  const data = parsed.data

  // 生成コンテキスト（対象行・色グループ・相手先候補）はサーバ側で再取得（信頼境界）。
  const ctxResult = await getProductionOrderGenerationContext(data.peId)
  if (!ctxResult.ok) return ctxResult
  const ctx = ctxResult.data

  // SKU 入力数量 map（未入力 SKU は 0 扱い）。
  const qtyBySku = new Map<string, number>()
  for (const q of data.skuQuantities) qtyBySku.set(q.skuId, Number(q.quantity))

  // カラーウェイ別合計と総量（Σ入力数量）。
  const qtyByColorway = new Map<string, number>()
  let totalQty = 0
  for (const cw of ctx.colorways) {
    let sum = 0
    for (const cell of cw.sizes) sum += qtyBySku.get(cell.skuId) ?? 0
    qtyByColorway.set(cw.colorwayId, sum)
    totalQty += sum
  }

  // 相手先 map（peItemId → target）。未指定行が1つでもあれば生成不可（§2）。
  const targetByItem = new Map<
    string,
    { targetType: "supplier" | "factory" | "contractor"; targetId: string }
  >()
  for (const t of data.targets) {
    targetByItem.set(t.peItemId, {
      targetType: t.targetType,
      targetId: t.targetId,
    })
  }
  const missing = ctx.lines.filter((l) => !targetByItem.get(l.peItemId)?.targetId)
  if (missing.length > 0) {
    return {
      ok: false,
      error: `相手先が未指定の明細が ${missing.length} 件あります（全行の相手先を指定してください）`,
    }
  }
  if (totalQty <= 0) {
    return { ok: false, error: "SKU 数量が全て 0 です（1つ以上入力してください）" }
  }

  // === PO 明細を仕入先別に構築（MATERIAL 行）===
  const poItemsBySupplier = new Map<string, PoItemInput[]>()
  for (const line of ctx.lines) {
    if (line.itemCategory !== "MATERIAL") continue
    const t = targetByItem.get(line.peItemId)!
    if (t.targetType !== "supplier") continue // MATERIAL の相手先は仕入先のみ
    const supplierId = t.targetId
    const bucket = poItemsBySupplier.get(supplierId) ?? []

    const isFabric =
      line.procurementMode === "ROLL" || line.procurementMode === "METER"
    if (isFabric) {
      const mci = toMaterialCostInput(line)
      // カラーウェイ別に明細分割（色別数量で必要量を再計算）。
      for (const cw of ctx.colorways) {
        const colorQty = qtyByColorway.get(cw.colorwayId) ?? 0
        if (colorQty <= 0) continue
        const proc = computeMaterialProcurement(mci, colorQty)
        if (proc.poQuantity === null || proc.poQuantity <= 0) continue
        bucket.push(
          poItem({
            materialId: line.materialId,
            productColorwayId: cw.colorwayId,
            customItemName: line.itemName,
            quantity: proc.poQuantity,
            unit: line.procurementMode === "ROLL" ? "反" : line.unit ?? "m",
            unitPrice: proc.unitPrice,
            currency: proc.currency,
            costCategoryId: line.costCategoryId,
          }),
        )
      }
      // METER のカット代は行に1本だけ（色別に多重計上しない・PE と総額一致）。
      if (line.procurementMode === "METER" && (line.cutFee ?? 0) > 0) {
        bucket.push(
          poItem({
            materialId: null,
            productColorwayId: null,
            customItemName: `${line.itemName}（カット代）`,
            quantity: 1,
            unit: "式",
            unitPrice: line.cutFee,
            currency: line.currency,
            costCategoryId: line.costCategoryId,
          }),
        )
      }
    } else {
      // 付属行（procurementMode null）: 分割せず1行。数量 = 用尺 × Σ入力数量 × (1+ロス)。
      const req = computeRequirement(totalQty, line.usagePerUnit, line.lossRate)
      const quantity = req ?? line.quantity ?? totalQty
      if (quantity > 0) {
        bucket.push(
          poItem({
            materialId: line.materialId,
            productColorwayId: null,
            customItemName: line.itemName,
            quantity,
            unit: line.unit ?? "個",
            unitPrice: line.unitPrice,
            currency: line.currency,
            costCategoryId: line.costCategoryId,
          }),
        )
      }
    }
    poItemsBySupplier.set(supplierId, bucket)
  }

  // === WO 明細を相手先別に構築（LABOR 行）===
  type WoBucket = {
    targetType: "factory" | "contractor"
    targetId: string
    items: WoItemInput[]
    workType: WorkOrderType | null
  }
  const woByTarget = new Map<string, WoBucket>()
  for (const line of ctx.lines) {
    if (line.itemCategory !== "LABOR") continue
    const t = targetByItem.get(line.peItemId)!
    if (t.targetType === "supplier") continue // LABOR の相手先は工場/外注先のみ
    const key = `${t.targetType}:${t.targetId}`
    let bucket = woByTarget.get(key)
    if (!bucket) {
      bucket = {
        targetType: t.targetType,
        targetId: t.targetId,
        items: [],
        workType: line.target.kind === "LABOR" ? line.target.workType : null,
      }
      woByTarget.set(key, bucket)
    }
    // 混在時は先頭行の workType を採用（DRAFT なので人が直せる）。
    if (
      bucket.workType === null &&
      line.target.kind === "LABOR" &&
      line.target.workType
    ) {
      bucket.workType = line.target.workType
    }
    bucket.items.push(
      woItem({
        workDescription: line.itemName,
        quantity: totalQty, // 全工程行 = Σ入力数量（B-074 一致）
        unit: "枚",
        unitPrice: line.unitPrice,
        currency: line.currency,
        costCategoryId: line.costCategoryId,
      }),
    )
  }

  // === 生成実行（非アトミック・失敗時は生成済みを報告して停止）===
  const createdPos: { id: string; poNumber: string }[] = []
  const createdWos: { id: string; woNumber: string }[] = []
  const peLabel = `量産発注（${ctx.pe.estimateNumber}）`
  const desc = `量産見積 ${ctx.pe.estimateNumber} から生成（${ctx.pe.productCode}）`

  for (const [supplierId, items] of poItemsBySupplier) {
    if (items.length === 0) continue
    const poInput: PurchaseOrderInput = {
      supplierId,
      title: peLabel,
      description: desc,
      currency: ctx.pe.currency,
      expectedDeliveryDate: null,
      productId: ctx.pe.productId,
      progressTaskId: null,
      sampleProductionId: null,
      items,
    }
    const r = await createPurchaseOrder(poInput)
    if (!r.ok) {
      return {
        ok: true,
        data: { productId: ctx.pe.productId, createdPos, createdWos, partialError: `PO 生成に失敗: ${r.error}` },
      }
    }
    createdPos.push(r.data)
  }

  for (const bucket of woByTarget.values()) {
    if (bucket.items.length === 0) continue
    const woInput: WorkOrderInput = {
      factoryId: bucket.targetType === "factory" ? bucket.targetId : null,
      contractorId: bucket.targetType === "contractor" ? bucket.targetId : null,
      workType: bucket.workType ?? WorkOrderType.SEWING,
      workCategory: WorkOrderCategory.PRODUCTION,
      title: peLabel,
      description: desc,
      currency: ctx.pe.currency,
      expectedDeliveryDate: null,
      productId: ctx.pe.productId,
      progressTaskId: null,
      sampleProductionId: null,
      processingTypeId: null,
      items: bucket.items,
    }
    const r = await createWorkOrder(woInput)
    if (!r.ok) {
      return {
        ok: true,
        data: { productId: ctx.pe.productId, createdPos, createdWos, partialError: `WO 生成に失敗: ${r.error}` },
      }
    }
    createdWos.push(r.data)
  }

  return {
    ok: true,
    data: { productId: ctx.pe.productId, createdPos, createdWos },
  }
}
