/**
 * タイムゾーン定数
 * 仕入先・工場マスターで使用
 * UTC オフセット昇順、shunya の取引先が多い東アジア中心
 */

export type TimezoneOption = {
  value: string
  label: string
  country: string
  utcOffset: string
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: "Europe/Rome",        label: "Europe/Rome (UTC+1) イタリア",          country: "イタリア",       utcOffset: "+01:00" },
  { value: "Europe/Istanbul",    label: "Europe/Istanbul (UTC+3) トルコ",        country: "トルコ",         utcOffset: "+03:00" },
  { value: "Asia/Kolkata",       label: "Asia/Kolkata (UTC+5:30) インド",        country: "インド",         utcOffset: "+05:30" },
  { value: "Asia/Dhaka",         label: "Asia/Dhaka (UTC+6) バングラデシュ",     country: "バングラデシュ", utcOffset: "+06:00" },
  { value: "Asia/Yangon",        label: "Asia/Yangon (UTC+6:30) ミャンマー",     country: "ミャンマー",     utcOffset: "+06:30" },
  { value: "Asia/Bangkok",       label: "Asia/Bangkok (UTC+7) タイ",             country: "タイ",           utcOffset: "+07:00" },
  { value: "Asia/Ho_Chi_Minh",   label: "Asia/Ho_Chi_Minh (UTC+7) ベトナム",     country: "ベトナム",       utcOffset: "+07:00" },
  { value: "Asia/Shanghai",      label: "Asia/Shanghai (UTC+8) 中国",            country: "中国",           utcOffset: "+08:00" },
  { value: "Asia/Hong_Kong",     label: "Asia/Hong_Kong (UTC+8) 香港",           country: "香港",           utcOffset: "+08:00" },
  { value: "Asia/Taipei",        label: "Asia/Taipei (UTC+8) 台湾",              country: "台湾",           utcOffset: "+08:00" },
  { value: "Asia/Singapore",     label: "Asia/Singapore (UTC+8) シンガポール",   country: "シンガポール",   utcOffset: "+08:00" },
  { value: "Asia/Manila",        label: "Asia/Manila (UTC+8) フィリピン",        country: "フィリピン",     utcOffset: "+08:00" },
  { value: "Asia/Tokyo",         label: "Asia/Tokyo (UTC+9) 日本",               country: "日本",           utcOffset: "+09:00" },
  { value: "Asia/Seoul",         label: "Asia/Seoul (UTC+9) 韓国",               country: "韓国",           utcOffset: "+09:00" },
  { value: "America/New_York",   label: "America/New_York (UTC-5) アメリカ東部", country: "アメリカ",       utcOffset: "-05:00" },
]

/** Other 用の特殊値（Select 内部で使用、DB には保存しない） */
export const TIMEZONE_OTHER_VALUE = "__OTHER__"

/** 既知のタイムゾーン値の Set（バリデーションや判定で使用） */
export const KNOWN_TIMEZONE_VALUES = new Set(
  TIMEZONE_OPTIONS.map((tz) => tz.value)
)

/**
 * 任意の文字列が既知タイムゾーンかを判定
 * 既知でなければ「Other」扱い
 */
export function isKnownTimezone(value: string | null | undefined): boolean {
  if (!value) return false
  return KNOWN_TIMEZONE_VALUES.has(value)
}
