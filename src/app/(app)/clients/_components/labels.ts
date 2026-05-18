import {
  ClientBusinessType,
  ClientDisplayPattern,
  ClientSize,
  ClientStatus,
  LeadSource,
  PaymentTermType,
} from "@prisma/client"

export const BUSINESS_TYPE_LABEL: Record<ClientBusinessType, string> = {
  APPAREL_BRAND: "アパレルブランド",
  SELECT_SHOP: "セレクトショップ",
  TRADING_COMPANY: "商社",
  INDIVIDUAL: "個人",
  WHOLESALE: "卸",
  ONLINE_RETAILER: "EC専門",
  PRIVATE_BRAND: "PB",
  OTHER: "その他",
}

export const CLIENT_SIZE_LABEL: Record<ClientSize, string> = {
  INDIVIDUAL: "個人",
  SMALL: "小規模(~20名)",
  MEDIUM: "中堅(~100名)",
  LARGE: "大手(100名超)",
}

export const DISPLAY_PATTERN_LABEL: Record<ClientDisplayPattern, string> = {
  A: "A: 社内詳細10段階",
  B: "B: 簡略5段階",
  C: "C: 概要2段階",
  D: "D: 完全非開示",
}

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  REFERRAL: "紹介",
  WEB_SEARCH: "Web検索",
  EXHIBITION: "展示会",
  SOCIAL_MEDIA: "SNS",
  EMAIL: "メール",
  PHONE: "電話",
  EXISTING_CLIENT: "既存クライアント",
  OTHER: "その他",
}

export const STATUS_LABEL: Record<ClientStatus, string> = {
  ACTIVE: "稼働中",
  PROSPECT: "見込み客",
  PAUSED: "休止中",
  ARCHIVED: "アーカイブ",
  BLACKLIST: "ブラックリスト",
}

export const STATUS_BADGE_VARIANT: Record<ClientStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PROSPECT: "secondary",
  PAUSED: "outline",
  ARCHIVED: "secondary",
  BLACKLIST: "destructive",
}

export const PAYMENT_TERM_LABEL: Record<PaymentTermType, string> = {
  DEPOSIT_COD: "デポジット + COD(着金確認後出荷)",
  MONTHLY_CLOSING: "月末締め払い",
  ADVANCE_PAYMENT: "前払い",
  CASH_ON_DELIVERY: "代引き",
  LETTER_OF_CREDIT: "L/C",
  CUSTOM: "カスタム条件",
}

export const JP_PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
] as const
