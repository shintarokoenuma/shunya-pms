import { z } from "zod"

/**
 * B-211 PR-1（P1-D2）: 材料の「輸出用の規格」の型・zod・日本語ラベル
 * 仕様: docs/specs/b-211-pr1-implementation-brief-2026-10-10.md §3 P1-D2
 *
 * - 混率は Material.compositionData（Json）に [{ fiber, percent }] で持つ
 * - 規格（織物/編物・糸・組織・仕上げ・付属の素材と形）と判定の記録は Material.exportSpec（Json）
 * - 参考 URL は Material.referenceUrls（Json）に [{ label, url }]
 * - 目付・幅は既存の fabricWeight / fabricWidth を使う（ここに重複して持たない）
 * - 既存の composition（文字）はそのまま残す。ここから文字を作って上書きしない
 */

// =============================================================================
// 混率（Material.compositionData）
// =============================================================================
export const FIBERS = [
  "COTTON",
  "LINEN",
  "RAMIE",
  "WOOL",
  "SILK",
  "POLYESTER",
  "NYLON",
  "ACRYLIC",
  "POLYURETHANE",
  "RAYON",
  "CUPRO",
  "ACETATE",
  "OTHER",
] as const
export type Fiber = (typeof FIBERS)[number]

export const FIBER_LABELS: Record<Fiber, string> = {
  COTTON: "綿",
  LINEN: "麻（亜麻）",
  RAMIE: "ラミー（苧麻）",
  WOOL: "毛",
  SILK: "絹",
  POLYESTER: "ポリエステル",
  NYLON: "ナイロン",
  ACRYLIC: "アクリル",
  POLYURETHANE: "ポリウレタン",
  RAYON: "レーヨン",
  CUPRO: "キュプラ",
  ACETATE: "アセテート",
  OTHER: "その他",
}

/** 繊維の大きな区分（HS の類を分けるのに使う） */
export type FiberGroup = "COTTON" | "FLAX" | "WOOL" | "SILK" | "SYNTHETIC" | "ARTIFICIAL" | "OTHER"
export const FIBER_GROUP: Record<Fiber, FiberGroup> = {
  COTTON: "COTTON",
  LINEN: "FLAX",
  RAMIE: "OTHER",
  WOOL: "WOOL",
  SILK: "SILK",
  POLYESTER: "SYNTHETIC",
  NYLON: "SYNTHETIC",
  ACRYLIC: "SYNTHETIC",
  POLYURETHANE: "SYNTHETIC",
  RAYON: "ARTIFICIAL",
  CUPRO: "ARTIFICIAL",
  ACETATE: "ARTIFICIAL",
  OTHER: "OTHER",
}

export const compositionRowSchema = z.object({
  fiber: z.enum(FIBERS, { message: "繊維を選択してください" }),
  percent: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? NaN : Number(v)))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 100, "混率は 0〜100 の数値で入力してください（空の行は消してください）"),
})
/** 合計が 100 でなくても保存は止めない（画面で黄色の注意を出す） */
export const compositionDataSchema = z.array(compositionRowSchema)
export type CompositionRow = z.output<typeof compositionRowSchema>
export type CompositionData = CompositionRow[]
export type CompositionDataInput = z.input<typeof compositionDataSchema>

// =============================================================================
// 規格（Material.exportSpec）
// =============================================================================
export const FABRIC_FORMS = ["WOVEN", "KNIT", "NONWOVEN"] as const
export const YARN_TYPES = ["STAPLE", "FILAMENT"] as const
export const WEAVES = ["PLAIN", "TWILL_3_4", "SATIN", "OTHER"] as const
export const FINISHES = ["UNBLEACHED", "BLEACHED", "DYED", "YARN_DYED", "PRINTED"] as const
export const TRIM_MATERIALS = ["METAL", "PLASTIC", "SHELL", "WOOD", "COVERED", "PAPER", "TEXTILE", "OTHER"] as const
export const TRIM_FORMS = [
  "SLIDE_FASTENER",
  "PRESS_FASTENER",
  "BUTTON",
  "WOVEN",
  "PRINTED",
  "ELASTIC",
  "NARROW_WOVEN",
  "OTHER",
] as const
export const HS_SOURCES = ["CANDIDATE", "COPIED", "MANUAL"] as const

