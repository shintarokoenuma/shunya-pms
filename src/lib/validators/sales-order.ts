import { z } from "zod"
import {
  Currency,
  OrderSourceType,
  SalesOrderStatus,
  SkuMoqStatus,
  YieldMode,
} from "@prisma/client"

/**
 * B-148 PR-1 / PR-2a: 受注（SalesOrder / SoItem）バリデータ
 *
 * 設計方針（sales-order-spec-confirmation-v1_0-2026-08-13.md / 実装ブリーフ §4-2）:
 * - soNumber は自動採番（SO-{年}-{4桁}・保存時確定）。validator 非対象。
 * - SalesOrder.productId は保存しない（品番は SoItem→Sku.productId で辿る・R-5/D-3）。
 *   productId はフォーム上のグルーピングにのみ使う（本 validator では products[] の親キー）。
 * - SoItem.unitPrice は品番単位で1つ入力し全 SKU に配る（D-2）。subtotal は action で計算。
 * - products[] 1件以上・products[].skus[] 1件以上。products[].productId の重複禁止。
 *
 * PR-2a 追加（B-167 / B-168）:
 * - unitPrice は任意（単価未定を許す・B-167）。null と 0 を区別する。
 * - SKU 行ごとに歩留まり（yieldMode / yieldRate / yieldQuantity）を保持する（D-3）。
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

/** 単価（品番単位・任意・0 以上）。空欄/未指定は null（単価未定・B-167）。 */
const unitPriceField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) =>
    v === "" || v === null || v === undefined ? null : Number(v),
  )
  .refine(
    (v) => v === null || (Number.isFinite(v) && v >= 0),
    "単価は0以上で入力してください",
  )

/** 受注数（1 以上の整数）。 */
const orderedQuantityField = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v : Number(v)))
  .refine(
    (v) => Number.isInteger(v) && v >= 1,
    "受注数は1以上の整数で入力してください",
  )

/** 歩留まり率（%・任意・0〜100）。空欄/未指定は null（D-6: null は 0 扱い）。 */
const yieldRateField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) =>
    v === "" || v === null || v === undefined ? null : Number(v),
  )
  .refine(
    (v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 100),
    "歩留まり率は0〜100の範囲で入力してください",
  )

/** 歩留まりの加算枚数（+N・任意・0 以上の整数）。空欄/未指定は null（D-6: null は 0 扱い）。 */
const yieldQuantityField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) =>
    v === "" || v === null || v === undefined ? null : Number(v),
  )
  .refine(
    (v) => v === null || (Number.isInteger(v) && v >= 0),
    "加算枚数は0以上の整数で入力してください",
  )

// =============================================================================
// 原本ファイル（SalesOrder.originalFiles の1要素）
// =============================================================================
export const salesOrderOriginalFileSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1), // gs:// パス（uploadOrderSourceFile の戻り値）
  fileType: z.string().max(100).default(""),
})

// =============================================================================
// 明細（SoItem）
// =============================================================================
export const soItemInputSchema = z
  .object({
    skuId: z.string().min(1, "SKU は必須です"),
    orderedQuantity: orderedQuantityField,
    moqStatus: z.nativeEnum(SkuMoqStatus).default(SkuMoqStatus.NOT_DETERMINED),
    moqDecisionReason: optionalString(10000),
    // 歩留まり（B-168 D-3/D-6・SKU 行単位で保持）
    yieldMode: z.nativeEnum(YieldMode).default(YieldMode.RATE),
    yieldRate: yieldRateField,
    yieldQuantity: yieldQuantityField,
  })
  .superRefine((d, ctx) => {
    // 指定方式に対応する値が入っていること（D-6: null は 0 扱いだが、方式を選んだのに
    // 値が空のときは入力ミスの可能性が高いため弾く。0 は明示入力すれば通る）。
    if (d.yieldMode === YieldMode.RATE && d.yieldRate === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "率指定のときは歩留まり率を入力してください",
        path: ["yieldRate"],
      })
    }
    if (d.yieldMode === YieldMode.QUANTITY && d.yieldQuantity === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "加算枚数指定のときは枚数を入力してください",
        path: ["yieldQuantity"],
      })
    }
  })

// =============================================================================
// 品番ブロック（フォーム上のグルーピング。DB には保存しない）
// =============================================================================
export const salesOrderProductInputSchema = z.object({
  productId: z.string().min(1, "品番は必須です"),
  unitPrice: unitPriceField,
  skus: z.array(soItemInputSchema).min(1, "SKU を1件以上入力してください"),
})

// =============================================================================
// ヘッダ + 品番ブロック
// =============================================================================
export const salesOrderInputSchema = z
  .object({
    clientId: z.string().min(1, "クライアントは必須です"),
    buyerId: optionalRelationId,
    sourceType: z.nativeEnum(OrderSourceType).default(OrderSourceType.EMAIL),
    buyerOrderNumber: optionalString(100),
    orderDate: z.string().min(1, "受注日は必須です"),
    desiredDeliveryDate: optionalDateString,
    currency: z.nativeEnum(Currency).default(Currency.JPY),
    title: optionalString(255),
    internalNotes: optionalString(10000),
    buyerSpecialRequests: optionalString(10000),
    status: z.nativeEnum(SalesOrderStatus).default(SalesOrderStatus.TENTATIVE),
    originalFiles: z.array(salesOrderOriginalFileSchema).default([]),
    products: z
      .array(salesOrderProductInputSchema)
      .min(1, "品番を1件以上追加してください"),
  })
  .superRefine((d, ctx) => {
    // products[].productId の重複禁止（同じ品番を2ブロックに分けさせない）。
    const seen = new Set<string>()
    d.products.forEach((p, i) => {
      if (seen.has(p.productId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "同じ品番を複数のブロックに分けることはできません",
          path: ["products", i, "productId"],
        })
      }
      seen.add(p.productId)
    })
  })

export type SalesOrderFormValues = z.input<typeof salesOrderInputSchema>
export type SalesOrderInput = z.infer<typeof salesOrderInputSchema>
export type SalesOrderOriginalFile = z.infer<typeof salesOrderOriginalFileSchema>
