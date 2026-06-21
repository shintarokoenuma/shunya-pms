import { z } from "zod"
import { ProductCategoryStatus } from "@prisma/client"

/**
 * Phase 1A-7: 商品カテゴリマスター バリデータ
 *
 * 設計方針:
 * - Factory / Contractor と同じパターン（archive / restore / permanent delete 分離）
 * - 階層構造（3 階層）: level=1 大分類 / level=2 中分類 / level=3 小分類
 * - ステータスは 2 段階（ACTIVE / ARCHIVED）。PAUSED なし
 * - 連絡先・住所・担当者なし（抽象的な分類のため）
 * - 標準値（用尺・ロス率・縫製工賃）は任意の数値、Decimal フィールドへ
 * - JSON フィールド: defaultMoqTiers は引き続き UI なし（Phase 2 持ち越し）。
 *   defaultSizeOptions は SKU 設計で実装（工員・検品所が見るサイズ展開順の権威。
 *   品番マトリクスのサイズ列順もこれを参照＝カテゴリ編集で即追従する）。
 * - 階層整合性: parentCategoryId が指す親の level + 1 が自分の level であること
 *   （これは actions 層で DB を引いて検証する）
 * - 自己参照防止: 自分自身を parent にできない（DB 制約 + actions 層で検証）
 * - 循環参照防止: ancestor チェーンに自分自身が含まれてはいけない（actions 層で検証）
 */

// ヘルパー: 任意文字列
const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

// ヘルパー: 任意の正の Decimal（料金体系・標準値用）
// 空文字・null・undefined は null として扱う
// 文字列で渡ってきた数値も number 化する
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

// 商品カテゴリ本体スキーマ
export const productCategoryInputSchema = z
  .object({
    // 基本情報
    categoryCode: z
      .string()
      .min(1, "カテゴリコードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(/^[A-Za-z0-9_-]+$/, "英数字・ハイフン・アンダースコアのみ使用できます"),
    categoryName: z
      .string()
      .min(1, "カテゴリ名は必須です")
      .max(100, "100文字以内で入力してください"),
    categoryNameEn: optionalString(100),

    // 階層構造
    parentCategoryId: z.string().nullable().default(null),
    level: z
      .union([z.string(), z.number()])
      .transform((v) => Number(v))
      .refine(
        (v) => v === 1 || v === 2 || v === 3,
        "階層は 1（大分類）/ 2（中分類）/ 3（小分類）のいずれかです",
      ),

    // 標準値
    standardFabricUsage: optionalPositiveDecimal,
    standardLossRate: optionalPositiveDecimal,
    standardSewingFee: optionalPositiveDecimal,

    // サイズ展開（SKU 生成のサイズ候補・マトリクスのサイズ列順の権威）。順序は維持・重複のみ除去。
    defaultSizeOptions: z
      .array(z.string().trim().min(1, "サイズを入力してください"))
      .default([])
      .transform((arr) => Array.from(new Set(arr))),

    // ステータス
    status: z
      .nativeEnum(ProductCategoryStatus)
      .default(ProductCategoryStatus.ACTIVE),
  })
  .superRefine((data, ctx) => {
    // 階層と親の整合性
    // level=1（大分類）は親なし、level=2/3 は親必須
    if (data.level === 1) {
      if (data.parentCategoryId !== null && data.parentCategoryId !== "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "大分類（レベル1）には親カテゴリを設定できません",
          path: ["parentCategoryId"],
        })
      }
    } else {
      // level=2 or 3
      if (data.parentCategoryId === null || data.parentCategoryId === "") {
        const label = data.level === 2 ? "中分類" : "小分類"
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}には親カテゴリの選択が必須です`,
          path: ["parentCategoryId"],
        })
      }
    }

    // 標準ロス率は 0〜100 の範囲（百分率）
    if (
      data.standardLossRate !== null &&
      data.standardLossRate !== undefined &&
      data.standardLossRate > 100
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ロス率は 100 以下で入力してください（%）",
        path: ["standardLossRate"],
      })
    }
  })

export type ProductCategoryFormValues = z.input<typeof productCategoryInputSchema>
export type ProductCategoryInput = z.infer<typeof productCategoryInputSchema>

// 検索パラメータ
export const productCategoryListParamsSchema = z.object({
  q: z.string().optional().default(""),
  status: z.nativeEnum(ProductCategoryStatus).optional(),
  level: z.coerce.number().int().min(1).max(3).optional(),
  parentCategoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ProductCategoryListParams = z.infer<
  typeof productCategoryListParamsSchema
>
