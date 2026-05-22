import {
  ContractorStatus,
  ContractorSpecialty,
  ContractorContractType,
} from "@prisma/client"

// =====================================================
// 共通モジュールから re-export（Factory/Supplier と統一）
// =====================================================
export { COUNTRY_OPTIONS, type CountryOption } from "@/lib/constants/countries"
export { CHAT_TOOL_PRESETS } from "@/lib/constants/chat-tools"
export { CURRENCY_OPTIONS } from "@/lib/constants/currencies"
export { LANGUAGE_OPTIONS, LANGUAGE_LABELS } from "@/lib/constants/languages"
export {
  PAYMENT_TERM_TYPE_OPTIONS,
  PAYMENT_TERM_TYPE_LABELS,
} from "@/lib/constants/payment-term-types"
export { PAYMENT_PRESETS, type PaymentPreset } from "@/lib/constants/payment-presets"

// =====================================================
// ContractorSpecialty（専門分野、9種類、Contractor 固有）
// =====================================================
export const CONTRACTOR_SPECIALTY_OPTIONS: Array<{
  value: ContractorSpecialty
  label: string
}> = [
  { value: "PATTERN_MAKING", label: "パターン" },
  { value: "GRADING", label: "グレーディング" },
  { value: "CAD", label: "CAD作成" },
  { value: "DESIGN", label: "デザイン" },
  { value: "SAMPLE_MAKING", label: "サンプル製作" },
  { value: "TECHNICAL_DRAWING", label: "テクニカルドローイング" },
  { value: "CLO3D", label: "3Dシミュレーション" },
  { value: "ILLUSTRATION", label: "イラスト" },
  { value: "OTHER", label: "その他" },
]

export const CONTRACTOR_SPECIALTY_LABELS: Record<ContractorSpecialty, string> = {
  PATTERN_MAKING: "パターン",
  GRADING: "グレーディング",
  CAD: "CAD作成",
  DESIGN: "デザイン",
  SAMPLE_MAKING: "サンプル製作",
  TECHNICAL_DRAWING: "テクニカルドローイング",
  CLO3D: "3Dシミュレーション",
  ILLUSTRATION: "イラスト",
  OTHER: "その他",
}

// =====================================================
// ContractorContractType（契約形態、5種類、Contractor 固有）
// 注：契約形態は単数の必須 enum（Factory の contractTypes[] と異なる）
// =====================================================
export const CONTRACTOR_CONTRACT_TYPE_OPTIONS: Array<{
  value: ContractorContractType
  label: string
}> = [
  { value: "PACKAGE", label: "パッケージ型（基本料金+追加修正課金）" },
  { value: "HOURLY", label: "時給制" },
  { value: "PER_TASK", label: "都度（作業ごと）" },
  { value: "MONTHLY", label: "月額固定" },
  { value: "HYBRID", label: "ハイブリッド" },
]

export const CONTRACTOR_CONTRACT_TYPE_LABELS: Record<ContractorContractType, string> = {
  PACKAGE: "パッケージ型",
  HOURLY: "時給制",
  PER_TASK: "都度（作業ごと）",
  MONTHLY: "月額固定",
  HYBRID: "ハイブリッド",
}

// =====================================================
// 個人/法人区分（isIndividual ラジオ用、Contractor 固有）
// =====================================================
export const CONTRACTOR_INDIVIDUAL_OPTIONS: Array<{
  value: "true" | "false"
  label: string
}> = [
  { value: "true", label: "個人事業主" },
  { value: "false", label: "法人" },
]

// =====================================================
// ContractorStatus（Contractor 固有、Factory/Supplier と同パターン）
// =====================================================
export const CONTRACTOR_STATUS_OPTIONS: Array<{
  value: ContractorStatus
  label: string
}> = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "PAUSED", label: "休止中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]

export const CONTRACTOR_STATUS_LABELS: Record<ContractorStatus, string> = {
  ACTIVE: "稼働中",
  PAUSED: "休止中",
  ARCHIVED: "アーカイブ",
}

// ステータスバッジの色（Factory の FACTORY_STATUS_BADGE_VARIANT と同パターン）
export const CONTRACTOR_STATUS_BADGE_VARIANT: Record<
  ContractorStatus,
  "default" | "secondary" | "outline"
> = {
  ACTIVE: "default",
  PAUSED: "outline",
  ARCHIVED: "secondary",
}
