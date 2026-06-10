import { z } from "zod"
import {
  Currency,
  BillingClassification,
  WorkOrderType,
  WorkOrderCategory,
  WorkOrderStatus,
} from "@prisma/client"

/**
 * S-4b-2: 作業発注（WorkOrder / WoItem）バリデータ
 *
 * 設計方針（s-4b-order-creation-spec-confirmation v1.0 §4 / S-4b-1 PO の対構造）:
 * - woNumber は自動採番（WO-{年}-{4桁}・保存時確定）。validator 非対象。
 * - 発注先は factoryId XOR contractorId のどちらか一方必須
 *   （PATTERN/GRADING→contractor / SEWING→factory / PROCESSING→どちらか）。
 * - workType（大分類）・workCategory（発注種類タグ）は必須。フォームで taskType から既定導出し変更可。
 *   ※ PROCESSING 起点は action 側で WO.workType = ProcessingType.workType に上書き（D2）。
 * - WoItem は workDescription ベース（PoItem のモノ仕入れ列は移植しない）。
 * - 単価は任意・未定可（空 → null）。subtotal は action で quantity×unitPrice を計算保存。
 * - 明細 1 行以上必須。
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

/** 単価（任意・未定可。空文字/null → null。入っていれば >= 0） */
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
// 明細（WoItem・workDescription ベース）
// =============================================================================
export const woItemInputSchema = z.object({
  workDescription: z
    .string()
    .trim()
    .min(1, "作業内容は必須です")
    .max(500, "500文字以内で入力してください"),
  colorCode: optionalString(50),
  size: optionalString(20),
  quantity: quantityField,
  unit: z.string().trim().min(1, "単位は必須です").max(20, "20文字以内"),
  unitPrice: unitPriceField,
  costCategoryId: optionalRelationId,
  billingClassification: z
    .nativeEnum(BillingClassification)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  notes: optionalString(10000),
})

export type WoItemInput = z.infer<typeof woItemInputSchema>

// =============================================================================
// ヘッダ + 明細
// =============================================================================
export const workOrderInputSchema = z
  .object({
    // 発注先（どちらか一方）
    factoryId: optionalRelationId,
    contractorId: optionalRelationId,
    // 作業タイプ・発注種類タグ（必須・フォームで既定導出）
    workType: z.nativeEnum(WorkOrderType),
    workCategory: z.nativeEnum(WorkOrderCategory),
    title: optionalString(255),
    description: optionalString(10000),
    currency: z.nativeEnum(Currency).default(Currency.JPY),
    expectedDeliveryDate: optionalDateString,
    // 起点（進行チェックリスト）からの引き継ぎ
    progressTaskId: optionalRelationId,
    sampleProductionId: optionalRelationId,
    // PROCESSING 起点でタスクから引き継ぐ加工種別（action 側で workType も上書き）
    processingTypeId: optionalRelationId,
    // 明細（1 行以上）
    items: z.array(woItemInputSchema).min(1, "明細を1行以上入力してください"),
  })
  .refine(
    (d) => {
      const hasFactory = !!d.factoryId
      const hasContractor = !!d.contractorId
      return (hasFactory || hasContractor) && !(hasFactory && hasContractor)
    },
    {
      message: "発注先は工場・外注先のどちらか一方を指定してください",
      path: ["factoryId"],
    },
  )

export type WorkOrderFormValues = z.input<typeof workOrderInputSchema>
export type WorkOrderInput = z.infer<typeof workOrderInputSchema>

// =============================================================================
// 一覧クエリ
// =============================================================================
export const workOrderListParamsSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  factoryId: z.string().optional(),
  contractorId: z.string().optional(),
  status: z.nativeEnum(WorkOrderStatus).optional(),
  workType: z.nativeEnum(WorkOrderType).optional(),
  sampleProductionId: z.string().optional(),
  progressTaskId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type WorkOrderListParams = z.infer<typeof workOrderListParamsSchema>