export type FabricForm = (typeof FABRIC_FORMS)[number]
export type YarnType = (typeof YARN_TYPES)[number]
export type Weave = (typeof WEAVES)[number]
export type Finish = (typeof FINISHES)[number]
export type TrimMaterial = (typeof TRIM_MATERIALS)[number]
export type TrimForm = (typeof TRIM_FORMS)[number]
export type HsSource = (typeof HS_SOURCES)[number]

export const FABRIC_FORM_LABELS: Record<FabricForm, string> = {
  WOVEN: "織物",
  KNIT: "編物",
  NONWOVEN: "不織布",
}
export const YARN_TYPE_LABELS: Record<YarnType, string> = {
  STAPLE: "短繊維（紡績糸）",
  FILAMENT: "長繊維",
}
export const WEAVE_LABELS: Record<Weave, string> = {
  PLAIN: "平織",
  TWILL_3_4: "綾織（3枚・4枚）",
  SATIN: "朱子織",
  OTHER: "その他の組織",
}
export const FINISH_LABELS: Record<Finish, string> = {
  UNBLEACHED: "未晒",
  BLEACHED: "漂白",
  DYED: "浸染（後染め）",
  YARN_DYED: "先染め",
  PRINTED: "なせん",
}
export const TRIM_MATERIAL_LABELS: Record<TrimMaterial, string> = {
  METAL: "金属",
  PLASTIC: "樹脂（プラスチック）",
  SHELL: "貝",
  WOOD: "木",
  COVERED: "くるみ（布・革で覆ったもの）",
  PAPER: "紙",
  TEXTILE: "繊維",
  OTHER: "その他",
}
export const TRIM_FORM_LABELS: Record<TrimForm, string> = {
  SLIDE_FASTENER: "スライドファスナー",
  PRESS_FASTENER: "スナップ（プレスファスナー）",
  BUTTON: "ボタン",
  WOVEN: "織ったもの",
  PRINTED: "印刷したもの",
  ELASTIC: "ゴム（弾性）",
  NARROW_WOVEN: "細幅織物（テープ）",
  OTHER: "その他",
}
export const HS_SOURCE_LABELS: Record<HsSource, string> = {
  CANDIDATE: "候補から",
  COPIED: "似た材料から写した",
  MANUAL: "手入力",
}

export const exportSpecSchema = z.object({
  version: z.literal(1).default(1),
  // 生地（FABRIC / LINING / INTERLINING）
  fabricForm: z.enum(FABRIC_FORMS).optional(),
  yarnType: z.enum(YARN_TYPES).optional(),
  weave: z.enum(WEAVES).optional(),
  isDenim: z.boolean().optional(),
  isPile: z.boolean().optional(),
  finish: z.enum(FINISHES).optional(),
  // 付属
  trimMaterial: z.enum(TRIM_MATERIALS).optional(),
  trimForm: z.enum(TRIM_FORMS).optional(),
  // 判定の記録
  hsSource: z.enum(HS_SOURCES).optional(),
  copiedFromMaterialId: z.string().max(100).optional(),
  decidedAt: z.string().max(40).optional(),
  decidedByUserId: z.string().max(100).optional(),
})
export type ExportSpec = z.output<typeof exportSpecSchema>
export type ExportSpecInput = z.input<typeof exportSpecSchema>

/** 規格そのものの欄（判定の記録を除く）。1 つでも入っていれば「規格あり」 */
export const EXPORT_SPEC_FIELDS = [
  "fabricForm",
  "yarnType",
  "weave",
  "isDenim",
  "isPile",
  "finish",
  "trimMaterial",
  "trimForm",
] as const satisfies readonly (keyof ExportSpec)[]

// =============================================================================
// 参考 URL（Material.referenceUrls）
// =============================================================================
export const referenceUrlSchema = z.object({
  label: z.string().trim().max(100, "100文字以内で入力してください").default(""),
  url: z
    .string()
    .trim()
    .min(1, "URL は必須です")
    .max(500, "500文字以内で入力してください")
    .refine((v) => /^https?:\/\/.+/.test(v), "http:// または https:// で始まる URL を入力してください"),
})
export const referenceUrlsSchema = z.array(referenceUrlSchema).max(20, "URL は 20 件までです")
export type ReferenceUrl = z.output<typeof referenceUrlSchema>
export type ReferenceUrls = ReferenceUrl[]
export type ReferenceUrlsInput = z.input<typeof referenceUrlsSchema>

