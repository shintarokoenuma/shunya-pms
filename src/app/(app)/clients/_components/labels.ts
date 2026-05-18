import {
  ClientBusinessType,
  ClientDisplayPattern,
  ClientSize,
  ClientStatus,
  LeadSource,
} from "@prisma/client"

type BadgeVariant = "default" | "secondary" | "outline" | "destructive"

const BUSINESS_TYPE_LABEL_MAP: Record<ClientBusinessType, string> = {
  APPAREL_BRAND: "アパレルブランド",
  SELECT_SHOP: "セレクトショップ",
  TRADING_COMPANY: "商社",
  INDIVIDUAL: "個人",
  WHOLESALE: "卸",
  ONLINE_RETAILER: "EC専門",
  PRIVATE_BRAND: "PB",
  OTHER: "その他",
}

const CLIENT_SIZE_LABEL_MAP: Record<ClientSize, string> = {
  INDIVIDUAL: "個人",
  SMALL: "小規模(〜20名)",
  MEDIUM: "中堅(〜100名)",
  LARGE: "大手(100名超)",
}

const DISPLAY_PATTERN_LABEL_MAP: Record<ClientDisplayPattern, string> = {
  A: "A: 社内詳細10段階",
  B: "B: 簡略5段階",
  C: "C: 概要2段階",
  D: "D: 完全非開示",
}

const LEAD_SOURCE_LABEL_MAP: Record<LeadSource, string> = {
  REFERRAL: "紹介",
  WEB_SEARCH: "Web検索",
  EXHIBITION: "展示会",
  SOCIAL_MEDIA: "SNS",
  EMAIL: "メール",
  PHONE: "電話",
  EXISTING_CLIENT: "既存クライアント",
  OTHER: "その他",
}

const CLIENT_STATUS_LABEL_MAP: Record<ClientStatus, string> = {
  ACTIVE: "稼働中",
  PROSPECT: "見込み客",
  PAUSED: "休止中",
  ARCHIVED: "アーカイブ",
  BLACKLIST: "ブラックリスト",
}

const CLIENT_STATUS_VARIANT_MAP: Record<ClientStatus, BadgeVariant> = {
  ACTIVE: "default",
  PROSPECT: "secondary",
  PAUSED: "outline",
  ARCHIVED: "outline",
  BLACKLIST: "destructive",
}

export const BUSINESS_TYPE_LABEL = BUSINESS_TYPE_LABEL_MAP
export const CLIENT_SIZE_LABEL = CLIENT_SIZE_LABEL_MAP
export const DISPLAY_PATTERN_LABEL = DISPLAY_PATTERN_LABEL_MAP
export const LEAD_SOURCE_LABEL = LEAD_SOURCE_LABEL_MAP
export const CLIENT_STATUS_LABEL = CLIENT_STATUS_LABEL_MAP
export const CLIENT_STATUS_VARIANT = CLIENT_STATUS_VARIANT_MAP
