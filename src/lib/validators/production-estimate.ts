import { z } from "zod"
import {
  Currency,
  ProductionEstimateCategory,
  ProductionEstimateItemSource,
  ProcurementRoute,
  MarginRateSource,
  InitialCostBillingMode,
  FabricProcurementMode,
} from "@prisma/client"

/**
 * (A) 量産見積 seed① バリデータ（production-axis v1.0 §1）。
 *
 * 設計方針（RoughEstimate 踏襲・差分のみ注記）:
 * - estimateNumber は自動採番（PE-{年}-{4桁}・保存時確定）。validator 非対象。
 * - subtotal / subtotalJpy / autoUnitCost・autoUnitPrice は action 側で calc 焼き込み。
 * - 通貨は5値すべて許容（§1-6: T-0 前データの通貨は信用しない＝人が確認・修正できる。
 *   CNY/VND/EUR は計算層で除外表示・入力段ではブロックしない）。
 * - USD 行がある場合は exchangeRateUsdJpy 必須（silent fallback 禁止）。PE では列に焼き込む。
 * - marginRate / marginRateSource は任意。未指定なら action が Brand.defaultMarginRate を供給。
 * - estimateQuantity は分母（手入力・0 許容＝コピー直後は 0 のまま作成し編集で入力・§1-8）。
 * - items は 0 行以上（コピー直後にサンプル発注が無い場合や全削除を許容）。
 */

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" ? null : v))

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

/** 任意の非負整数円（手打ち提示額・空/null → null・小数は切り捨て）。 */
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

/** ロス率（％・空/null → 0・0以上）。 */
const lossRateField = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return 0
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : 0
  })
  .refine((v) => v >= 0, "ロス率は0以上で入力してください")
  .default(0)

/** 生地の販売モード（任意・ROLL/METER・空/null → null）。 */
const optionalProcurementMode = z
  .union([z.nativeEnum(FabricProcurementMode), z.literal(""), z.null()])
  .transform((v) => (v === "" || v === null ? null : v))
  .nullable()
  .default(null)

/** 任意通貨（生地反通貨・空/null → null）。 */
const optionalCurrency = z
  .union([z.nativeEnum(Currency), z.literal(""), z.null()])
  .transform((v) => (v === "" || v === null ? null : v))
  .nullable()
  .default(null)

// =============================================================================
// 明細
// =============================================================================
export const productionEstimateItemInputSchema = z.object({
  // 費目区分は 2値（MATERIAL/LABOR）。初期費用は isSeparateBilling フラグで表現。
  itemCategory: z.nativeEnum(ProductionEstimateCategory),
  itemName: z.string().trim().min(1, "品目名は必須です").max(255, "255文字以内"),
  itemNameEn: optionalString(255),
  materialId: optionalRelationId,
  costCategoryId: optionalRelationId,
  // 出所（スナップショット焼き込み・参照リンクにしない）
  source: z
    .nativeEnum(ProductionEstimateItemSource)
    .default(ProductionEstimateItemSource.MANUAL),
  sourcePoItemId: optionalRelationId,
  sourceWoItemId: optionalRelationId,
  sourceBomItemId: optionalRelationId,
  // 単価スナップショット・行別通貨（5値許容・§1-6）
  unitPrice: optionalNonNegativeNumber,
  currency: z.nativeEnum(Currency).default(Currency.JPY),
  // 量計算材料（生地行・BOM 既定値の焼き込み。無ければ null＝付属/工賃として unitPrice×quantity）
  usagePerUnit: optionalNonNegativeNumber,
  lossRate: lossRateField,
  procurementMode: optionalProcurementMode,
  rollLength: optionalNonNegativeNumber,
  rollPrice: optionalNonNegativeNumber,
  rollCurrency: optionalCurrency,
  cutFee: optionalNonNegativeNumber,
  // 数量・単位（付属・工賃行）
  quantity: optionalPositiveQuantity,
  unit: optionalString(20),
  // 別枠計上（絶対防衛線）。ON 行は原価分子から外れ別枠へ・手打ち提示額欄が露出。
  isSeparateBilling: z.boolean().default(false),
  // B-083 調達区分（既定 自社手配）。COMPANY_ARRANGED のみ 1枚単価に計上。
  procurementRoute: z
    .nativeEnum(ProcurementRoute)
    .default(ProcurementRoute.COMPANY_ARRANGED),
  presentedPriceManualJpy: optionalNonNegativeIntYen,
  notes: optionalString(10000),
})

export type ProductionEstimateItemInput = z.infer<
  typeof productionEstimateItemInputSchema
>

// =============================================================================
// ヘッダ + 明細
// =============================================================================
export const productionEstimateInputSchema = z
  .object({
    productId: z.string().min(1, "品番は必須です"),
    sourceSampleProductionId: optionalRelationId,
    title: optionalString(255),
    notes: optionalString(10000),
    // 見積数量＝分母（手入力・0 許容＝§1-8・保存時焼き込み）
    estimateQuantity: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => {
        if (v === "" || v === null || v === undefined) return 0
        const n = typeof v === "number" ? v : Number(v)
        return Number.isFinite(n) ? Math.trunc(n) : 0
      })
      .refine((v) => v >= 0, "見積数量は0以上で入力してください")
      .default(0),
    currency: z.nativeEnum(Currency).default(Currency.JPY),
    // USD 行がある場合に必須のレート（PE では列へ焼き込む・発行履歴の再現性）。
    exchangeRateUsdJpy: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => {
        if (v === "" || v === null || v === undefined) return null
        const n = typeof v === "number" ? v : Number(v)
        return Number.isFinite(n) ? n : null
      })
      .refine((v) => v === null || v > 0, "レートは0より大きい値で入力してください")
      .nullable()
      .default(null),
    marginRate: optionalNonNegativeNumber,
    marginRateSource: z
      .nativeEnum(MarginRateSource)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    initialCostBillingMode: z
      .nativeEnum(InitialCostBillingMode)
      .default(InitialCostBillingMode.SEPARATE),
    // 手打ち1枚単価（金額の正・整数円・自動値を潰さない別列）
    finalUnitPriceManualJpy: optionalNonNegativeIntYen,
    // 明細（0 行以上）
    items: z.array(productionEstimateItemInputSchema).default([]),
  })
  .superRefine((d, ctx) => {
    // USD 行が1つでもあれば exchangeRateUsdJpy 必須（silent fallback 禁止）。
    const hasUsd = d.items.some((it) => it.currency === Currency.USD)
    if (hasUsd && d.exchangeRateUsdJpy === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "USD 明細があるため USD/JPY レートの入力が必須です",
        path: ["exchangeRateUsdJpy"],
      })
    }
  })

export type ProductionEstimateFormValues = z.input<
  typeof productionEstimateInputSchema
>
export type ProductionEstimateInput = z.infer<
  typeof productionEstimateInputSchema
>
