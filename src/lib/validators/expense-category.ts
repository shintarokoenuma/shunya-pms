import { z } from "zod"
import {
  ExpenseCategoryStatus,
  ExpenseType,
  CalculationType,
  Currency,
} from "@prisma/client"

/**
 * Phase 1A-8: 諸経費カテゴリマスター バリデータ
 *
 * 設計方針:
 * - Factory / Contractor / ProductCategory と同じパターン
 *   （ActionResult 統一、archive / restore / permanent delete 分離）
 * - 階層構造なし・連絡先なしの抽象マスター
 *   （ProductCategory より更にシンプル）
 * - ステータスは 2 段階（ACTIVE / ARCHIVED）。PAUSED なし
 * - 標準金額（standardAmount）は任意の Decimal、null 許可
 *   - calculationType=PERCENTAGE のときのみ 0〜100 の範囲制約
 * - expenseCode の重複チェックは DB の UNIQUE で防御するが、
 *   親切なエラーメッセージのため actions 層で事前チェックも実施
 * - 多言語は英語のみ（expenseNameEn）
 */

// =============================================================================
// ヘルパー
// =============================================================================

/** 任意の文字列（空文字許可、デフォルト ""） */
const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

/**
 * 任意の非負 Decimal
 * 空文字・null・undefined は null として扱う
 * 文字列で渡ってきた数値も number 化する
 * Prisma.Decimal への変換は actions 層で行う
 */
const optionalPositiveDecimal = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : null
  })
  .refine(
    (v) => v === null || v >= 0,
    "0以上の数値で入力してください",
  )
  .nullable()

// =============================================================================
// 諸経費カテゴリ本体スキーマ
// =============================================================================
export const expenseCategoryInputSchema = z
  .object({
    // 基本情報
    expenseCode: z
      .string()
      .min(1, "コードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "英数字・ハイフン・アンダースコアのみ使用できます",
      ),
    expenseName: z
      .string()
      .min(1, "名称は必須です")
      .max(100, "100文字以内で入力してください"),
    expenseNameEn: optionalString(100),

    // 分類
    expenseType: z.nativeEnum(ExpenseType, {
      message: "費用種別を選択してください",
    }),

    // 標準金額（任意）
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
      .nativeEnum(ExpenseCategoryStatus)
      .default(ExpenseCategoryStatus.ACTIVE),
  })
  .superRefine((data, ctx) => {
    // PERCENTAGE のとき standardAmount は 0〜100 の範囲（百分率）
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

export type ExpenseCategoryFormValues = z.input<typeof expenseCategoryInputSchema>
export type ExpenseCategoryInput = z.infer<typeof expenseCategoryInputSchema>

// =============================================================================
// 検索パラメータ
// =============================================================================
export const expenseCategoryListParamsSchema = z.object({
  q: z.string().optional().default(""),
  status: z.nativeEnum(ExpenseCategoryStatus).optional(),
  expenseType: z.nativeEnum(ExpenseType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ExpenseCategoryListParams = z.infer<
  typeof expenseCategoryListParamsSchema
>
