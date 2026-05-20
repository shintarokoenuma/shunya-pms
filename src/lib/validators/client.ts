import { z } from "zod"
import {
  ClientBusinessType,
  ClientDisplayPattern,
  ClientSize,
  ClientStatus,
  LeadSource,
  PaymentTermType,
} from "@prisma/client"

// =============================================================================
// 共通バリデーション
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

/** 必須メールアドレス。 */
const requiredEmail = z
  .string()
  .trim()
  .min(1, "メールアドレスは必須です")
  .max(255, "255文字以内で入力してください")
  .refine(
    (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "メールアドレスの形式が正しくありません"
  )

/** 任意メールアドレス。 */
const optionalEmail = z
  .string()
  .max(255, "255文字以内で入力してください")
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "メールアドレスの形式が正しくありません"
  )
  .default("")

/** 任意 URL。 */
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

/** 郵便番号（日本：7桁、ハイフン有無いずれも許容）。 */
const requiredPostalCodeJp = z
  .string()
  .trim()
  .min(1, "郵便番号は必須です")
  .refine(
    (v) => /^\d{3}-?\d{4}$/.test(v),
    "郵便番号は7桁（例：150-0043）で入力してください"
  )

const optionalPostalCode = z
  .string()
  .max(20)
  .refine(
    (v) => v === "" || /^[\d\-A-Za-z]{3,20}$/.test(v),
    "郵便番号の形式が正しくありません"
  )
  .default("")

// =============================================================================
// 先方担当者（主担当）スキーマ
// =============================================================================

export const primaryContactSchema = z.object({
  firstName: requiredString(100, "担当者の姓"),
  lastName: requiredString(100, "担当者の名"),
  email: requiredEmail,
  phone: requiredString(50, "担当者の電話番号"),
  jobTitle: optionalString(255),
  department: optionalString(255),
})

export type PrimaryContactInput = z.input<typeof primaryContactSchema>

// =============================================================================
// Client 基本スキーマ（Phase 1A-2 仕様）
// =============================================================================

