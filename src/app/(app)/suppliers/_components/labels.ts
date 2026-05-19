import {
  PaymentTermType,
  SupplierStatus,
  SupplierType,
  Language,
  Currency,
} from "@prisma/client"

/**
 * Phase 1A-4: 仕入先マスター UI ラベル定義
 */

// SupplierType: 9種類（表示順固定）
export const SUPPLIER_TYPE_OPTIONS: Array<{
  value: SupplierType
  label: string
}> = [
  { value: "FABRIC", label: "生地" },
  { value: "TRIM", label: "付属" },
  { value: "THREAD", label: "糸" },
  { value: "ACCESSORY", label: "副資材" },
  { value: "LABEL", label: "ネーム" },
  { value: "PATTERN", label: "パターン" },
  { value: "BODY", label: "ボディ" },
  { value: "USED_CLOTHING", label: "古着" },
  { value: "OTHER", label: "その他" },
]

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> =
  Object.fromEntries(
    SUPPLIER_TYPE_OPTIONS.map((o) => [o.value, o.label])
  ) as Record<SupplierType, string>

// SupplierStatus
export const SUPPLIER_STATUS_OPTIONS: Array<{
  value: SupplierStatus
  label: string
}> = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "PAUSED", label: "休止中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> =
  Object.fromEntries(
    SUPPLIER_STATUS_OPTIONS.map((o) => [o.value, o.label])
  ) as Record<SupplierStatus, string>

export const SUPPLIER_STATUS_BADGE_VARIANT: Record<
  SupplierStatus,
  "default" | "secondary" | "outline"
> = {
  ACTIVE: "default",
  PAUSED: "outline",
  ARCHIVED: "secondary",
}

// PaymentTermType（Client と同じ。再エクスポート）
export const PAYMENT_TERM_TYPE_OPTIONS: Array<{
  value: PaymentTermType
  label: string
}> = [
  { value: "DEPOSIT_COD", label: "デポジット + COD（推奨）" },
  { value: "MONTHLY_CLOSING", label: "月末締め払い" },
  { value: "ADVANCE_PAYMENT", label: "前払い" },
  { value: "CASH_ON_DELIVERY", label: "代引き" },
  { value: "LETTER_OF_CREDIT", label: "L/C（信用状）" },
  { value: "CUSTOM", label: "カスタム条件" },
]

export const PAYMENT_TERM_TYPE_LABELS: Record<PaymentTermType, string> =
  Object.fromEntries(
    PAYMENT_TERM_TYPE_OPTIONS.map((o) => [o.value, o.label])
  ) as Record<PaymentTermType, string>

// ChatTool: 自由入力だが、よく使うプリセットを定義
export const CHAT_TOOL_PRESETS = [
  "WeChat",
  "LINE",
  "Zalo",
  "WhatsApp",
  "KakaoTalk",
  "Telegram",
  "Signal",
  "Other",
] as const

// Currency
export const CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: "JPY", label: "JPY（日本円）" },
  { value: "USD", label: "USD（米ドル）" },
  { value: "CNY", label: "CNY（人民元）" },
  { value: "EUR", label: "EUR（ユーロ）" },
  { value: "VND", label: "VND（ベトナムドン）" },
]

// Language
export const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "JA", label: "日本語" },
  { value: "EN", label: "English" },
  { value: "ZH", label: "中文（简体）" },
  { value: "VI", label: "Tiếng Việt" },
]

// 取引条件プリセット（Client と同じ。共有可能）
export const PAYMENT_PRESETS: Array<{
  label: string
  closingDay: number
  paymentMonthOffset: number
  paymentDay: number
}> = [
  { label: "月末締翌月末払", closingDay: 31, paymentMonthOffset: 1, paymentDay: 31 },
  { label: "月末締翌々月末払", closingDay: 31, paymentMonthOffset: 2, paymentDay: 31 },
  { label: "20日締翌月末払", closingDay: 20, paymentMonthOffset: 1, paymentDay: 31 },
  { label: "20日締翌月10日払", closingDay: 20, paymentMonthOffset: 1, paymentDay: 10 },
]

// 国コード（ISO 3166-1 alpha-2）の主要なもの
export const COUNTRY_OPTIONS: Array<{ value: string; label: string }> = [
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
