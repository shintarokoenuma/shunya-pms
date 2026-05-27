import { ModelCodeStatus, OwnershipType } from "@prisma/client"

/**
 * Phase 1A-12: 型番マスター ラベル定義
 *
 * - shunya-master-patterns.md v1.2 §4 / §8 の命名規約に従う
 * - ModelCodeStatus は 4 値（ACTIVE / INACTIVE / DISCONTINUED / ARCHIVED）
 *   DISCONTINUED（廃番）は永続的に止まる業務状態のため destructive バッジで強調
 * - OwnershipType は本マスターで初めて UI 露出する
 */

// =============================================================================
// ステータス
// =============================================================================
export const MODEL_CODE_STATUS_LABELS: Record<ModelCodeStatus, string> = {
  ACTIVE: "稼働中",
  INACTIVE: "一時休止",
  DISCONTINUED: "廃番",
  ARCHIVED: "アーカイブ",
}

export const MODEL_CODE_STATUS_BADGE_VARIANT: Record<
  ModelCodeStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  INACTIVE: "outline",
  DISCONTINUED: "destructive",
  ARCHIVED: "secondary",
}

export const MODEL_CODE_STATUS_OPTIONS: {
  value: ModelCodeStatus
  label: string
}[] = [
  { value: "ACTIVE", label: "稼働中" },
  { value: "INACTIVE", label: "一時休止" },
  { value: "DISCONTINUED", label: "廃番" },
  { value: "ARCHIVED", label: "アーカイブ" },
]

// =============================================================================
// 所有権（OwnershipType）
// =============================================================================
export const OWNERSHIP_TYPE_LABELS: Record<OwnershipType, string> = {
  SHUNYA: "shunya 所有",
  CLIENT: "クライアント所有",
  SHARED: "共有",
  CONTRACT_BASED: "契約による",
}

export const OWNERSHIP_TYPE_OPTIONS: {
  value: OwnershipType
  label: string
}[] = [
  { value: "SHUNYA", label: "shunya 所有" },
  { value: "CLIENT", label: "クライアント所有" },
  { value: "SHARED", label: "共有" },
  { value: "CONTRACT_BASED", label: "契約による（個別案件で設定）" },
]
