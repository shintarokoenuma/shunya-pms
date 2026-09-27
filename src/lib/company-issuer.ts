import { prisma } from "@/lib/prisma"
import type { CompanyBankAccount } from "@/lib/constants/company-profile"

/**
 * B-205 PR-1（spec v1.0 D-2〜D-4・D-15・D-23・P1-D1・P1-D5）: 帳票に載せる自社情報をテナントの Company から読む 1 か所。
 * - 帳票のデータを集める関数（*-data.ts）と請求書・納品書の作成からだけ呼ぶ。document（*-document.tsx）は DB を読まない
 * - Company は companyId 列を持たないので id で絞る（deletedAt: null）
 * - 空の項目は空欄で出す（D-3）。shunya の値を予備にしない
 * - 「〒」「TEL: 」「FAX: 」「MAIL: 」の頭の文字は帳票側で付ける（D-15）。値が既にそれで始まっていれば付けない（D-23）
 */
export type CompanyIssuer = {
  /** 帳票の社名: legalEntity（正式名称）、空なら companyName（D-4） */
  name: string
  companyName: string
  legalEntity: string | null
  postalCode: string | null
  address: string | null
  phone: string | null
  fax: string | null
  email: string | null
  website: string | null
  taxId: string | null
  /** bankAccount が 5 キーとも string のときだけ（P1-D2） */
  bank: CompanyBankAccount | null
}

/** Company が見つからないときの空の自社情報（帳票は空欄になる・D-3） */
export const EMPTY_COMPANY_ISSUER: CompanyIssuer = {
  name: "",
  companyName: "",
  legalEntity: null,
  postalCode: null,
  address: null,
  phone: null,
  fax: null,
  email: null,
  website: null,
  taxId: null,
  bank: null,
}

const BANK_KEYS = ["bankName", "branchName", "accountType", "accountNumber", "accountHolder"] as const

/** Json の値が振込先の 5 キーをすべて string で持つか（Invoice.bankInfo / Company.bankAccount に共通） */
export function isBankAccount(v: unknown): v is CompanyBankAccount {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false
  const o = v as Record<string, unknown>
  return BANK_KEYS.every((k) => typeof o[k] === "string")
}

function blankToNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t === "" ? null : t
}

/** テナントの Company を 1 行読んで自社情報にする。見つからなければ空（D-3） */
export async function getCompanyIssuer(companyId: string): Promise<CompanyIssuer> {
  const row = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: {
      companyName: true,
      legalEntity: true,
      postalCode: true,
      address: true,
      phone: true,
      fax: true,
      email: true,
      website: true,
      taxId: true,
      bankAccount: true,
    },
  })
  if (!row) return EMPTY_COMPANY_ISSUER
  const legalEntity = blankToNull(row.legalEntity)
  return {
    name: legalEntity ?? row.companyName,
    companyName: row.companyName,
    legalEntity,
    postalCode: blankToNull(row.postalCode),
    address: blankToNull(row.address),
    phone: blankToNull(row.phone),
    fax: blankToNull(row.fax),
    email: blankToNull(row.email),
    website: blankToNull(row.website),
    taxId: blankToNull(row.taxId),
    bank: isBankAccount(row.bankAccount) ? row.bankAccount : null,
  }
}

// =============================================================================
// 頭の文字（D-15・D-23・P1-D1）。値が空なら空文字。既に同じ頭で始まっていればそのまま
// =============================================================================
export function withLabel(label: string, value: string | null | undefined): string {
  const t = (value ?? "").trim()
  if (t === "") return ""
  const head = label.trimEnd()
  return t.startsWith(head) ? t : `${label}${t}`
}

export const labelPostal = (v: string | null | undefined): string => withLabel("〒", v)
export const labelTel = (v: string | null | undefined): string => withLabel("TEL: ", v)
export const labelFax = (v: string | null | undefined): string => withLabel("FAX: ", v)
export const labelMail = (v: string | null | undefined): string => withLabel("MAIL: ", v)

/** 空の部分を落として全角空白「　」でつなぐ（帳票の「TEL: …　FAX: …」の並び） */
export function joinFullWidth(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => (p ?? "").trim()).filter((p) => p !== "").join("　")
}

/** 住所の 1 行「〒{postalCode} {address}」。片方が空なら空の方を出さない */
export function issuerAddressLine(issuer: Pick<CompanyIssuer, "postalCode" | "address">): string {
  return [labelPostal(issuer.postalCode), (issuer.address ?? "").trim()].filter((p) => p !== "").join(" ")
}

/** 「TEL: …　FAX: …」の 1 行 */
export function issuerTelFaxLine(issuer: Pick<CompanyIssuer, "phone" | "fax">): string {
  return joinFullWidth(labelTel(issuer.phone), labelFax(issuer.fax))
}
