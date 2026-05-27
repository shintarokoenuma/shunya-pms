import { z } from "zod"
import { Currency, MaterialStatus, MaterialType } from "@prisma/client"

/**
 * Phase 1A-13a: 素材（Material）バリデータ
 *
 * 設計方針（spec 2026-05-27）:
 * - 段階的実装。Phase 1A-13a は約 13 個の基本コアフィールドのみ扱う
 *   生地特有 / 規格 / 貿易 / 画像 / 色展開 / 多言語（Zh/Vi）は Phase 1A-13b/13c で追加
 * - materialCode は手動入力（自動採番なし）。多様なフォーマットを許容するため
 *   英数字 + ハイフン + アンダースコア + スラッシュ + ピリオドを許可
 * - 必須: materialCode / materialName / materialType / primarySupplierId / unit
 * - status は MaterialStatus enum（4 値、ModelCode と同じ構成）
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
 * 任意の非負 Decimal（unitPrice / minimumOrderQty 用）
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
  .refine((v) => v === null || v >= 0, "0以上の数値で入力してください")
  .nullable()

// =============================================================================
// 素材本体スキーマ（Phase 1A-13a：基本コアのみ）
// =============================================================================
export const materialBaseSchema = z.object({
  // 基本情報
  materialCode: z
    .string()
    .trim()
    .min(1, "素材コードは必須です")
    .max(50, "50文字以内で入力してください")
    .regex(
      /^[A-Za-z0-9\-_./]+$/,
      "英数字・ハイフン・アンダースコア・スラッシュ・ピリオドのみ使用できます",
    ),
  materialName: requiredString(255, "素材名"),
  materialNameEn: optionalString(255),

  // 分類・仕入先
  materialType: z.nativeEnum(MaterialType, {
    message: "素材タイプを選択してください",
  }),
  categoryId: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => (v === "" ? null : v)),
  primarySupplierId: z.string().min(1, "仕入先は必須です"),

  // 単価
  unitPrice: optionalPositiveDecimal,
  currency: z.nativeEnum(Currency).default(Currency.JPY),
  unit: requiredString(20, "単位"),
  minimumOrderQty: optionalPositiveDecimal,

  // メモ
  specification: optionalString(10000),
  notes: optionalString(5000),

  // ステータス
  status: z.nativeEnum(MaterialStatus).default(MaterialStatus.ACTIVE),
})

export type MaterialBaseInput = z.input<typeof materialBaseSchema>
export type MaterialBaseOutput = z.output<typeof materialBaseSchema>

// =============================================================================
// 用途別スキーマ
// =============================================================================
export const createMaterialSchema = materialBaseSchema
export const updateMaterialSchema = materialBaseSchema

export type MaterialFormValues = z.input<typeof materialBaseSchema>
export type MaterialInput = z.infer<typeof materialBaseSchema>
export type CreateMaterialInput = z.input<typeof createMaterialSchema>
export type UpdateMaterialInput = z.input<typeof updateMaterialSchema>

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================
export const listMaterialsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  materialType: z.nativeEnum(MaterialType).optional(),
  primarySupplierId: z.string().optional(),
  status: z.nativeEnum(MaterialStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListMaterialsQuery = z.input<typeof listMaterialsQuerySchema>
export type ListMaterialsParams = z.infer<typeof listMaterialsQuerySchema>
