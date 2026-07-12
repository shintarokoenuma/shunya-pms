/**
 * QE-1: 量産原価ビューの集計（純TS・中立モジュール）。
 *
 * - "use client"/"use server" を付けない純関数。@prisma/client 非依存（SkuRow 中立型のみ import）。
 * - 材料費（BomItem 起点・ROLL 取り切り / METER ＋カット代）＋ 工賃（PRODUCTION WoItem 起点）を
 *   混在通貨（JPY/USD のみ・手入力レート換算）で集計し、1枚原価まで出す。書き込みなし。
 * - 設計ソース:
 *   docs/specs/qe-1-spec-confirmation-v1_0-2026-06-30.md（§3 2源集計・§4 取り切り・§5 通貨・§6 費目写像）
 *   docs/specs/qe-1-spec-addendum-v0_1-2026-07-12.md（§2 カット代・§3 INDIVIDUAL_BILLING 除外）
 *   docs/specs/qe-1-implementation-brief-2026-07-12.md（§2 計算規則）
 *
 * 絶対防衛線（addendum §3）: billingClassification = INDIVIDUAL_BILLING の工賃は
 * 1枚原価の分子（工賃Σ）に入れない。別枠「別途請求項目（1枚原価外）」へ参考表示する。
 *
 * 表示器は QE-1 専用の薄い描画（production-cost-section.tsx）。sample 軸の CostBreakdown 型/描画は共有しない
 * （材料費行は PO/WO 伝票を持たず、混在通貨表示も要るため。2026-07-12 チャットで確定）。
 */

import type { SkuRow } from "@/lib/types/sku"

/** QE-1 集計で扱う通貨（Currency enum の文字列と同値。JPY/USD のみ集計対象・他は除外）。 */
export type ProductionCostCurrency = "JPY" | "USD" | "CNY" | "VND" | "EUR"

/** 生地の販売モード（BomItem.procurementMode。生地以外の行は null）。 */
export type ProductionCostProcurementMode = "ROLL" | "METER" | null

/** 工賃行の売り立て区分（WoItem.billingClassification）。 */
export type ProductionBillingClassification =
  | "INDIVIDUAL_BILLING"
  | "UNIT_PRICE_INCLUDED"
  | null

/** 費目大分類（CostCategory.externalCategory）。工賃のセクション分けに使う。 */
export type ProductionExternalCategory =
  | "MATERIAL"
  | "SEWING"
  | "PROCESSING"
  | "OVERHEAD"
  | null

/** 材料費 1 行の入力（BomItem ＋ ROLL 時の Material 反情報）。Decimal は number 正規化済みで受ける。 */
export type MaterialCostInput = {
  bomItemId: string
  itemLabel: string
  itemCategory: string
  usagePerUnit: number | null
  lossRate: number
  unit: string
  procurementMode: ProductionCostProcurementMode
  /** METER / 生地以外: BomItem 側の単価・通貨。 */
  unitPrice: number | null
  currency: ProductionCostCurrency
  /** ROLL: Material 側の反情報（rollCurrency = Material.currency）。 */
  rollLength: number | null
  rollPrice: number | null
  rollCurrency: ProductionCostCurrency | null
  /** METER のカット代（行通貨・UI 手入力・未入力は 0 / addendum §2）。 */
  cutFee: number | null
}

/** 工賃 1 行の入力（PRODUCTION WorkOrder の WoItem）。 */
export type LaborCostInput = {
  woItemId: string
  woId: string
  woNumber: string
  workDescription: string
  quantity: number
  unitPrice: number | null
  currency: ProductionCostCurrency
  externalCategory: ProductionExternalCategory
  billingClassification: ProductionBillingClassification
}

/** 除外理由（QE-1 専用・sample 軸の CostBreakdownExcludeReason とは別）。 */
export type ProductionCostExcludeReason =
  | "AMOUNT_UNDECIDED" // 単価/用尺/レート 未定
  | "NON_TARGET_CURRENCY" // CNY/VND/EUR（対象外通貨）
  | "INDIVIDUAL_BILLING" // 別途請求（1枚原価外）

export type ProductionCostRow = {
  key: string
  label: string
  /** 反数「(3反)」やカット代注記など従属情報。 */
  note: string | null
  /** 工賃行は WO へのリンク元。材料費行は null。 */
  docType: "WO" | null
  docId: string | null
  docNumber: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  currency: ProductionCostCurrency
  /** 原通貨での金額。 */
  amountOriginal: number | null
  /** JPY 換算額（除外行は参考値・集計には入れない場合あり）。 */
  amountJpy: number | null
  excluded: boolean
  excludeReason: ProductionCostExcludeReason | null
}

export type ProductionCostSection = {
  key: string
  group: "material" | "labor" | "separate"
  label: string
  labelEn: string
  rows: ProductionCostRow[]
  /** 集計対象（material/labor は excluded=false の Σ / separate は参考の Σ）。 */
  subtotalJpy: number
}

