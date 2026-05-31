import { z } from "zod"
import { Currency, MaterialStatus, MaterialType } from "@prisma/client"

/**
 * Phase 1A-13a + 1A-13b: 素材（Material）バリデータ
 *
 * 設計方針（spec 2026-05-27 / 1A-13b spec 2026-05-31 v1.0）:
 * - 1A-13a: 基本コアフィールド (materialCode/Name/Type/primarySupplierId/unit/単価/status 等)
 * - 1A-13b: 生地仕様 (fabricWeight / fabricWidth / composition / swatchImageUrl) +
 *           規格・標準 (standardUsage / standardLossRate) +
 *           貿易 (hsCode / originCountry) +
 *           画像 (imageUrl) を追加
 * - JSON 列 (compositionData / availableColors) は Phase 2 送り
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

/**
 * 任意の 0 より大きい Decimal（fabricWeight / fabricWidth / standardUsage 用）
 * 空文字・null・undefined は null として扱う
 * `.default(null)` でフォーム入力欄が無くても null として通る (任意項目)
 */
const optionalStrictlyPositiveDecimal = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : null
  })
  .refine((v) => v === null || v > 0, "0より大きい数値で入力してください")
  .nullable()
  .default(null)

/**
 * 任意のパーセント Decimal（standardLossRate 用、0 〜 100）
 * 空文字・null・undefined は null として扱う
 */
const optionalPercentDecimal = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : null
  })
  .refine(
    (v) => v === null || (v >= 0 && v <= 100),
    "0以上 100以下の数値で入力してください",
  )
  .nullable()
  .default(null)

/**
 * 任意の http(s) URL（imageUrl / swatchImageUrl 用）
 * 空文字・null・undefined は null として扱う
 * 形式は http:// または https:// で始まることのみチェック（厳密な URL parser は使わない）
 */
const optionalHttpUrl = z
  .union([z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined) return null
    const trimmed = v.trim()
    return trimmed === "" ? null : trimmed
  })
  .refine(
    (v) => v === null || /^https?:\/\/.+/.test(v),
    "http:// または https:// で始まる URL を入力してください",
  )
  .nullable()
  .default(null)

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

  // 生地仕様（Phase 1A-13b）
  fabricWeight: optionalStrictlyPositiveDecimal, // g/m²
  fabricWidth: optionalStrictlyPositiveDecimal, // cm
  composition: optionalString(1000), // 自由記述 (例: Cotton 100%)
  swatchImageUrl: optionalHttpUrl, // 生地見本画像 URL

  // 規格・標準（Phase 1A-13b）
  standardUsage: optionalStrictlyPositiveDecimal, // m/枚
  standardLossRate: optionalPercentDecimal, // 0 〜 100 %

  // 貿易（Phase 1A-13b）
  hsCode: optionalString(20), // 形式チェックは緩め (上限のみ)
  originCountry: optionalString(2), // ISO 3166-1 alpha-2 (UI Select で制約)

  // 画像（Phase 1A-13b、UI では基本情報カード末尾に配置）
  imageUrl: optionalHttpUrl,

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
