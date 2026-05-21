import { z } from "zod"
import {
  PaymentTermType,
  FactoryStatus,
  FactoryType,
  FactoryContractType,
  Language,
  Currency,
} from "@prisma/client"

/**
 * Phase 1A-5: 工場マスター バリデータ
 *
 * 設計方針:
 * - Supplier/Client/Brand と同じパターン（archive / restore / permanent delete 分離）
 * - taxId は国内工場（country === "JP"）のみ必須
 * - 取引条件は paymentMonthOffset + paymentDay（プリセット運用）
 * - FactoryType（縫製/ニット等）は複数選択可（最低1件必須）
 * - FactoryContractType（CMT/フルパッケージ等）は複数選択可（0件許容）
 * - 製造キャパシティ3項目（monthlyCapacity / minimumOrderQty / averageLeadTimeDays）は任意の正の整数
 * - 主担当（FactoryContact）は Supplier と同じ7フィールドのシンプル構成
 * - Phase 2 に回す項目: 銀行情報4列 / 評価4列 / standardLaborRates
 */

// ヘルパー: 任意文字列
const optionalString = (max: number) =>
  z.string().max(max, `${max}文字以内で入力してください`).default("")

// ヘルパー: 任意のメールアドレス
const optionalEmail = z
  .string()
  .default("")
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "正しいメールアドレスを入力してください",
  )

// ヘルパー: 任意の郵便番号
const optionalPostalCode = z
  .string()
  .max(20, "20文字以内で入力してください")
  .default("")
  .refine(
    (v) => v === "" || /^[A-Za-z0-9\- ]{3,20}$/.test(v),
    "郵便番号は3〜20文字の英数字・ハイフンで入力してください",
  )

// ヘルパー: 任意の正の整数
const optionalPositiveInt = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine(
    (v) => v === null || (Number.isInteger(v) && v >= 0),
    "0以上の整数で入力してください",
  )
  .nullable()

// 主担当（FactoryContact）スキーマ - Supplier と同じ7フィールド
const primaryContactSchema = z.object({
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

// 工場本体スキーマ
export const factoryInputSchema = z
  .object({
    // 基本情報
    factoryCode: z
      .string()
      .min(1, "工場コードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(/^[A-Za-z0-9_-]+$/, "英数字・ハイフン・アンダースコアのみ使用できます"),
    factoryName: z
      .string()
      .min(1, "工場名は必須です")
      .max(255, "255文字以内で入力してください"),
    factoryNameEn: optionalString(255),

    // 工場タイプ・契約形態
    factoryTypes: z
      .array(z.nativeEnum(FactoryType))
      .min(1, "工場タイプを1つ以上選択してください"),
    contractTypes: z.array(z.nativeEnum(FactoryContractType)).default([]),

    // 連絡先
    country: z.string().length(2, "国コードは2文字で入力してください").default("JP"),
    postalCode: optionalPostalCode,
    prefecture: optionalString(50),
    city: optionalString(100),
    address: optionalString(1000),
    addressLine2: optionalString(255),
    addressEn: optionalString(1000),
    phone: optionalString(50),
    fax: optionalString(50),
    email: optionalEmail,

    // 海外取引用
    chatTool: optionalString(50),
    chatToolId: optionalString(255),
    preferredLanguage: z.nativeEnum(Language).default(Language.JA),
    preferredCurrency: z.nativeEnum(Currency).default(Currency.JPY),
    timezone: optionalString(50),

    // 取引条件
    taxId: optionalString(50),
    isQualifiedInvoiceIssuer: z.boolean().default(true),
    paymentTermType: z.nativeEnum(PaymentTermType).default(PaymentTermType.MONTHLY_CLOSING),
    closingDay: optionalPositiveInt,
    paymentMonthOffset: optionalPositiveInt,
    paymentDay: optionalPositiveInt,

    // 製造キャパシティ
    monthlyCapacity: optionalPositiveInt,
    minimumOrderQty: optionalPositiveInt,
    averageLeadTimeDays: optionalPositiveInt,

    // 担当者・ステータス・メモ
    assignedToUserId: z.string().nullable().default(null),
    status: z.nativeEnum(FactoryStatus).default(FactoryStatus.ACTIVE),
    notes: optionalString(5000),

    // 主担当（同時作成）
    primaryContact: primaryContactSchema,
  })
  .superRefine((data, ctx) => {
    // country === "JP" のときの追加バリデーション
    if (data.country === "JP") {
      if (data.postalCode === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "郵便番号は必須です",
          path: ["postalCode"],
        })
      } else if (!/^\d{3}-?\d{4}$/.test(data.postalCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "郵便番号は7桁(例:150-0043)で入力してください",
          path: ["postalCode"],
        })
      }

      if (data.prefecture === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "都道府県は必須です",
          path: ["prefecture"],
        })
      }

      if (data.taxId === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "国内工場は適格請求書発行事業者番号が必須です",
          path: ["taxId"],
        })
      } else if (!/^T\d{13}$/.test(data.taxId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "T で始まる13桁の番号を入力してください(例:T1234567890123)",
          path: ["taxId"],
        })
      }
    }

    // 取引条件プリセットの整合性チェック
    if (data.paymentTermType === PaymentTermType.MONTHLY_CLOSING) {
      if (data.closingDay === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "締日を入力してください",
          path: ["closingDay"],
        })
      } else if (data.closingDay < 1 || data.closingDay > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "締日は1〜31の範囲で入力してください",
          path: ["closingDay"],
        })
      }

      if (data.paymentMonthOffset === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "支払月を選択してください",
          path: ["paymentMonthOffset"],
        })
      }

      if (data.paymentDay === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "支払日を入力してください",
          path: ["paymentDay"],
        })
      } else if (data.paymentDay < 1 || data.paymentDay > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "支払日は1〜31の範囲で入力してください",
          path: ["paymentDay"],
        })
      }
    }
  })

export type FactoryFormValues = z.input<typeof factoryInputSchema>
export type FactoryInput = z.infer<typeof factoryInputSchema>

// 検索パラメータ
export const factoryListParamsSchema = z.object({
  q: z.string().optional().default(""),
  status: z.nativeEnum(FactoryStatus).optional(),
  factoryType: z.nativeEnum(FactoryType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type FactoryListParams = z.infer<typeof factoryListParamsSchema>