// =============================================================================
// Json 列を安全に読む（DB の値 → 型。壊れていれば null / []）
// =============================================================================
export function parseCompositionData(raw: unknown): CompositionData {
  const r = compositionDataSchema.safeParse(raw)
  return r.success ? r.data : []
}

export function parseExportSpec(raw: unknown): ExportSpec | null {
  if (raw === null || raw === undefined) return null
  const r = exportSpecSchema.safeParse(raw)
  return r.success ? r.data : null
}

export function parseReferenceUrls(raw: unknown): ReferenceUrls {
  const r = referenceUrlsSchema.safeParse(raw)
  return r.success ? r.data : []
}

// =============================================================================
// 保存前の正規化（空なら null にして DB に NULL を入れる）
// =============================================================================
export function normalizeCompositionData(rows: CompositionData | null | undefined): CompositionData | null {
  if (!rows) return null
  const kept = rows.filter((r) => Number.isFinite(r.percent))
  return kept.length === 0 ? null : kept
}

export function normalizeReferenceUrls(rows: ReferenceUrls | null | undefined): ReferenceUrls | null {
  if (!rows) return null
  const kept = rows.filter((r) => r.url.trim() !== "")
  return kept.length === 0 ? null : kept
}

/** 規格の欄も判定の記録も何も無ければ null。undefined の欄は落とす（Json に undefined を入れない） */
export function normalizeExportSpec(spec: ExportSpec | null | undefined): ExportSpec | null {
  if (!spec) return null
  const out: ExportSpec = { version: 1 }
  let hasAny = false
  for (const key of Object.keys(spec) as (keyof ExportSpec)[]) {
    if (key === "version") continue
    const v = spec[key]
    if (v === undefined || v === null || v === "") continue
    ;(out as Record<string, unknown>)[key] = v
    hasAny = true
  }
  return hasAny ? out : null
}

// =============================================================================
// 表示用の補助
// =============================================================================
export function compositionTotal(rows: CompositionData): number {
  return rows.reduce((s, r) => s + (Number.isFinite(r.percent) ? r.percent : 0), 0)
}

/** 「綿 100%」「綿 60% / ポリエステル 40%」 */
export function formatComposition(rows: CompositionData): string {
  if (rows.length === 0) return ""
  return rows.map((r) => `${FIBER_LABELS[r.fiber]} ${formatPercent(r.percent)}%`).join(" / ")
}

function formatPercent(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10)
}

/** 主素材（percent が最大の繊維）。同率の最大が複数なら tie=true */
export function primaryFiber(rows: CompositionData): { fiber: Fiber; percent: number; tie: boolean } | null {
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((r) => r.percent))
  const tops = rows.filter((r) => r.percent === max)
  return { fiber: tops[0].fiber, percent: max, tie: tops.length > 1 }
}

/** 繊維ごとの合計 %（同じ繊維が複数行あっても足す） */
export function percentOf(rows: CompositionData, fiber: Fiber): number {
  return rows.filter((r) => r.fiber === fiber).reduce((s, r) => s + r.percent, 0)
}

/** 規格の日本語の要約（「織物 / 短繊維 / 綾織 / 浸染 / デニム」）。判定の記録は含めない */
export function summarizeExportSpec(spec: ExportSpec | null): string[] {
  if (!spec) return []
  const parts: string[] = []
  if (spec.fabricForm) parts.push(FABRIC_FORM_LABELS[spec.fabricForm])
  if (spec.yarnType) parts.push(YARN_TYPE_LABELS[spec.yarnType])
  if (spec.weave) parts.push(WEAVE_LABELS[spec.weave])
  if (spec.finish) parts.push(FINISH_LABELS[spec.finish])
  if (spec.isDenim) parts.push("デニム")
  if (spec.isPile) parts.push("パイル")
  if (spec.trimMaterial) parts.push(`素材: ${TRIM_MATERIAL_LABELS[spec.trimMaterial]}`)
  if (spec.trimForm) parts.push(`形: ${TRIM_FORM_LABELS[spec.trimForm]}`)
  return parts
}

/** 規格の欄（判定の記録を除く）が 1 つでも入っているか */
export function hasSpecFields(spec: ExportSpec | null): boolean {
  if (!spec) return false
  return EXPORT_SPEC_FIELDS.some((k) => spec[k] !== undefined && spec[k] !== null)
}
