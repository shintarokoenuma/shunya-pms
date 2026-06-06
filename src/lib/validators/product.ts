import { z } from "zod"
import { ProductStatus } from "@prisma/client"

/**
 * S-1: 品番カルテ（Product）バリデータ
 *
 * 設計方針（仕様議事録 v1.0 2026-06-06）:
 * - 社内品番（productCode）は自動採番（`{brandCode}-{season}-{categoryCode}-{連番3桁}`）。
 *   validator には含めない。新規作成時は server action 内で transaction 経由で採番、
 *   更新時は immutable（server action 側で existing.productCode を維持）。
 * - modelCodeId も自動発番（裏で ModelCode を1件生成して紐づける）。validator 非対象。
 * - clientId はフォーム入力させず brandId から導出する（server action 側で Brand から取得）。
 * - categoryId は schema 上 optional だが、採番に必要なため **ここで必須化**する。
 * - status は ProductStatus（13値）。archive/restore はアクション側で扱う。
 */

// =============================================================================
// 共通バリデーション
// =============================================================================
const requiredString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}は必須です`)
    .max(max, `${max}文字以内で入力してください`)

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

/**
 * 任意の非負整数（数量系：expectedQuantity 用）
 * 空文字・null・undefined は null。文字列で来た数値も number 化する。
 */
const optionalNonNegativeInt = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? Math.trunc(n) : null
  })
  .refine((v) => v === null || v >= 0, "0以上の整数で入力してください")
  .nullable()
  .default(null)

/** 任意の関連 ID（"" は null 化）。User / Inquiry 等の FK 用 */
const optionalRelationId = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" ? null : v))

/** 任意の日付文字列（"" は null）。Date への変換は actions 層で行う */
const optionalDateString = z
  .string()
  .nullable()
  .default(null)
  .transform((v) => (v === "" || v === null ? null : v))

// =============================================================================
// 採番フォーマット（参照用、validator では使わない）
// =============================================================================
/** `{brandCode}-{season}-{categoryCode}-{001}` 形式 */
export const PRODUCT_CODE_FORMAT_HINT = "{ブランド略号}-{シーズン}-{カテゴリ}-{連番3桁}"

// =============================================================================
// 品番カルテ本体スキーマ（編集可能フィールドのみ）
// =============================================================================
export const productBaseSchema = z.object({
  // 関連エンティティ（clientId は brandId から導出するため含めない）
  brandId: z.string().min(1, "ブランドは必須です"),
  // categoryId は採番に必須。schema は optional のままだが Zod で必須化する。
  categoryId: z.string().min(1, "商品カテゴリは必須です"),

  // 先方品番（任意・常設。サンプル期は空でよい）
  clientProductCode: optionalString(50),

  // 基本情報
  productName: requiredString(255, "品名"),
  productNameEn: optionalString(255),
  description: optionalString(10000),
  silhouette: optionalString(100),

  // シーズン・年度
  season: requiredString(20, "シーズン"),
  year: z.coerce
    .number()
    .int("年度は整数で入力してください")
    .min(2000, "2000以上で入力してください")
    .max(2100, "2100以下で入力してください"),

  // 数量・納期（任意）
  expectedQuantity: optionalNonNegativeInt,
  desiredDeliveryDate: optionalDateString,

  // 担当者（任意）
  assignedToUserId: optionalRelationId,
  designerId: optionalRelationId,
  patternMakerId: optionalRelationId,

  // メモ
  internalNotes: optionalString(10000),

  // ステータス
  status: z.nativeEnum(ProductStatus).default(ProductStatus.PLANNING),
})

export type ProductFormValues = z.input<typeof productBaseSchema>
export type ProductInput = z.infer<typeof productBaseSchema>

// 用途別エイリアス（master-patterns §4 命名規約）
export const createProductSchema = productBaseSchema
export const updateProductSchema = productBaseSchema

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================
export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  season: z.string().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListProductsQuery = z.input<typeof listProductsQuerySchema>
export type ListProductsParams = z.infer<typeof listProductsQuerySchema>
