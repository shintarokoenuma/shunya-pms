import { z } from "zod"
import {
  CostCategoryStatus,
  CalculationType,
  Currency,
  ExternalCostCategory,
} from "@prisma/client"

/**
 * Phase 1A-16: 原価費目マスター (CostCategory) バリデータ
 *
 * 設計方針:
 * - 2 階層 (Lv1 = 大分類 = ExternalCostCategory に対応する予約 4 行 / Lv2 = 葉ノード)
 * - Lv1 の追加は禁止 (予約 4 行のみ)。actions 層で reject。
 * - externalCategory は Lv1 では固定、Lv2 では親から自動継承 (actions 層で derive)。
 *   フォームでは parent の選択で確定するため、ユーザーは externalCategory を直接編集しない。
 * - ステータスは 2 段階 (ACTIVE / ARCHIVED)
 * - 標準金額 (standardAmount) は任意の Decimal、null 許可
 *   - calculationType=PERCENTAGE のときのみ 0〜100 の範囲制約
 * - 多言語は英名のみ (categoryNameEn)
 */

// =============================================================================
// ヘルパー
// =============================================================================

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

const optionalPositiveDecimal = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : null
  })
  .refine((v) => v === null || v >= 0, "0以上の数値で入力してください")
  .nullable()

// =============================================================================
// 原価費目本体スキーマ
// =============================================================================
export const costCategoryInputSchema = z
  .object({
    // 基本情報
    categoryCode: z
      .string()
      .min(1, "コードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "英数字・ハイフン・アンダースコアのみ使用できます",
      ),
    categoryName: z
      .string()
      .min(1, "名称は必須です")
      .max(100, "100文字以内で入力してください"),
    categoryNameEn: optionalString(100),

    // 階層
    parentCategoryId: z.string().nullable().default(null),
    level: z
      .union([z.string(), z.number()])
      .transform((v) => Number(v))
      .refine(
        (v) => v === 1 || v === 2,
        "階層は 1 (大分類) / 2 (小分類) のいずれかです",
      ),

    // 大分類 (Lv1 では固定、Lv2 は親から継承)
    externalCategory: z.nativeEnum(ExternalCostCategory, {
      message: "大分類を選択してください",
    }),

    // 標準金額
    standardAmount: optionalPositiveDecimal,
    currency: z.nativeEnum(Currency).default(Currency.JPY),

    // 計算方法
    calculationType: z
      .nativeEnum(CalculationType)
      .default(CalculationType.FIXED),

    // メモ
    notes: z
      .string()
      .max(2000, "2000文字以内で入力してください")
      .default(""),

    // ステータス
    status: z
      .nativeEnum(CostCategoryStatus)
      .default(CostCategoryStatus.ACTIVE),
  })
  .superRefine((data, ctx) => {
    // 階層と親の整合性
    if (data.level === 1) {
      if (data.parentCategoryId !== null && data.parentCategoryId !== "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Lv1 (大分類) には親カテゴリを設定できません",
          path: ["parentCategoryId"],
        })
      }
    } else if (data.level === 2) {
      if (!data.parentCategoryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Lv2 (小分類) には親カテゴリの選択が必須です",
          path: ["parentCategoryId"],
        })
      }
    }

    // PERCENTAGE のとき standardAmount は 0〜100 の範囲
    if (
      data.calculationType === CalculationType.PERCENTAGE &&
      data.standardAmount !== null &&
      data.standardAmount !== undefined &&
      data.standardAmount > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "％指定の場合は 100 以下で入力してください",
        path: ["standardAmount"],
      })
    }
  })

export type CostCategoryFormValues = z.input<typeof costCategoryInputSchema>
export type CostCategoryInput = z.infer<typeof costCategoryInputSchema>

// =============================================================================
// 検索パラメータ
// =============================================================================
export const costCategoryListParamsSchema = z.object({
  q: z.string().optional().default(""),
  status: z.nativeEnum(CostCategoryStatus).optional(),
  externalCategory: z.nativeEnum(ExternalCostCategory).optional(),
  parentCategoryId: z.string().optional(),
  level: z.coerce.number().int().min(1).max(2).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type CostCategoryListParams = z.infer<
  typeof costCategoryListParamsSchema
>
