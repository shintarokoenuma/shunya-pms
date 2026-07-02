import { z } from "zod"
import {
  Currency,
  RoughEstimateCategory,
  RoughEstimateItemSource,
  MarginRateSource,
} from "@prisma/client"

/**
 * QE-1R（概算量産見積）バリデータ（実装ブリーフ §1〜§4）。
 *
 * 設計方針:
 * - estimateNumber は自動採番（RE-{年}-{4桁}・保存時確定）。validator 非対象。
 * - subtotal（行ネイティブ通貨）/ subtotalJpy（JPY 換算）/ autoCost・autoPrice は action 側で計算保存。
 * - 通貨は JPY / USD のみ（実装ブリーフ §2）。CNY/VND/EUR は入力段でブロック（silent fallback 禁止）。
 * - USD 行がある場合は入力レート usdJpyRate 必須（QE-1 v1.0 の入力レート方式・v1 は保存しない）。
 * - marginRate / marginRateSource は任意。未指定なら action が Brand.defaultMarginRate を供給（§4）。
 */

// 入力段で許可する通貨（集計層で JPY/USD のみ・それ以外はブロック）。
const ALLOWED_CURRENCIES = [Currency.JPY, Currency.USD] as const

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

/** 任意の非負数値（空文字/null → null）。 */
const optionalNonNegativeNumber = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : null
  })
  .refine((v) => v === null || v >= 0, "0以上で入力してください")
  .nullable()
  .default(null)

/** 数量（任意・入っていれば > 0）。 */
const optionalPositiveQuantity = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : null
  })
  .refine((v) => v === null || v > 0, "数量は0より大きい値で入力してください")
  .nullable()
  .default(null)

/** 入力通貨（JPY/USD のみ許可・CNY/VND/EUR はブロック）。 */
const allowedCurrencyField = z
  .nativeEnum(Currency)
  .refine((c) => (ALLOWED_CURRENCIES as readonly Currency[]).includes(c), {
    message: "対応通貨は JPY / USD のみです（CNY/VND/EUR は概算では非対応）",
  })

// =============================================================================
// 明細
// =============================================================================
export const roughEstimateItemInputSchema = z.object({
  itemCategory: z.nativeEnum(RoughEstimateCategory),
  itemName: z.string().trim().min(1, "品目名は必須です").max(255, "255文字以内"),
  itemNameEn: optionalString(255),
  materialId: optionalRelationId,
  costCategoryId: optionalRelationId,
  source: z.nativeEnum(RoughEstimateItemSource).default(RoughEstimateItemSource.MANUAL),
  // 引き当て元の出所記録（金額は下記スナップショット列へ焼き込み・参照リンクにしない）
  sourcePoItemId: optionalRelationId,
  sourceWoItemId: optionalRelationId,
  quantity: optionalPositiveQuantity,
  unit: optionalString(20),
  unitPrice: optionalNonNegativeNumber, // スナップショット単価
  currency: allowedCurrencyField.default(Currency.JPY),
  notes: optionalString(10000),
})

export type RoughEstimateItemInput = z.infer<typeof roughEstimateItemInputSchema>

// =============================================================================
// ヘッダ + 明細
// =============================================================================
export const roughEstimateInputSchema = z
  .object({
    productId: z.string().min(1, "品番は必須です"),
    title: optionalString(255),
    notes: optionalString(10000),
    presentedMoq: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => {
        if (v === "" || v === null || v === undefined) return null
        const n = typeof v === "number" ? v : Number(v)
        return Number.isFinite(n) ? Math.trunc(n) : null
      })
      .refine((v) => v === null || v >= 0, "提示MOQは0以上で入力してください")
      .nullable()
      .default(null),
    expectedQuantityBand: optionalString(100),
    currency: allowedCurrencyField.default(Currency.JPY),
    validUntil: optionalDateString,
    // 利益率（％）。未指定なら action が Brand.defaultMarginRate を供給（§4）。
    marginRate: optionalNonNegativeNumber,
    marginRateSource: z
      .nativeEnum(MarginRateSource)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    // USD 行がある場合に必須の入力レート（v1 は保存しない・subtotalJpy 換算にのみ使用）。
    usdJpyRate: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => {
        if (v === "" || v === null || v === undefined) return null
        const n = typeof v === "number" ? v : Number(v)
        return Number.isFinite(n) ? n : null
      })
      .refine((v) => v === null || v > 0, "レートは0より大きい値で入力してください")
      .nullable()
      .default(null),
    // 手打ち最終値（任意・未指定なら action が autoPriceTotalJpy を初期値に）。
    finalPriceManualJpy: optionalNonNegativeNumber,
    // 明細（1 行以上）
    items: z
      .array(roughEstimateItemInputSchema)
      .min(1, "明細を1行以上入力してください"),
  })
  .superRefine((d, ctx) => {
    // USD 行が1つでもあれば usdJpyRate 必須（silent fallback 禁止）。
    const hasUsd = d.items.some((it) => it.currency === Currency.USD)
    if (hasUsd && d.usdJpyRate === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "USD 明細があるため USD/JPY レートの入力が必須です",
        path: ["usdJpyRate"],
      })
    }
  })

export type RoughEstimateFormValues = z.input<typeof roughEstimateInputSchema>
export type RoughEstimateInput = z.infer<typeof roughEstimateInputSchema>
