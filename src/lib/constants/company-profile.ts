/**
 * 発注元（自社）情報 — 発注書 PDF のヘッダ社判ブロック用（S-4c-2・H3）。
 *
 * Company テーブルには postalCode/address/phone/email 列は存在するが FAX 列が無く、
 * dev/本番の company レコードも未入力のため、当面は本定数を発注元情報の正とする。
 * 将来的な設定画面化（DB 化）は別タスク（B 起票）。
 */
export type CompanyProfile = {
  name: string
  postalCode: string
  address: string
  tel: string
  fax: string
  email: string
  website?: string
}

export const COMPANY_PROFILE: CompanyProfile = {
  name: "株式会社shunya",
  postalCode: "〒150-0043",
  address: "東京都渋谷区道玄坂1-22-10 見真ビル1F",
  tel: "TEL: 03-5459-1177",
  fax: "FAX: 03-5459-1181",
  email: "MAIL: info@shunya.cc",
}
