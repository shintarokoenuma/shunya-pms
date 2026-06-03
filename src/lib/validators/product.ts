import { z } from "zod"
import { ProductStatus } from "@prisma/client"

/**
 * S-1: 品番カルテ（Product）バリデータ
 *
 * 設計方針（指示書 s-1-product-crud-implementation-brief-2026-06-03.md）:
 * - S-1 は「品番を発番して器を作る」を成立させる最小フォーム
 *   価格・数量・納期・海外生産・担当者・所有権などのフィールドはフォーム外
 *   （schema 列は温存・update 時は既存値維持）
 * - productCode は自動採番（{brandCode}-{season}-{categoryCode}-{3桁連番}）
 *   保存時に transaction 内で再計算・確定。validator では受け取らない
 * - categoryId は schema 上 optional だが、採番に categoryCode が必須のため
 *   superRefine で必須化する（schema は据え置き）
 * - modelCode は「既存選択(existing)」「新規発番(new)」の 2 モード
 *   - existing: modelCodeId 必須
 *   - new: newModelCodeModelName 必須（brandId は両モード共通必須）
 * - status は ProductStatus enum 13 値（10 段階 + CANCELLED / ON_HOLD / ARCHIVED）
 *   create では default PLANNING、update で全 enum 選択可（自由遷移は S-1 のみ・S-2/S-3 で制約導入）
 */

// =============================================================================
// 採番フォーマット（参照用、validator では使わない）
// =============================================================================
/** `{brandCode}-{season}-{categoryCode}-{001}` 形式 */
export const PRODUCT_CODE_FORMAT_DESCRIPTION =
  "ブランド略号-シーズン-カテゴリ略号-連番3桁（例: MK-26SS-TS-001）"

/**
 * シーズン表記の許容パターン（業界慣行に合わせて 6 種）
 * 例: 26SS, 26FW, 26AW, 26Pre, 26Cruise, 26Resort
 */
export const SEASON_PATTERN = /^\d{2}(SS|FW|AW|Pre|Cruise|Resort)$/

// =============================================================================
// 共通ヘルパー
// =============================================================================
const requiredString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}は必須です`)
    .max(max, `${max}文字以内で入力してください`)

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

// =============================================================================
// ModelCode モード
// =============================================================================
export const MODEL_CODE_MODE_VALUES = ["existing", "new"] as const
export type ModelCodeMode = (typeof MODEL_CODE_MODE_VALUES)[number]

// =============================================================================
// 品番本体スキーマ（編集可能フィールドのみ）
// =============================================================================
export const productBaseSchema = z
  .object({
    // 基本情報（productCode は除く: 自動採番）
    productName: requiredString(255, "商品名"),
    productNameEn: optionalString(255),
    description: optionalString(10000),
    clientProductCode: optionalString(50),

    // 関連エンティティ（schema は categoryId optional だが採番のため必須化）
    clientId: z.string().min(1, "クライアントは必須です"),
    brandId: z.string().min(1, "ブランドは必須です"),
    categoryId: z
      .string()
      .nullable()
      .default(null)
      .transform((v) => (v === "" ? null : v)),

    // ModelCode モード
    modelCodeMode: z.enum(MODEL_CODE_MODE_VALUES).default("existing"),
    modelCodeId: z
      .string()
      .nullable()
      .default(null)
      .transform((v) => (v === "" ? null : v)),
    newModelCodeModelName: optionalString(255),

    // シーズン
    season: z
      .string()
      .trim()
      .min(1, "シーズンは必須です")
      .regex(
        SEASON_PATTERN,
        "シーズンは 2桁年+SS/FW/AW/Pre/Cruise/Resort（例: 26SS）で入力してください",
      ),
    year: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "number" ? v : Number(v)))
      .refine(
        (v) => Number.isInteger(v) && v >= 2000 && v <= 2100,
        "年度は 2000〜2100 の整数で入力してください",
      ),

    // ステータス（create では default PLANNING、update で全 enum 選択可）
    status: z.nativeEnum(ProductStatus).default(ProductStatus.PLANNING),
  })
  .superRefine((data, ctx) => {
    // categoryId 必須化（採番に categoryCode が必須のため）
    if (!data.categoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "商品カテゴリは必須です（社内品番の採番に使用します）",
        path: ["categoryId"],
      })
    }

    // ModelCode モード別の必須チェック
    if (data.modelCodeMode === "existing") {
      if (!data.modelCodeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "既存モデルコードを選択してください",
          path: ["modelCodeId"],
        })
      }
    } else {
      // mode === "new"
      if (!data.newModelCodeModelName || data.newModelCodeModelName.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "新規モデルコードのモデル名は必須です",
          path: ["newModelCodeModelName"],
        })
      }
    }
  })

export type ProductBaseInput = z.input<typeof productBaseSchema>
export type ProductBaseOutput = z.output<typeof productBaseSchema>

// =============================================================================
// 用途別スキーマ
// =============================================================================
export const createProductSchema = productBaseSchema
export const updateProductSchema = productBaseSchema

export type ProductFormValues = z.input<typeof productBaseSchema>
export type ProductInput = z.infer<typeof productBaseSchema>
export type CreateProductInput = z.input<typeof createProductSchema>
export type UpdateProductInput = z.input<typeof updateProductSchema>

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================
export const listProductsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  season: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListProductsQuery = z.input<typeof listProductsQuerySchema>
export type ListProductsParams = z.infer<typeof listProductsQuerySchema>
