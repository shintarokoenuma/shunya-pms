import { z } from "zod"
import {
  ClientBusinessType,
  ClientDisplayPattern,
  ClientSize,
  ClientStatus,
  LeadSource,
  PaymentTermType,
  TaxRoundingMode,
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

// B-252（D-2・D-4）: 先方担当者は任意。姓か名のどちらかがあれば主担当の行を作る（action）。
// 姓も名も空で他の項目だけあるときは superRefine で弾く
export const primaryContactSchema = z.object({
  firstName: optionalString(100),
  lastName: optionalString(100),
  email: optionalEmail,
  phone: optionalString(50),
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
    // B-252（D-2）: 電話・メール・住所は任意（未入力は一覧・詳細に出す）
    phone: optionalString(50),
    email: optionalEmail,
    website: optionalUrl,

    // マスター住所（任意・JP のとき郵便番号は入力したときだけ形式を見る）
    postalCode: optionalPostalCode,
    prefecture: optionalString(50),
    city: optionalString(100),
    address: optionalString(500),
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
    // B-109 PR-3 の確認で発見: デポジット比率は整数 1〜100（列は Decimal(5,2) のまま整数だけ入れる）
    depositPercentage: z.coerce
      .number()
      .int("デポジット比率は1〜100の整数で入力してください")
      .min(1, "デポジット比率は1〜100の整数で入力してください")
      .max(100, "デポジット比率は1〜100の整数で入力してください")
      .optional(),
    // B-109 PR-2a（D-23・D-36）: 消費税の端数処理はクライアントごと。既定は四捨五入。
    taxRoundingMode: z.nativeEnum(TaxRoundingMode).default("ROUND_HALF_UP"),
    // B-109 PR-2a: 適格請求書発行事業者と登録番号（列は既存・validator と画面に無かった）
    isQualifiedInvoiceIssuer: z.boolean().default(true),
    taxId: optionalString(50),

    // 担当者（B-252 D-5: 自社担当者は任意。空は action で null）
    assignedToUserId: z.string().trim().default(""),
    primaryContact: primaryContactSchema,

    // 運用
    status: z.nativeEnum(ClientStatus).default("ACTIVE"),
    notes: optionalString(5000),
  })
  // 別住所チェックボックス ON のとき各フィールド必須
  .superRefine((data, ctx) => {
    // メイン住所: country === "JP" のとき、郵便番号は入力したときだけ形式を見る（B-252 D-3。必須にはしない）
    if (data.country === "JP") {
      if (data.postalCode && !/^\d{3}-?\d{4}$/.test(data.postalCode)) {
        ctx.addIssue({
          code: "custom",
          path: ["postalCode"],
          message: "郵便番号は7桁（例：150-0043）で入力してください",
        })
      }
    }
    // B-252（D-4）: 姓も名も空なのに他の項目があるときは弾く
    const pc = data.primaryContact
    if (
      pc.firstName.trim() === "" &&
      pc.lastName.trim() === "" &&
      [pc.email, pc.phone, pc.jobTitle, pc.department].some((v) => (v ?? "").trim() !== "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["primaryContact", "lastName"],
        message: "担当者の姓か名を入れてください",
      })
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
