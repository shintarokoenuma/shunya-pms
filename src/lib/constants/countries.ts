/**
 * 国コード定数（ISO 3166-1 alpha-2）
 * Supplier・Client・Factory・Contractor の住所で共通利用
 */

export type CountryOption = {
  value: string
  label: string
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { value: "JP", label: "日本" },
  { value: "CN", label: "中国" },
  { value: "VN", label: "ベトナム" },
  { value: "KR", label: "韓国" },
  { value: "TH", label: "タイ" },
  { value: "TW", label: "台湾" },
  { value: "HK", label: "香港" },
  { value: "ID", label: "インドネシア" },
  { value: "IN", label: "インド" },
  { value: "MY", label: "マレーシア" },
  { value: "MM", label: "ミャンマー" },
  { value: "BD", label: "バングラデシュ" },
  { value: "KH", label: "カンボジア" },
  { value: "LK", label: "スリランカ" },
  { value: "PH", label: "フィリピン" },
  { value: "PK", label: "パキスタン" },
  { value: "TR", label: "トルコ" },
  { value: "IT", label: "イタリア" },
  { value: "US", label: "アメリカ" },
  { value: "OTHER", label: "その他" },
]

export const COUNTRY_VALUES = new Set(COUNTRY_OPTIONS.map((c) => c.value))

export function isValidCountry(value: string | null | undefined): boolean {
  if (!value) return false
  return COUNTRY_VALUES.has(value)
}
