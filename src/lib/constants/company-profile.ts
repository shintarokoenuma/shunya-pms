/**
 * 発注元（自社）情報 — 発注書 PDF のヘッダ社判ブロック用（S-4c-2・H3）。
 *
 * ★プレースホルダ。慎太郎さんが実値に差し替えること。
 *   Company テーブルには postalCode/address/phone/email 列は存在するが、
 *   FAX 列が無く、dev/本番の company レコードも未入力のため、当面は本定数を正とする。
 *   将来的な設定画面化（DB 化）は別タスク（B 起票）。
 *
 * 差し替え対象: name / postalCode / address / tel / fax / email（website は任意）。
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
  name: "shunya合同会社",
  postalCode: "〒XXX-XXXX（要設定）",
  address: "東京都〇〇区〇〇 0-0-0（要設定）",
  tel: "TEL: 00-0000-0000（要設定）",
  fax: "FAX: 00-0000-0000（要設定）",
  email: "MAIL: order@example.com（要設定）",
}
