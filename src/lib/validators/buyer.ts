import { z } from "zod"
import { BuyerStatus } from "@prisma/client"

/**
 * Phase 1A-11: バイヤーマスター バリデータ
 *
 * 設計方針:
 * - Client / Supplier / Factory / Contractor と同じ「住所あり業務マスター」パターン
 * - clientId は optional（仕様確定議事録 2026-05-25 §2 Q2）
 * - 住所 5 分割（postalCode / country / prefecture / city / address / addressLine2）
 *   AddressFields 共通コンポーネントと整合
 * - Contact モデルなし（連絡先は contactPerson / phone / email の単一フィールド）
 * - status は BuyerStatus enum（ACTIVE / ARCHIVED）。PAUSED なし
 * - country === "JP" のとき郵便番号形式チェック（superRefine 内）
 */

// =============================================================================
// 共通バリデーション（client.ts のヘルパー命名と揃える）
// =============================================================================

/** 必須の文字列フィールド。trim + 空欄不可 + max 文字制限。 */
const requiredString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}は必須です`)
    .max(max, `${max}文字以内で入力してください`)

/** 任意の文字列フィールド。空文字列 OR max 文字までを受け入れる。 */
const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

/** 任意メールアドレス。 */
const optionalEmail = z
  .string()
  .max(255, "255文字以内で入力してください")
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "メールアドレスの形式が正しくありません",
  )
  .default("")

/** 任意の郵便番号（緩い形式チェック、JP のみ superRefine で厳密化）。 */
const optionalPostalCode = z
  .string()
  .max(20, "20文字以内で入力してください")
  .refine(
    (v) => v === "" || /^[\d\-A-Za-z]{3,20}$/.test(v),
    "郵便番号の形式が正しくありません",
  )
  .default("")

// =============================================================================
// バイヤー本体スキーマ
// =============================================================================
export const buyerBaseSchema = z
  .object({
    // 基本情報
    buyerCode: z
      .string()
      .trim()
      .min(1, "バイヤーコードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "英数字・ハイフン・アンダースコアのみ使用できます",
      ),
    buyerName: requiredString(255, "バイヤー名"),
    buyerNameEn: optionalString(255),

    // 関連クライアント（optional、空文字は null として扱う）
    clientId: z
      .string()
      .nullable()
      .default(null)
      .transform((v) => (v === "" ? null : v)),

    // 連絡先（住所 5 分割 + 個別）
    country: z
      .string()
      .trim()
      .length(2, "国コードは 2 文字で入力してください")
      .default("JP"),
    postalCode: optionalPostalCode,
    prefecture: optionalString(50),
    city: optionalString(100),
    address: optionalString(1000),
    addressLine2: optionalString(255),
    contactPerson: optionalString(255),
    phone: optionalString(50),
    email: optionalEmail,

    // メモ
    notes: optionalString(5000),

    // ステータス
    status: z.nativeEnum(BuyerStatus).default(BuyerStatus.ACTIVE),
  })
  .superRefine((data, ctx) => {
    // JP の場合は郵便番号を 7 桁（ハイフン有無いずれも可）に厳密化
    if (data.country === "JP" && data.postalCode !== "") {
      if (!/^\d{3}-?\d{4}$/.test(data.postalCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "郵便番号は 7 桁（例：150-0043）で入力してください",
          path: ["postalCode"],
        })
      }
    }
  })

export type BuyerBaseInput = z.input<typeof buyerBaseSchema>
export type BuyerBaseOutput = z.output<typeof buyerBaseSchema>

// =============================================================================
// 用途別スキーマ（client.ts と同じく base = create = update のエイリアス）
// =============================================================================
export const createBuyerSchema = buyerBaseSchema
export const updateBuyerSchema = buyerBaseSchema

export type BuyerFormValues = z.input<typeof buyerBaseSchema>
export type BuyerInput = z.infer<typeof buyerBaseSchema>
export type CreateBuyerInput = z.input<typeof createBuyerSchema>
export type UpdateBuyerInput = z.input<typeof updateBuyerSchema>

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================
export const listBuyersQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  clientId: z.string().optional(),
  status: z.nativeEnum(BuyerStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListBuyersQuery = z.input<typeof listBuyersQuerySchema>
export type ListBuyersParams = z.infer<typeof listBuyersQuerySchema>