export type ProductionCostResult = {
  sections: ProductionCostSection[]
  totalQuantity: number
  materialTotalJpy: number
  laborTotalJpy: number
  /** 別枠（1枚原価に含めない・参考）。 */
  separateTotalJpy: number
  /** 1枚原価 = (材料費Σ + 工賃Σ) ÷ Σ(productionQuantity)。Σqty=0 のとき null。 */
  unitCostJpy: number | null
}

/** 費目大分類 → 日英ラベル（§7 静的辞書・永続化なし）。 */
const CATEGORY_LABELS: Record<
  "MATERIAL" | "SEWING" | "PROCESSING" | "OVERHEAD" | "OTHER",
  { ja: string; en: string }
> = {
  MATERIAL: { ja: "材料費", en: "Materials" },
  SEWING: { ja: "縫製費", en: "Sewing" },
  PROCESSING: { ja: "加工費", en: "Processing" },
  OVERHEAD: { ja: "諸経費", en: "Overhead" },
  OTHER: { ja: "未分類", en: "Uncategorized" },
}

/** 工賃セクションの並び順（§6 費目写像・null → OTHER は末尾寄り）。 */
const LABOR_CATEGORY_ORDER: Array<
  "SEWING" | "PROCESSING" | "OVERHEAD" | "MATERIAL" | "OTHER"
> = ["SEWING", "PROCESSING", "OVERHEAD", "MATERIAL", "OTHER"]

/** Σ(productionQuantity)。#93 computeMaterialRequirements と同一分母（Q-a）。 */
export function sumProductionQuantity(skus: SkuRow[]): number {
  return skus.reduce((sum, s) => sum + s.productionQuantity, 0)
}

/** 原通貨額 → JPY。JPY はそのまま / USD は手入力レート / CNY・VND・EUR は対象外。 */
function convertToJpy(
  amount: number | null,
  currency: ProductionCostCurrency,
  usdJpyRate: number | null,
): { jpy: number | null; reason: ProductionCostExcludeReason | null } {
  if (amount === null) return { jpy: null, reason: "AMOUNT_UNDECIDED" }
  if (currency === "JPY") return { jpy: amount, reason: null }
  if (currency === "USD") {
    if (usdJpyRate === null || usdJpyRate <= 0) {
      return { jpy: null, reason: "AMOUNT_UNDECIDED" }
    }
    return { jpy: amount * usdJpyRate, reason: null }
  }
  // CNY / VND / EUR は §5 で集計対象外。
  return { jpy: null, reason: "NON_TARGET_CURRENCY" }
}

/** ロス込み必要量 = Σqty × usagePerUnit × (1 + lossRate/100)。usagePerUnit=null は null。 */
function computeRequirement(
  totalQuantity: number,
  usagePerUnit: number | null,
  lossRate: number,
): number | null {
  if (usagePerUnit === null) return null
  return totalQuantity * usagePerUnit * (1 + lossRate / 100)
}

/** 材料費 1 行を集計行へ。ROLL は取り切り（反数 ceil）、METER/生地以外は 必要量×単価＋カット代。 */
function buildMaterialRow(
  m: MaterialCostInput,
  totalQuantity: number,
  usdJpyRate: number,
): ProductionCostRow {
  const requirement = computeRequirement(
    totalQuantity,
    m.usagePerUnit,
    m.lossRate,
  )

  let amountOriginal: number | null = null
  let note: string | null = null
  let currency: ProductionCostCurrency = m.currency

  if (m.procurementMode === "ROLL") {
    // ROLL: 反数 = ceil(必要量 ÷ 原反長)、生地コスト = 反数 × 反単価（Material 通貨）。
    currency = m.rollCurrency ?? "JPY"
    if (
      requirement !== null &&
      m.rollLength !== null &&
      m.rollLength > 0 &&
      m.rollPrice !== null
    ) {
      const rolls = Math.ceil(requirement / m.rollLength)
      amountOriginal = rolls * m.rollPrice
      note = `${rolls.toLocaleString("ja-JP")}反`
    }
  } else {
    // METER / 生地以外: 生地コスト = 必要量 × 単価 ＋ カット代（METER のみ・行通貨）。
    if (requirement !== null && m.unitPrice !== null) {
      const cut = m.procurementMode === "METER" ? m.cutFee ?? 0 : 0
      amountOriginal = requirement * m.unitPrice + cut
      if (cut > 0) note = "カット代含む"
    }
  }

  const conv = convertToJpy(amountOriginal, currency, usdJpyRate)
  const excluded = conv.reason !== null
  return {
    key: m.bomItemId,
    label: m.itemLabel,
    note,
    docType: null,
    docId: null,
    docNumber: null,
    quantity: requirement,
    unit: m.unit,
    unitPrice:
      m.procurementMode === "ROLL" ? m.rollPrice : m.unitPrice,
    currency,
    amountOriginal,
    amountJpy: conv.jpy,
    excluded,
    excludeReason: conv.reason,
  }
}

