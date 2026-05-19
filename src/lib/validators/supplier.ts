import { z } from "zod"
import {
  PaymentTermType,
  SupplierStatus,
  SupplierType,
  Language,
  Currency,
} from "@prisma/client"

/**
 * Phase 1A-4: 仕入先マスター バリデータ
 *
 * 設計方針:
 * - Client/Brand と同じパターン（archive / restore / permanent delete 分離）
 * - taxId は国内仕入先（country === "JP"）のみ必須
 * - 取引条件は paymentMonthOffset + paymentDay（プリセット運用）
 * - SupplierType は複数選択可（最低1件必須）
 */

// ヘルパー: 空文字も許容する任意文字列
const optionalString = (max: number) =>
  z
    .string()
    .max(max, `${max}文字以内で入力してください`)
    .default("")
    .refine((v) => v.length <= max, `${max}文字以内で入力してください`)

// メールアドレス（任意）
const optionalEmail = z
  .string()
  .default("")
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "正しいメールアドレス形式で入力してください"
  )

// URL（任意）
const optionalUrl = z
  .string()
  .default("")
  .refine((v) => {
    if (v === "") return true
    try {
      new URL(v)
      return true
    } catch {
      return false
    }
  }, "正しいURL形式で入力してください")

// taxId 形式: T + 13桁数字
const taxIdPattern = /^T\d{13}$/

/**
 * Supplier 主担当者
 */
export const supplierPrimaryContactSchema = z.object({
  firstName: z
    .string()
    .min(1, "名は必須です")
    .max(100, "100文字以内で入力してください"),
  lastName: z
    .string()
    .min(1, "姓は必須です")
    .max(100, "100文字以内で入力してください"),
  jobTitle: optionalString(255),
  department: optionalString(255),
  email: optionalEmail,
  phone: optionalString(50),
  mobile: optionalString(50),
})

/**
 * Supplier 入力スキーマ（共通: 新規・編集）
 */
export const supplierInputSchema = z
  .object({
    // 基本情報
    supplierCode: z
      .string()
      .min(1, "仕入先コードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(
        /^[A-Z0-9-_]+$/,
        "英大文字・数字・ハイフン・アンダースコアのみ使用可能"
      ),
    companyName: z
      .string()
      .min(1, "会社名は必須です")
      .max(255, "255文字以内で入力してください"),
    companyNameEn: optionalString(255),
    supplierType: z
      .array(z.nativeEnum(SupplierType))
      .min(1, "取扱品目は最低1つ選択してください"),

    // 連絡先
    country: z
      .string()
      .length(2, "国コードは2文字（ISO 3166-1）で入力してください")
      .default("JP"),
    postalCode: optionalString(20),
    prefecture: optionalString(50),
    city: optionalString(100),
    address: optionalString(500),
    addressLine2: optionalString(255),
    addressEn: optionalString(500),
    phone: optionalString(50),
    fax: optionalString(50),
    email: optionalEmail,
    website: optionalUrl,

    // 海外取引用
    chatTool: optionalString(50),
    chatToolId: optionalString(255),
    preferredLanguage: z.nativeEnum(Language).default("JA"),
    preferredCurrency: z.nativeEnum(Currency).default("JPY"),
    timezone: optionalString(50),

    // 取引条件
    taxId: z
      .string()
      .default("")
      .refine(
        (v) => v === "" || taxIdPattern.test(v),
        "適格請求書発行事業者番号は T で始まる13桁の数字で入力してください（例: T1234567890123）"
      ),
    isQualifiedInvoiceIssuer: z.boolean().default(true),
    paymentTermType: z.nativeEnum(PaymentTermType).default("MONTHLY_CLOSING"),
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

    // 担当者
    assignedToUserId: z.string().default(""),
    primaryContact: supplierPrimaryContactSchema,

    // ステータス
    status: z.nativeEnum(SupplierStatus).default("ACTIVE"),

    // メモ
    notes: optionalString(5000),
  })
  .superRefine((data, ctx) => {
    // taxId: 国内仕入先（country === "JP"）のみ必須
    if (data.country === "JP") {
      if (!data.taxId || data.taxId === "") {
        ctx.addIssue({
          code: "custom",
          path: ["taxId"],
          message: "国内仕入先は適格請求書発行事業者番号が必須です",
        })
      }
    }

    // 取引条件: MONTHLY_CLOSING の条件付き必須
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

    // 担当者: shunya 側担当 必須
    if (!data.assignedToUserId || data.assignedToUserId === "") {
      ctx.addIssue({
        code: "custom",
        path: ["assignedToUserId"],
        message: "shunya 側担当者は必須です",
      })
    }
  })

export type SupplierInput = z.infer<typeof supplierInputSchema>
