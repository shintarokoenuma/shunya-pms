import { z } from "zod"
import { ModelCodeStatus, OwnershipType } from "@prisma/client"

/**
 * Phase 1A-12: 型番（ModelCode）バリデータ
 *
 * 設計方針（spec 2026-05-27）:
 * - ハイブリッド実装：基本情報は手動編集可、累積データ / 保有資産は読み取り専用
 *   （validator は編集可能フィールドのみ扱う）
 * - modelCode は自動採番（M-{brandCode}-{4桁連番}）。validator には含めない
 *   - 新規作成時：server action 内で transaction 経由で採番
 *   - 更新時：immutable（server action 側で existing.modelCode を維持）
 * - brandId 必須、modelName 必須
 * - 4 値ステータス（ACTIVE / INACTIVE / DISCONTINUED / ARCHIVED）
 * - categoryId は ProductCategory 未実装のため optional
 */

// =============================================================================
// 採番フォーマット（参照用、validator では使わない）
// =============================================================================
/** `M-{brandCode}-{0001}` 形式。brandCode は 1〜20 文字の英数字 */
export const MODEL_CODE_FORMAT_REGEX = /^M-[A-Z0-9]{1,20}-\d{4}$/

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

// =============================================================================
// 型番本体スキーマ（編集可能フィールドのみ）
// =============================================================================
export const modelCodeBaseSchema = z.object({
  // 基本情報（modelCode は除く：自動採番）
  brandId: z.string().min(1, "ブランドは必須です"),
  modelName: requiredString(255, "モデル名"),
  modelNameEn: optionalString(255),
  description: optionalString(10000),

  // 商品分類
  categoryId: z
    .string()
    .nullable()
    .default(null)
    .transform((v) => (v === "" ? null : v)),
  silhouette: optionalString(100),

  // 所有権
  patternOwnership: z
    .nativeEnum(OwnershipType)
    .default(OwnershipType.SHUNYA),
  designOwnership: z
    .nativeEnum(OwnershipType)
    .default(OwnershipType.SHUNYA),

  // ステータス
  status: z.nativeEnum(ModelCodeStatus).default(ModelCodeStatus.ACTIVE),
})

export type ModelCodeBaseInput = z.input<typeof modelCodeBaseSchema>
export type ModelCodeBaseOutput = z.output<typeof modelCodeBaseSchema>

// =============================================================================
// 用途別スキーマ
// =============================================================================
export const createModelCodeSchema = modelCodeBaseSchema
export const updateModelCodeSchema = modelCodeBaseSchema

export type ModelCodeFormValues = z.input<typeof modelCodeBaseSchema>
export type ModelCodeInput = z.infer<typeof modelCodeBaseSchema>
export type CreateModelCodeInput = z.input<typeof createModelCodeSchema>
export type UpdateModelCodeInput = z.input<typeof updateModelCodeSchema>

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================
export const listModelCodesQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.nativeEnum(ModelCodeStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListModelCodesQuery = z.input<typeof listModelCodesQuerySchema>
export type ListModelCodesParams = z.infer<typeof listModelCodesQuerySchema>