/** 工賃 1 行を集計行へ。INDIVIDUAL_BILLING は別枠（分子除外）。 */
function buildLaborRow(
  l: LaborCostInput,
  usdJpyRate: number,
): { row: ProductionCostRow; isSeparate: boolean } {
  const amountOriginal =
    l.unitPrice === null ? null : l.unitPrice * l.quantity
  const conv = convertToJpy(amountOriginal, l.currency, usdJpyRate)
  const isSeparate = l.billingClassification === "INDIVIDUAL_BILLING"

  // 除外理由の優先: 金額未定 > 対象外通貨 > 別途請求。
  let excludeReason: ProductionCostExcludeReason | null = null
  if (conv.reason !== null) {
    excludeReason = conv.reason
  } else if (isSeparate) {
    excludeReason = "INDIVIDUAL_BILLING"
  }

  return {
    row: {
      key: l.woItemId,
      label: l.workDescription,
      note: null,
      docType: "WO",
      docId: l.woId,
      docNumber: l.woNumber,
      quantity: l.quantity,
      unit: null,
      unitPrice: l.unitPrice,
      currency: l.currency,
      amountOriginal,
      amountJpy: conv.jpy,
      excluded: excludeReason !== null,
      excludeReason,
    },
    isSeparate,
  }
}

/**
 * 量産原価を集計する。
 * - 分母 totalQuantity = Σ(productionQuantity)（#93 と一致・Q-a）。
 * - 材料費Σ・工賃Σは JPY 換算後の excluded=false 行のみ。
 * - INDIVIDUAL_BILLING 工賃は工賃Σから除外し別枠へ（addendum §3）。
 * - 1枚原価 = (材料費Σ + 工賃Σ) ÷ totalQuantity（Σqty=0 は null）。
 */
export function computeProductionCost(
  skus: SkuRow[],
  materials: MaterialCostInput[],
  labor: LaborCostInput[],
  usdJpyRate: number | null,
): ProductionCostResult {
  const totalQuantity = sumProductionQuantity(skus)
  const rate = usdJpyRate ?? 0

  // ---- 材料費 ----
  const materialRows = materials.map((m) =>
    buildMaterialRow(m, totalQuantity, rate),
  )
  const materialTotalJpy = materialRows
    .filter((r) => !r.excluded && r.amountJpy !== null)
    .reduce((sum, r) => sum + (r.amountJpy ?? 0), 0)

  // ---- 工賃（費目大分類ごと）＋ 別枠 ----
  const laborByCategory = new Map<string, ProductionCostRow[]>()
  const separateRows: ProductionCostRow[] = []
  for (const l of labor) {
    const { row, isSeparate } = buildLaborRow(l, rate)
    if (isSeparate) {
      separateRows.push(row)
      continue
    }
    const catKey = l.externalCategory ?? "OTHER"
    const list = laborByCategory.get(catKey) ?? []
    list.push(row)
    laborByCategory.set(catKey, list)
  }

  const laborSections: ProductionCostSection[] = []
  for (const cat of LABOR_CATEGORY_ORDER) {
    const rows = laborByCategory.get(cat)
    if (!rows || rows.length === 0) continue
    const subtotalJpy = rows
      .filter((r) => !r.excluded && r.amountJpy !== null)
      .reduce((sum, r) => sum + (r.amountJpy ?? 0), 0)
    const labels = CATEGORY_LABELS[cat]
    laborSections.push({
      key: `labor:${cat}`,
      group: "labor",
      label: labels.ja,
      labelEn: labels.en,
      rows,
      subtotalJpy,
    })
  }
  const laborTotalJpy = laborSections.reduce(
    (sum, s) => sum + s.subtotalJpy,
    0,
  )

  // ---- 別枠（1枚原価に入れない・参考 Σ）----
  const separateTotalJpy = separateRows
    .filter((r) => r.amountJpy !== null)
    .reduce((sum, r) => sum + (r.amountJpy ?? 0), 0)

  // ---- セクション組み立て（材料 → 工賃各費目 → 別枠）----
  const sections: ProductionCostSection[] = []
  sections.push({
    key: "material",
    group: "material",
    label: CATEGORY_LABELS.MATERIAL.ja,
    labelEn: CATEGORY_LABELS.MATERIAL.en,
    rows: materialRows,
    subtotalJpy: materialTotalJpy,
  })
  sections.push(...laborSections)
  if (separateRows.length > 0) {
    sections.push({
      key: "separate",
      group: "separate",
      label: "別途請求項目（1枚原価外）",
      labelEn: "Separately billed (excl. unit cost)",
      rows: separateRows,
      subtotalJpy: separateTotalJpy,
    })
  }

  const unitCostJpy =
    totalQuantity > 0
      ? (materialTotalJpy + laborTotalJpy) / totalQuantity
      : null

  return {
    sections,
    totalQuantity,
    materialTotalJpy,
    laborTotalJpy,
    separateTotalJpy,
    unitCostJpy,
  }
}
