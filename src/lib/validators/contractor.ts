import { z } from "zod"
import {
  PaymentTermType,
  ContractorStatus,
  ContractorSpecialty,
  ContractorContractType,
  Language,
  Currency,
} from "@prisma/client"

/**
 * Phase 1A-6: 外注先マスター バリデータ
 *
 * 設計方針:
 * - Factory/Supplier と同じパターン（archive / restore / permanent delete 分離）
 * - 個人事業主 / 法人の区分（isIndividual）あり
 *   - true: 主担当者は本人=個人なので任意
 *   - false: 主担当者を持てる（B-252 で姓名の必須は外した）
 * - 専門分野（ContractorSpecialty）は複数選択可（最低1件必須）
 * - 契約形態（ContractorContractType）は単数の必須 enum
 * - 料金体系: packageFee / hourlyRate / monthlyFee はフォーム受け取り
 *   - unitFees (JSON) は DB 列のみ、Phase 2 で UI 化
 * - taxId は「国内 (JP) かつ 適格請求書発行事業者」のとき入力したら形式を見る（B-252 で必須は外した・個人事業主免税対応）
 * - 取引条件は paymentMonthOffset + paymentDay（プリセット運用）
 *
 * 仕様確定:
 * - Q1=B: isQualifiedInvoiceIssuer デフォルト true
 * - Q2=B: ロイヤリティ 5項目 は DB 列のみ、フォーム非表示（Phase 2）
 * - Q3=B: 著作権・所有権 2項目 は DB 列のみ、フォーム非表示（Phase 2）
 * - Q4=A: invitedUserId は DB 列のみ、フォーム非表示（Phase 2）
 * - primaryContact=A: isIndividual=false の時のみ主担当を持つ（B-252 で姓名の必須は外した。姓か名があれば行を作る）
 * - Q5=B: taxId の形式チェックは country=JP かつ isQualifiedInvoiceIssuer=true のとき
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

// ヘルパー: 任意の正の Decimal（料金体系用、小数点 2 位まで許容）
const optionalPositiveDecimal = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine(
    (v) => v === null || (typeof v === "number" && !Number.isNaN(v) && v >= 0),
    "0以上の数値で入力してください",
  )
  .nullable()

// 主担当（ContractorContact）スキーマ
// 全フィールド optional。法人のとき、姓も名も空なのに他の項目があれば superRefine で弾く（B-252 D-4）
const primaryContactSchema = z.object({
  firstName: optionalString(100),
  lastName: optionalString(100),
  jobTitle: optionalString(255),
  department: optionalString(255),
  email: optionalEmail,
  phone: optionalString(50),
  mobile: optionalString(50),
})

// 外注先本体スキーマ
export const contractorInputSchema = z
  .object({
    // 基本情報
    contractorCode: z
      .string()
      .min(1, "外注先コードは必須です")
      .max(50, "50文字以内で入力してください")
      .regex(/^[A-Za-z0-9_-]+$/, "英数字・ハイフン・アンダースコアのみ使用できます"),
    contractorName: z
      .string()
      .min(1, "外注先名は必須です")
      .max(255, "255文字以内で入力してください"),
    contractorNameEn: optionalString(255),

    // 個人/法人区分
    isIndividual: z.boolean().default(true),

    // 専門分野・契約形態
    specialties: z
      .array(z.nativeEnum(ContractorSpecialty))
      .min(1, "専門分野を1つ以上選択してください"),
    contractType: z.nativeEnum(ContractorContractType, {
      message: "契約形態を選択してください",
    }),

    // 料金体系（contractType に応じてフォーム側で表示制御）
    packageFee: optionalPositiveDecimal,
    hourlyRate: optionalPositiveDecimal,
    monthlyFee: optionalPositiveDecimal,

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

    // 担当者・ステータス・メモ
    assignedToUserId: z.string().nullable().default(null),
    status: z.nativeEnum(ContractorStatus).default(ContractorStatus.ACTIVE),
    notes: optionalString(5000),

    // 主担当（isIndividual=false のときだけ行を持つ・姓名は任意）
    primaryContact: primaryContactSchema,
  })
  .superRefine((data, ctx) => {
    // country === "JP" のときの形式チェック（B-252 D-2・D-3: 郵便番号・都道府県・登録番号は必須にせず、入力したときだけ形式を見る）
    if (data.country === "JP") {
      if (data.postalCode !== "" && !/^\d{3}-?\d{4}$/.test(data.postalCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "郵便番号は7桁(例:150-0043)で入力してください",
          path: ["postalCode"],
        })
      }

      // Q5=B の形式チェックだけ残す（国内かつ適格のときの「必須」は B-252 で外した。未入力は一覧・詳細に出す）
      if (data.isQualifiedInvoiceIssuer === true && data.taxId !== "" && !/^T\d{13}$/.test(data.taxId)) {
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

    // B-252（D-2・D-4）: 法人でも姓・名は必須にしない。姓も名も空なのに他の項目があるときだけ弾く（法人のとき）
    if (data.isIndividual === false) {
      const pc = data.primaryContact
      if (
        pc.firstName.trim() === "" &&
        pc.lastName.trim() === "" &&
        [pc.email, pc.phone, pc.mobile, pc.jobTitle, pc.department].some((v) => (v ?? "").trim() !== "")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "担当者の姓か名を入れてください",
          path: ["primaryContact", "lastName"],
        })
      }
    }
  })

export type ContractorFormValues = z.input<typeof contractorInputSchema>
export type ContractorInput = z.infer<typeof contractorInputSchema>

// 検索パラメータ
export const contractorListParamsSchema = z.object({
  q: z.string().optional().default(""),
  status: z.nativeEnum(ContractorStatus).optional(),
  specialty: z.nativeEnum(ContractorSpecialty).optional(),
  contractType: z.nativeEnum(ContractorContractType).optional(),
  isIndividual: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type ContractorListParams = z.infer<typeof contractorListParamsSchema>
