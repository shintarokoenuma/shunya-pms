import { z } from "zod"
import { BrandStatus } from "@prisma/client"

// =============================================================================
// 共通バリデーション
// =============================================================================

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

const optionalUrl = z
  .string()
  .max(500, "500文字以内で入力してください")
  .refine(
    (v) => {
      if (v === "") return true
      try {
        new URL(v)
        return true
      } catch {
        return false
      }
    },
    "URL の形式が正しくありません"
  )
  .default("")

const optionalHexColor = z
  .string()
  .max(7)
  .refine(
    (v) => v === "" || /^#[0-9A-Fa-f]{6}$/.test(v),
    "#RRGGBB 形式（例: #000000）で入力してください"
  )
  .default("")

// =============================================================================
// Brand 基本スキーマ
// =============================================================================

export const brandBaseSchema = z.object({
  // 必須
  clientId: z.string().trim().min(1, "クライアントは必須です"),
  brandCode: z
    .string()
    .trim()
    .min(2, "ブランドコードは2文字以上で入力してください")
    .max(5, "ブランドコードは5文字以内で入力してください")
    .regex(/^[A-Z0-9]+$/, "英大文字と数字のみ使用できます（例: MK、SL2、AR23）"),
  brandName: z
    .string()
    .trim()
    .min(1, "ブランド名は必須です")
    .max(255, "255文字以内で入力してください"),

  // 任意
  brandNameEn: optionalString(255),
  logoUrl: optionalUrl,
  mainColorHex: optionalHexColor,
  concept: optionalString(2000),

  // 任意（数値）
  defaultMarginRate: z.coerce
    .number()
    .min(0, "0以上で入力してください")
    .max(100, "100以下で入力してください")
    .optional(),

  // 運用
  status: z.nativeEnum(BrandStatus).default("ACTIVE"),
})

export type BrandBaseInput = z.input<typeof brandBaseSchema>
export type BrandBaseOutput = z.output<typeof brandBaseSchema>

export const createBrandSchema = brandBaseSchema
export const updateBrandSchema = brandBaseSchema

export type CreateBrandInput = z.input<typeof createBrandSchema>
export type UpdateBrandInput = z.input<typeof updateBrandSchema>

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================

export const listBrandsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.nativeEnum(BrandStatus).optional(),
  clientId: z.string().trim().optional(),
  sort: z
    .enum(["brandName", "brandCode", "createdAt", "updatedAt"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListBrandsQuery = z.input<typeof listBrandsQuerySchema>
