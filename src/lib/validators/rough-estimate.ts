import { z } from "zod"
import {
  Currency,
  RoughEstimateCategory,
  RoughEstimateItemSource,
  MarginRateSource,
  InitialCostBillingMode,
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

/** 任意の非負整数円（手打ち提示額・空/null → null・小数は切り捨て）。道A の手打ち単価/初期費用提示額用。 */
const optionalNonNegativeIntYen = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? Math.trunc(n) : null
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
  // 費目区分は 2値運用（MATERIAL/LABOR）。旧 INITIAL_COST は別枠フラグへ移行済み＝新規書き込み拒否。
  itemCategory: z
    .nativeEnum(RoughEstimateCategory)
    .refine(
      (c) =>
        c === RoughEstimateCategory.MATERIAL ||
        c === RoughEstimateCategory.LABOR,
      {
        message:
          "費目区分は材料費/工賃のみです（初期費用は別枠計上フラグで指定してください）",
      },
    ),
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
  // 別枠計上（初期費用）フラグ。ON 行は原価分子から外れ別枠へ・手打ち提示額欄が露出。
  isSeparateBilling: z.boolean().default(false),
  // 道A: 初期費用行の手打ち提示額（isSeparateBilling=true 行のみ・整数円）。フラグ OFF は action 側で null 落とし。
  presentedPriceManualJpy: optionalNonNegativeIntYen,
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
    currency: allowedCurrencyField.default(Currency.JPY),
    // 初期費用の請求方式（B-2）。既定 SEPARATE。INCLUDED は presentedMoq>0 必須（下記 superRefine）。
    initialCostBillingMode: z
      .nativeEnum(InitialCostBillingMode)
      .default(InitialCostBillingMode.SEPARATE),
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
    // 道A: 手打ち1枚単価（金額の正・整数円）。null なら PDF は自動参考単価にフォールバック。
    // 旧 finalPriceManualJpy（総額手打ち）は道Aで廃止（schema 列は残置・読み書きしない）。
    finalUnitPriceManualJpy: optionalNonNegativeIntYen,
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
    // INCLUDED（1枚単価にインクルーズ）は割り返し母数として presentedMoq>0 必須（0除算防止・B-2）。
    if (
      d.initialCostBillingMode === InitialCostBillingMode.INCLUDED &&
      (d.presentedMoq === null || d.presentedMoq <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "初期費用を製品単価にインクルーズする場合は提示MOQ（1以上）が必須です",
        path: ["presentedMoq"],
      })
    }
  })

export type RoughEstimateFormValues = z.input<typeof roughEstimateInputSchema>
export type RoughEstimateInput = z.infer<typeof roughEstimateInputSchema>