export const clientBaseSchema = z
  .object({
    // 基本
    clientCode: z
      .string()
      .trim()
      .min(1, "クライアントコードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "英数字・ハイフン・アンダースコアのみ使用できます"
      ),
    companyName: requiredString(255, "会社名"),
    legalEntity: optionalString(255),

    // 分類
    businessType: z.nativeEnum(ClientBusinessType),
    clientSize: z.nativeEnum(ClientSize).optional(),

    // 連絡先
    country: z
      .string()
      .trim()
      .length(2, "ISO 3166-1 alpha-2 の2文字で入力してください")
      .toUpperCase()
      .default("JP"),
    phone: requiredString(50, "電話番号"),
    email: requiredEmail,
    website: optionalUrl,

    // マスター住所（必須）
    postalCode: optionalPostalCode,
    prefecture: optionalString(50),
    city: requiredString(100, "市区町村"),
    address: requiredString(500, "住所1"),
    addressLine2: optionalString(255),

    // 請求書発送先（マスターと別の場合のみ入力、すべて任意）
    useSeparateBillingAddress: z.boolean().default(false),
    billingPostalCode: optionalPostalCode,
    billingPrefecture: optionalString(50),
    billingCity: optionalString(100),
    billingAddress: optionalString(500),
    billingAddressLine2: optionalString(255),

    // 商品配送先（マスターと別の場合のみ入力、すべて任意）
    useSeparateShippingAddress: z.boolean().default(false),
    shippingPostalCode: optionalPostalCode,
    shippingPrefecture: optionalString(50),
    shippingCity: optionalString(100),
    shippingAddress: optionalString(500),
    shippingAddressLine2: optionalString(255),

    // 表示
    displayPattern: z.nativeEnum(ClientDisplayPattern).default("B"),

    // 営業
    leadSource: z.nativeEnum(LeadSource).optional(),
    referrer: optionalString(255),

    // 取引条件
    paymentTermType: z.nativeEnum(PaymentTermType).default("DEPOSIT_COD"),
    closingDay: z.coerce
      .number()
      .int()
      .min(1, "1〜31で入力してください")
      .max(31, "1〜31で入力してください")
      .optional(),
    paymentMonthOffset: z.coerce
      .number()
      .int()
      .min(0, "0以上で入力してください")
      .max(12, "12以下で入力してください")
      .optional(),
    paymentDay: z.coerce
      .number()
      .int()
      .min(1, "1〜31で入力してください")
      .max(31, "1〜31で入力してください")
      .optional(),
    depositRequired: z.boolean().default(false),
    depositPercentage: z.coerce
      .number()
      .min(0, "0以上で入力してください")
      .max(100, "100以下で入力してください")
      .optional(),

    // 担当者
    assignedToUserId: z
      .string()
      .trim()
      .min(1, "shunya側担当者は必須です"),
    primaryContact: primaryContactSchema,

    // 運用
    status: z.nativeEnum(ClientStatus).default("ACTIVE"),
    notes: optionalString(5000),
  })
  // 別住所チェックボックス ON のとき各フィールド必須
  .superRefine((data, ctx) => {
    // メイン住所: country === "JP" のときのみ郵便番号・都道府県を必須・形式チェック
    if (data.country === "JP") {
      if (!data.postalCode) {
        ctx.addIssue({
          code: "custom",
          path: ["postalCode"],
          message: "郵便番号は必須です",
        })
      } else if (!/^\d{3}-?\d{4}$/.test(data.postalCode)) {
        ctx.addIssue({
          code: "custom",
          path: ["postalCode"],
          message: "郵便番号は7桁（例：150-0043）で入力してください",
        })
      }
      if (!data.prefecture) {
        ctx.addIssue({
          code: "custom",
          path: ["prefecture"],
          message: "都道府県は必須です",
        })
      }
    }

    if (data.useSeparateBillingAddress) {
      if (!data.billingPostalCode) {
        ctx.addIssue({
          code: "custom",
          path: ["billingPostalCode"],
          message: "請求書発送先の郵便番号は必須です",
        })
      } else if (data.country === "JP" && !/^\d{3}-?\d{4}$/.test(data.billingPostalCode)) {
        ctx.addIssue({
          code: "custom",
          path: ["billingPostalCode"],
          message: "請求書発送先の郵便番号は7桁（例：150-0043）で入力してください",
        })
      }
      if (!data.billingPrefecture) {
        ctx.addIssue({
          code: "custom",
          path: ["billingPrefecture"],
          message: "請求書発送先の都道府県は必須です",
        })
      }
      if (!data.billingCity) {
        ctx.addIssue({
          code: "custom",
          path: ["billingCity"],
          message: "請求書発送先の市区町村は必須です",
        })
      }
      if (!data.billingAddress) {
        ctx.addIssue({
          code: "custom",
          path: ["billingAddress"],
          message: "請求書発送先の住所は必須です",
        })
      }
    }
    if (data.useSeparateShippingAddress) {
      if (!data.shippingPostalCode) {
        ctx.addIssue({
          code: "custom",
          path: ["shippingPostalCode"],
          message: "配送先の郵便番号は必須です",
        })
      } else if (data.country === "JP" && !/^\d{3}-?\d{4}$/.test(data.shippingPostalCode)) {
        ctx.addIssue({
          code: "custom",
          path: ["shippingPostalCode"],
          message: "配送先の郵便番号は7桁（例：150-0043）で入力してください",
        })
      }
      if (!data.shippingPrefecture) {
        ctx.addIssue({
          code: "custom",
          path: ["shippingPrefecture"],
          message: "配送先の都道府県は必須です",
        })
      }
      if (!data.shippingCity) {
        ctx.addIssue({
          code: "custom",
          path: ["shippingCity"],
          message: "配送先の市区町村は必須です",
        })
      }
      if (!data.shippingAddress) {
        ctx.addIssue({
          code: "custom",
          path: ["shippingAddress"],
          message: "配送先の住所は必須です",
        })
      }
    }

    // 取引条件の条件付き必須
    if (data.paymentTermType === "MONTHLY_CLOSING") {
      if (data.closingDay === undefined || data.closingDay === null) {
        ctx.addIssue({
          code: "custom",
          path: ["closingDay"],
          message: "締め日は必須です",
        })
      }
      if (
        data.paymentMonthOffset === undefined ||
        data.paymentMonthOffset === null
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["paymentMonthOffset"],
          message: "支払い月（オフセット）は必須です",
        })
      }
      if (data.paymentDay === undefined || data.paymentDay === null) {
        ctx.addIssue({
          code: "custom",
          path: ["paymentDay"],
          message: "支払日は必須です",
        })
      }
    }
    if (data.paymentTermType === "DEPOSIT_COD") {
      if (
        data.depositPercentage === undefined ||
        data.depositPercentage === null
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["depositPercentage"],
          message: "デポジット比率は必須です",
        })
      }
    }
  })

export type ClientBaseInput = z.input<typeof clientBaseSchema>
export type ClientBaseOutput = z.output<typeof clientBaseSchema>

// =============================================================================
// 用途別スキーマ
// =============================================================================

export const createClientSchema = clientBaseSchema
// 編集時は primaryContact だけは別オペレーションで扱う（連絡先は別 model）
export const updateClientSchema = clientBaseSchema

export type CreateClientInput = z.input<typeof createClientSchema>
export type UpdateClientInput = z.input<typeof updateClientSchema>

// =============================================================================
// 一覧クエリ用スキーマ
// =============================================================================

export const listClientsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.nativeEnum(ClientStatus).optional(),
  businessType: z.nativeEnum(ClientBusinessType).optional(),
  country: z.string().trim().length(2).toUpperCase().optional(),
  sort: z
    .enum(["companyName", "clientCode", "createdAt", "updatedAt"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListClientsQuery = z.input<typeof listClientsQuerySchema>
