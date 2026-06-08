import { z } from "zod"
import { Currency, BillingClassification, PurchaseOrderStatus } from "@prisma/client"

/**
 * S-4b-1: 仕入先発注（PurchaseOrder / PoItem）バリデータ
 *
 * 設計方針（s-4b-order-creation-spec-confirmation v1.0 §3）:
 * - poNumber は自動採番（PO-{年}-{4桁}・保存時確定）。validator 非対象。
 * - poType=STANDARD / allocationType=DIRECT は固定（フォーム非表示・action 側で内部確定）。
 * - PoItem.subtotal は quantity×unitPrice を action で計算保存（フォーム非対象）。
 * - 明細 1 行以上必須。品目は materialId か customItemName のどちらか一方必須。
 */

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" ? null : v))

const optionalDateString = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" || v === null ? null : v))

/** 数量（> 0） */
const quantityField = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : Number(v)))
  .refine((v) => Number.isFinite(v) && v > 0, "数量は0より大きい値で入力してください")

/** 単価（v1.1：任意・未定可。空文字/null → null。入っていれば >= 0） */
const unitPriceField = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : null
  })
  .refine((v) => v === null || v >= 0, "単価は0以上で入力してください（未定なら空欄可）")
  .nullable()
  .default(null)

// =============================================================================
// 明細
// =============================================================================
export const poItemInputSchema = z
  .object({
    materialId: optionalRelationId,
    customItemName: optionalString(255),
    description: optionalString(10000),
    // v1.1 実務化項目（すべて任意）
    supplierItemCode: optionalString(100),
    designCode: optionalString(100),
    // v1.2: サイズを数値 + 単位に分解（sizeSpec 廃止）。両方任意。
    sizeValue: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => {
        if (v === "" || v === null || v === undefined) return null
        const n = typeof v === "number" ? v : Number(v)
        return Number.isFinite(n) ? n : null
      })
      .refine((v) => v === null || v >= 0, "サイズは0以上で入力してください")
      .nullable()
      .default(null),
    sizeUnit: z
      .enum(["cm", "mm", "m", "inch"])
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    colorCode: optionalString(50),
    specification: optionalString(10000),
    notes: optionalString(10000),
    quantity: quantityField,
    unit: z.string().trim().min(1, "単位は必須です").max(20, "20文字以内"),
    unitPrice: unitPriceField,
    costCategoryId: optionalRelationId,
    billingClassification: z
      .nativeEnum(BillingClassification)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    isPhysicalAsset: z.boolean().default(false),
    assetStorageStartDate: optionalDateString,
    assetStorageExpiryDate: optionalDateString,
  })
  .refine(
    (d) => !!d.materialId || (d.customItemName?.trim().length ?? 0) > 0,
    {
      message: "品目は素材選択 または 品目名 のどちらかが必須です",
      path: ["customItemName"],
    },
  )

export type PoItemInput = z.infer<typeof poItemInputSchema>

// =============================================================================
// ヘッダ + 明細
// =============================================================================
export const purchaseOrderInputSchema = z.object({
  supplierId: z.string().min(1, "発注先は必須です"),
  title: optionalString(255),
  description: optionalString(10000),
  currency: z.nativeEnum(Currency).default(Currency.JPY),
  expectedDeliveryDate: optionalDateString,
  // 起点（進行チェックリスト）からの引き継ぎ
  progressTaskId: optionalRelationId,
  sampleProductionId: optionalRelationId,
  // 明細（1 行以上）
  items: z.array(poItemInputSchema).min(1, "明細を1行以上入力してください"),
})

export type PurchaseOrderFormValues = z.input<typeof purchaseOrderInputSchema>
export type PurchaseOrderInput = z.infer<typeof purchaseOrderInputSchema>

// =============================================================================
// 一覧クエリ
// =============================================================================
export const purchaseOrderListParamsSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  supplierId: z.string().optional(),
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
  sampleProductionId: z.string().optional(),
  progressTaskId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type PurchaseOrderListParams = z.infer<
  typeof purchaseOrderListParamsSchema
>
