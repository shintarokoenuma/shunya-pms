/**
 * B-252（D-6）: 取引先マスターの「未入力」の判定（prisma 非依存の純関数）。
 * 画面の必須を DB の必須（コード・名前・種別）まで緩めたぶん、空の項目を一覧・詳細で見せるための判定を1か所に置く。
 * 返り値は未入力の項目名（日本語）の配列。0 件なら空配列。
 *
 * 対象（ブリーフ §2 D-6）:
 * - 電話・メール: Client のみ
 * - 住所: 市区町村か住所1のどちらかが空
 * - 郵便番号・都道府県: country が JP のとき
 * - 登録番号: Supplier / Factory / Contractor で、JP かつ isQualifiedInvoiceIssuer のとき
 * - 先方担当者: 主担当の行が無いとき（Contractor は法人のときだけ）
 * - 自社担当者: Client のみ
 */

export const MISSING_LABELS = {
  phone: "電話",
  email: "メール",
  address: "住所",
  postalCode: "郵便番号",
  prefecture: "都道府県",
  taxId: "登録番号",
  primaryContact: "先方担当者",
  assignedUser: "自社担当者",
} as const

type Str = string | null | undefined

const blank = (v: Str): boolean => (v ?? "").trim() === ""

type AddressFields = {
  country: Str
  postalCode: Str
  prefecture: Str
  city: Str
  address: Str
}

function addressMissing(a: AddressFields): string[] {
  const out: string[] = []
  if (blank(a.city) || blank(a.address)) out.push(MISSING_LABELS.address)
  if ((a.country ?? "JP") === "JP") {
    if (blank(a.postalCode)) out.push(MISSING_LABELS.postalCode)
    if (blank(a.prefecture)) out.push(MISSING_LABELS.prefecture)
  }
  return out
}

type TaxFields = {
  country: Str
  taxId: Str
  isQualifiedInvoiceIssuer: boolean
}

function taxIdMissing(t: TaxFields): string[] {
  return (t.country ?? "JP") === "JP" && t.isQualifiedInvoiceIssuer && blank(t.taxId)
    ? [MISSING_LABELS.taxId]
    : []
}

export type ClientCompletenessInput = AddressFields & {
  phone: Str
  email: Str
  assignedToUserId: Str
  hasPrimaryContact: boolean
}

export function clientMissingFields(c: ClientCompletenessInput): string[] {
  const out: string[] = []
  if (blank(c.phone)) out.push(MISSING_LABELS.phone)
  if (blank(c.email)) out.push(MISSING_LABELS.email)
  out.push(...addressMissing(c))
  if (!c.hasPrimaryContact) out.push(MISSING_LABELS.primaryContact)
  if (blank(c.assignedToUserId)) out.push(MISSING_LABELS.assignedUser)
  return out
}

export type SupplierCompletenessInput = AddressFields &
  TaxFields & {
    hasPrimaryContact: boolean
  }

export function supplierMissingFields(s: SupplierCompletenessInput): string[] {
  const out: string[] = []
  out.push(...addressMissing(s))
  out.push(...taxIdMissing(s))
  if (!s.hasPrimaryContact) out.push(MISSING_LABELS.primaryContact)
  return out
}

export type FactoryCompletenessInput = SupplierCompletenessInput

export function factoryMissingFields(f: FactoryCompletenessInput): string[] {
  return supplierMissingFields(f)
}

export type ContractorCompletenessInput = SupplierCompletenessInput & {
  isIndividual: boolean
}

export function contractorMissingFields(c: ContractorCompletenessInput): string[] {
  const out: string[] = []
  out.push(...addressMissing(c))
  out.push(...taxIdMissing(c))
  if (!c.isIndividual && !c.hasPrimaryContact) out.push(MISSING_LABELS.primaryContact)
  return out
}
