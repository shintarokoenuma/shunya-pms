import { z } from "zod"
import { DeliveryDestinationStatus } from "@prisma/client"

/**
 * Phase 1A-10: 納品先（DeliveryDestination）バリデータ
 *
 * 設計方針（spec 2026-05-27）:
 * - Buyer と同じ「住所あり業務マスター」パターン
 * - buyerId は必須（DD は必ず Buyer に紐づく）
 * - destinationCode は <buyerCode>-<location> 形式を推奨（DB は @@unique のみ、文字列制約なし）
 * - 住所 5 分割 + addressLine2（DD は物理拠点なので階数情報が業務上必須）
 * - Contact モデルなし（contactPerson / phone / email の単一フィールド）
 * - 配送指示は自由入力（deliveryNotes Textarea / preferredDeliveryDays・Hours は Input）
 * - timezone のみ追加（海外納品時の現地時間 vs JST 解釈曖昧性を解消）
 * - status は DeliveryDestinationStatus enum（ACTIVE / ARCHIVED）
 * - country === "JP" のとき郵便番号 7 桁形式チェック
 */

// =============================================================================
// 共通バリデーション（buyer.ts と命名を揃える）
// =============================================================================

const requiredString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}は必須です`)
    .max(max, `${max}文字以内で入力してください`)

const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

const optionalEmail = z
  .string()
  .max(255, "255文字以内で入力してください")
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "メールアドレスの形式が正しくありません",
  )
  .default("")

const optionalPostalCode = z
  .string()
  .max(20, "20文字以内で入力してください")
  .refine(
    (v) => v === "" || /^[\d\-A-Za-z]{3,20}$/.test(v),
    "郵便番号の形式が正しくありません",
  )
  .default("")

// =============================================================================
// 納品先本体スキーマ
// =============================================================================
export const deliveryDestinationBaseSchema = z
  .object({
    // 基本情報
    buyerId: z.string().min(1, "バイヤーは必須です"),
    destinationCode: z
      .string()
      .trim()
      .min(1, "納品先コードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "英数字・ハイフン・アンダースコアのみ使用できます",
      ),
    destinationName: requiredString(255, "納品先名"),

    // 住所（A-3：5 分割 + addressLine2）
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

    // 連絡先（A-2：単一連絡先）
    contactPerson: optionalString(255),
    phone: optionalString(50),
    email: optionalEmail,

    // 配送指示（C-3：自由入力）
    deliveryNotes: optionalString(5000),
    preferredDeliveryDays: optionalString(255),
    preferredDeliveryHours: optionalString(255),

    // 海外取引（A-4：timezone のみ）
    timezone: optionalString(50),

    // メモ
    notes: optionalString(5000),

    // ステータス
    status: z
      .nativeEnum(DeliveryDestinationStatus)
      .default(DeliveryDestinationStatus.ACTIVE),
  })
  .superRefine((data, ctx) => {
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

export type DeliveryDestinationBaseInput = z.input<
  typeof deliveryDestinationBaseSchema
>
export type DeliveryDestinationBaseOutput = z.output<
  typeof deliveryDestinationBaseSchema
>

// =============================================================================
// 用途別スキーマ
// =============================================================================
export const createDeliveryDestinationSchema = deliveryDestinationBaseSchema
export const updateDeliveryDestinationSchema = deliveryDestinationBaseSchema

export type DeliveryDestinationFormValues = z.input<
  typeof deliveryDestinationBaseSchema
>
export type DeliveryDestinationInput = z.infer<
  typeof deliveryDestinationBaseSchema
>
export type CreateDeliveryDestinationInput = z.input<
  typeof createDeliveryDestinationSchema
>
export type UpdateDeliveryDestinationInput = z.input<
  typeof updateDeliveryDestinationSchema
>

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================
export const listDeliveryDestinationsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  buyerId: z.string().optional(),
  clientId: z.string().optional(),
  status: z.nativeEnum(DeliveryDestinationStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListDeliveryDestinationsQuery = z.input<
  typeof listDeliveryDestinationsQuerySchema
>
export type ListDeliveryDestinationsParams = z.infer<
  typeof listDeliveryDestinationsQuerySchema
>
