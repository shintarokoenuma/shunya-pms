import { z } from "zod"
import { Currency, DeliveryNoteStatus } from "@prisma/client"

/**
 * B-108: サンプル納品書（DeliveryNote / DeliveryNoteItem）バリデータ。
 * 仕様: docs/specs/b-108-sample-delivery-note-spec-confirmation-v1_0-2026-08-05.md §3〜§9
 * - deliveryNumber は自動採番（DLV-{年}-{4桁}・保存時確定）。validator 非対象。
 * - DeliveryNote.productId は入れない（明細側 productId で引く・§3-1）。validator 非対象。
 * - DeliveryNoteItem.quantity は Int（PoItem の Decimal とは別・§3-2）。
 * - 宛先 shipTo* は action 側でマスターから解決してコピー（§4-3）。フォームからの上書きは任意。
 */

const optionalString = (max: number) =>
  z
    .string()
    .max(max, `${max}文字以内で入力してください`)
    .nullable()
    .default(null)
    .transform((v) => (v === "" || v === null ? null : v))

const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" ? null : v))

/** 数量（Int・> 0）。§3-2: DeliveryNoteItem.quantity は整数。 */
const quantityIntField = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : Number(v)))
  .refine(
    (v) => Number.isInteger(v) && v > 0,
    "数量は1以上の整数で入力してください",
  )

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
// 明細
// =============================================================================
export const deliveryNoteItemInputSchema = z.object({
  // §3-1: DeliveryNoteItem.productId は NOT NULL（skuId のみ nullable 化）。手入力でも品番必須。
  productId: z.string().min(1, "品番を選択してください"),
  productName: z
    .string()
    .trim()
    .min(1, "品名を入力してください")
    .max(255, "255文字以内で入力してください"),
  clientProductCode: optionalString(50),
  colorCode: optionalString(50),
  colorName: optionalString(100),
  size: optionalString(20),
  quantity: quantityIntField,
  unit: z.string().max(20).default("枚"),
  unitPrice: unitPriceField,
  // B-108 PR2: 引き当て元（§C-2）。手入力行は全て null。
  // ★フィルタ根拠に使ってよいのは sourceSampleProductionId のみ。
  //   sourceWoItemId / sourcePoItemId は親編集で dead になる（best-effort）。
  //   sourceWorkOrderId / sourcePurchaseOrderId はバッジ表示専用。
  sourceSampleProductionId: optionalRelationId,
  sourceWoItemId: optionalRelationId,
  sourceWorkOrderId: optionalRelationId,
  sourcePoItemId: optionalRelationId,
  sourcePurchaseOrderId: optionalRelationId,
})

// =============================================================================
// ヘッダ
// =============================================================================
export const deliveryNoteInputSchema = z.object({
  clientId: z.string().min(1, "クライアントを選択してください"),
  buyerId: optionalRelationId,
  deliveryDestinationId: optionalRelationId,
  // 納品日（yyyy-MM-dd）
  deliveryDate: z.string().min(1, "納品日を入力してください"),
  currency: z.nativeEnum(Currency).default(Currency.JPY),
  // §6: 金額表示の要否。既定は非表示。
  showAmounts: z.boolean().default(false),
  // §6: 消費税は v1 は 10% 固定＋手入力上書き可。
  taxRatePercent: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : Number(v)))
    .refine((v) => Number.isFinite(v) && v >= 0, "税率は0以上で入力してください")
    .default(10),
  // §4-3: 宛先はマスターから解決してコピーするが、人の上書きを許す（任意）。
  shipToAddress: optionalString(2000),
  shipToContact: optionalString(255),
  shipToPhone: optionalString(50),
  internalNotes: optionalString(10000),
  clientNotes: optionalString(10000),
  items: z.array(deliveryNoteItemInputSchema).min(1, "明細を1行以上入力してください"),
})

export type DeliveryNoteInput = z.infer<typeof deliveryNoteInputSchema>
export type DeliveryNoteItemInput = z.infer<typeof deliveryNoteItemInputSchema>

// =============================================================================
// 一覧パラメータ
// =============================================================================
export const deliveryNoteListParamsSchema = z.object({
  q: z.string().default(""),
  status: z.nativeEnum(DeliveryNoteStatus).optional(),
  clientId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export type DeliveryNoteListParams = z.infer<typeof deliveryNoteListParamsSchema>

/** §8: v1 の UI が扱うステータス遷移の許可集合（DRAFT/SHIPPED/DELIVERED/CANCELLED のみ）。 */
export const DELIVERY_NOTE_STATUS_UI_VALUES: DeliveryNoteStatus[] = [
  DeliveryNoteStatus.DRAFT,
  DeliveryNoteStatus.SHIPPED,
  DeliveryNoteStatus.DELIVERED,
  DeliveryNoteStatus.CANCELLED,
]
