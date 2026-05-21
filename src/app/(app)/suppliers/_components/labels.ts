import { SupplierStatus, SupplierType } from "@prisma/client"

/**
 * Phase 1A-4: 仕入先マスター UI ラベル定義
 *
 * Phase 1A-5 で共通モジュール化（Currency / Language / PaymentTerm / ChatTool / PaymentPreset）。
 * Factory・Contractor 等他のマスターと統一性を保つため、
 * 共通項目は src/lib/constants/ から re-export する。
 */

// =====================================================
// 共通モジュールから re-export
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
// SupplierType（9種類、Supplier 固有）
// =====================================================
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

// =====================================================
// SupplierStatus
// =====================================================
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
