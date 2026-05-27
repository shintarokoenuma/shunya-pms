import { z } from "zod"
import { MaterialCategoryStatus } from "@prisma/client"

/**
 * Phase 1A-15: 素材カテゴリ（MaterialCategory）バリデータ
 *
 * 設計方針（spec 2026-05-28、Phase 1A-14 ProductCategory の precedent 流用）:
 * - 3 階層構造（level 1=大分類 / 2=中分類 / 3=小分類）
 * - ステータスは 2 値（ACTIVE / ARCHIVED）
 * - 連絡先・住所・取引条件は持たない（抽象的な分類のため）
 * - 階層整合性チェック：parent.level + 1 == self.level（actions 層で DB 検証）
 * - 自己参照防止 / 循環参照防止（actions 層で検証）
 * - ProductCategory と異なり、標準値（用尺・ロス率・縫製工賃）は持たない
 */

// ヘルパー
const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

// =============================================================================
// 素材カテゴリ本体スキーマ
// =============================================================================
export const materialCategoryInputSchema = z
  .object({
    // 基本情報
    categoryCode: z
      .string()
      .min(1, "カテゴリコードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "英数字・ハイフン・アンダースコアのみ使用できます",
      ),
    categoryName: z
      .string()
      .min(1, "カテゴリ名は必須です")
      .max(255, "255文字以内で入力してください"),
    categoryNameEn: optionalString(255),

    // 階層構造
    parentCategoryId: z.string().nullable().default(null),
    level: z
      .union([z.string(), z.number()])
      .transform((v) => Number(v))
      .refine(
        (v) => v === 1 || v === 2 || v === 3,
        "階層は 1（大分類）/ 2（中分類）/ 3（小分類）のいずれかです",
      ),

    // ステータス
    status: z
      .nativeEnum(MaterialCategoryStatus)
      .default(MaterialCategoryStatus.ACTIVE),
  })
  .superRefine((data, ctx) => {
    // 階層と親の整合性
    if (data.level === 1) {
      if (data.parentCategoryId !== null && data.parentCategoryId !== "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "大分類（レベル1）には親カテゴリを設定できません",
          path: ["parentCategoryId"],
        })
      }
    } else {
      if (data.parentCategoryId === null || data.parentCategoryId === "") {
        const label = data.level === 2 ? "中分類" : "小分類"
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}には親カテゴリの選択が必須です`,
          path: ["parentCategoryId"],
        })
      }
    }
  })

export type MaterialCategoryFormValues = z.input<
  typeof materialCategoryInputSchema
>
export type MaterialCategoryInput = z.infer<typeof materialCategoryInputSchema>

// 検索パラメータ
export const materialCategoryListParamsSchema = z.object({
  q: z.string().optional().default(""),
  status: z.nativeEnum(MaterialCategoryStatus).optional(),
  level: z.coerce.number().int().min(1).max(3).optional(),
  parentCategoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type MaterialCategoryListParams = z.infer<
  typeof materialCategoryListParamsSchema
>
