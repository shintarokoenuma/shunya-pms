import { z } from "zod"

/**
 * B-205 PR-1（spec v1.0 D-2・D-15・P1-D1〜P1-D3）: 設定ページ「自社情報」「振込先」の入力の検証。
 * - 長さは Company の列に合わせる（companyName 255・legalEntity 255・taxId 50・postalCode 20・phone 50・fax 50・email 255・website 255）
 * - 前後の空白は trim、空文字は null（D-3: 空は空欄で出す）
 * - 電話・FAX・メール・郵便番号は番号・アドレスだけを持つ（「TEL:」「〒」は帳票側で付ける・D-15・P1-D1）
 * - 登録番号は空か「T＋13桁」（P1-D3）。振込先は 5 項目を全部入れるか全部空か（P1-D2）
 */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label}は${max}文字以内で入力してください`)
    .nullable()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim()
      return t === "" ? null : t
    })

export const companyProfileSchema = z.object({
  companyName: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length >= 1, "表示名を入力してください")
    .refine((v) => v.length <= 255, "表示名は255文字以内で入力してください"),
  legalEntity: optionalText(255, "正式名称"),
  postalCode: optionalText(20, "郵便番号"),
  address: optionalText(1000, "住所"),
  phone: optionalText(50, "電話"),
  fax: optionalText(50, "FAX"),
  email: optionalText(255, "メール").refine(
    (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "メールアドレスの形式で入力してください",
  ),
  website: optionalText(255, "Webサイト"),
  taxId: optionalText(50, "登録番号").refine(
    (v) => v === null || /^T\d{13}$/.test(v),
    "登録番号は T と 13 桁の数字で入力してください（例: T1234567890123）",
  ),
})

export type CompanyProfileInput = z.input<typeof companyProfileSchema>
export type CompanyProfileValues = z.output<typeof companyProfileSchema>

const bankText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label}は${max}文字以内で入力してください`)
    .nullable()
    .optional()
    .transform((v) => (v ?? "").trim())

/** 5 項目すべて入っていれば振込先、すべて空なら null、一部だけは弾く（P1-D2） */
export const companyBankAccountSchema = z
  .object({
    bankName: bankText(100, "銀行名"),
    branchName: bankText(100, "支店名"),
    accountType: bankText(20, "口座種別"),
    accountNumber: bankText(30, "口座番号"),
    accountHolder: bankText(100, "口座名義"),
  })
  .superRefine((v, ctx) => {
    const values = Object.values(v)
    const filled = values.filter((s) => s !== "").length
    if (filled !== 0 && filled !== values.length) {
      ctx.addIssue({
        code: "custom",
        message: "振込先は 5 項目をすべて入力するか、すべて空にしてください",
      })
    }
  })
  .transform((v) => {
    const filled = Object.values(v).every((s) => s !== "")
    return filled ? v : null
  })

export type CompanyBankAccountInput = z.input<typeof companyBankAccountSchema>
export type CompanyBankAccountValues = z.output<typeof companyBankAccountSchema>

/** 画面に渡す自社情報（読み取り用・空は null） */
export type CompanyProfileView = {
  companyName: string
  legalEntity: string | null
  postalCode: string | null
  address: string | null
  phone: string | null
  fax: string | null
  email: string | null
  website: string | null
  taxId: string | null
}

export type CompanyBankAccountView = {
  bankName: string
  branchName: string
  accountType: string
  accountNumber: string
  accountHolder: string
}
