import {
  FactoryStatus,
  FactoryType,
  FactoryContractType,
} from "@prisma/client"

// =====================================================
// 共通モジュールから re-export（Supplier と統一）
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
// FactoryType（工場タイプ、12種類、Factory 固有）
// =====================================================
export const FACTORY_TYPE_OPTIONS: Array<{
  value: FactoryType
  label: string
}> = [
  { value: "SEWING", label: "縫製" },
  { value: "KNITTING", label: "ニット" },
  { value: "CUTTING", label: "裁断" },
  { value: "PRINTING", label: "プリント" },
  { value: "EMBROIDERY", label: "刺繍" },
  { value: "WASHING", label: "洗い加工" },
  { value: "DYEING", label: "染色" },
  { value: "FINISHING", label: "仕上げ" },
  { value: "PATTERN_MAKING", label: "パターンメイキング" },
  { value: "SAMPLE_MAKING", label: "サンプル製作" },
  { value: "ASSEMBLY", label: "組立" },
  { value: "OTHER", label: "その他" },
]

export const FACTORY_TYPE_LABELS: Record<FactoryType, string> = {
  SEWING: "縫製",
  KNITTING: "ニット",
  CUTTING: "裁断",
  PRINTING: "プリント",
  EMBROIDERY: "刺繍",
  WASHING: "洗い加工",
  DYEING: "染色",
  FINISHING: "仕上げ",
  PATTERN_MAKING: "パターンメイキング",
  SAMPLE_MAKING: "サンプル製作",
  ASSEMBLY: "組立",
  OTHER: "その他",
}

// =====================================================
// FactoryContractType（契約形態、6種類、Factory 固有）
// =====================================================
export const FACTORY_CONTRACT_TYPE_OPTIONS: Array<{
  value: FactoryContractType
  label: string
}> = [
  { value: "CMT", label: "CMT（材料支給）" },
  { value: "FULL_PACKAGE", label: "フルパッケージ" },
  { value: "CUT_ONLY", label: "裁断のみ" },
  { value: "ASSEMBLY_ONLY", label: "縫製のみ" },
  { value: "PROCESSING_ONLY", label: "加工のみ" },
  { value: "CUSTOM", label: "カスタム契約" },
]

export const FACTORY_CONTRACT_TYPE_LABELS: Record<FactoryContractType, string> = {
  CMT: "CMT（材料支給）",
  FULL_PACKAGE: "フルパッケージ",
  CUT_ONLY: "裁断のみ",
  ASSEMBLY_ONLY: "縫製のみ",
  PROCESSING_ONLY: "加工のみ",
  CUSTOM: "カスタム契約",
}

// =====================================================
// FactoryStatus（Factory 固有、Supplier と同パターン）
// =====================================================
export const FACTORY_STATUS_OPTIONS: Array<{
  value: FactoryStatus
  label: string
}> = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "PAUSED", label: "休止中" },
  { value: "ARCHIVED", label: "アーカイブ" },
]

export const FACTORY_STATUS_LABELS: Record<FactoryStatus, string> = {
  ACTIVE: "稼働中",
  PAUSED: "休止中",
  ARCHIVED: "アーカイブ",
}

// ステータスバッジの色（Supplier の SUPPLIER_STATUS_BADGE_VARIANT と同パターン）
export const FACTORY_STATUS_BADGE_VARIANT: Record<
  FactoryStatus,
  "default" | "secondary" | "outline"
> = {
  ACTIVE: "default",
  PAUSED: "outline",
  ARCHIVED: "secondary",
}
