import {
  RoughEstimateCategory,
  RoughEstimateItemSource,
  MarginRateSource,
} from "@prisma/client"

/**
 * QE-1R（概算量産見積）の enum ラベル共通モジュール。
 *
 * - work-order-types.ts / season-types.ts と同じ中立構成：enum は @prisma/client から import するが、
 *   このファイル自体は "use server" 非依存でクライアントから安全に import できる（index-browser 罠の回避）。
 * - Record は全値を網羅（漏れると型エラーでコンパイルが落ちる＝house rule）。
 * 仕様: docs/specs/quotation-rough-estimate-implementation-brief-2026-07-01.md §1-3
 */

export const ROUGH_ESTIMATE_CATEGORY_LABELS: Record<RoughEstimateCategory, string> = {
  MATERIAL: "材料費",
  LABOR: "工賃",
  INITIAL_COST: "初期費用（別枠）",
}

export const ROUGH_ESTIMATE_CATEGORY_OPTIONS: Array<{
  value: RoughEstimateCategory
  label: string
}> = (Object.keys(ROUGH_ESTIMATE_CATEGORY_LABELS) as RoughEstimateCategory[]).map(
  (value) => ({ value, label: ROUGH_ESTIMATE_CATEGORY_LABELS[value] }),
)

export const ROUGH_ESTIMATE_ITEM_SOURCE_LABELS: Record<RoughEstimateItemSource, string> = {
  MANUAL: "直接入力",
  PAST_PO: "過去発注から引き当て",
  PAST_WO: "過去作業発注から引き当て",
}

export const MARGIN_RATE_SOURCE_LABELS: Record<MarginRateSource, string> = {
  BRAND_DEFAULT: "ブランド既定",
  MANUAL_OVERRIDE: "手動上書き",
}
