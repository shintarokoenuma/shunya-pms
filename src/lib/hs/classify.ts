import type { MaterialType } from "@prisma/client"
import {
  FIBER_GROUP,
  FIBER_LABELS,
  FINISH_LABELS,
  TRIM_FORM_LABELS,
  TRIM_MATERIAL_LABELS,
  WEAVE_LABELS,
  formatComposition,
  percentOf,
  primaryFiber,
  type CompositionData,
  type ExportSpec,
  type Finish,
  type Weave,
} from "./export-spec"

/**
 * B-211 PR-1（P1-D3）: HS の判定の純関数
 * 仕様: docs/specs/b-211-pr1-implementation-brief-2026-10-10.md §3 P1-D3（v1 の木・HS 2022 の号の並び）
 *
 * - DB に触らない。入力（素材タイプ・混率・規格・目付・幅）から候補・根拠・足りない答えを返す
 * - 号まで決めきれない所は heading だけ返し code は null（人が手入力）
 * - ★木は澁澤WT と照合前。照合が済むまで verified は常に false → 画面に「要確認」
 * - 参考画面の試作は 5208 のなせん綾織を .53 にしていたが正しくは .59（.53 は無い）
 */

export type HsMissing = keyof ExportSpec | "composition" | "fabricWeight" | "fabricWidth"

export type HsResult = {
  /** 確定まで行けた番号（例 "5208.33"）。号まで行けなければ null */
  code: string | null
  /** 項（4 桁・例 "5208"）。分かった所まで。複数に跨る時は "5210〜5212" のような案内 */
  heading: string | null
  /** 日本語の説明 */
  label: string
  /** 根拠の文（画面に並べる） */
  reasons: string[]
  /** 足りない答え（PR-2 の質問に使う） */
  missing: HsMissing[]
  /** ★澁澤WT と照合前。照合が済むまで常に false */
  verified: false
}

export type ClassifyInput = {
  materialType: MaterialType
  compositionData: CompositionData | null | undefined
  exportSpec: ExportSpec | null | undefined
  fabricWeight: number | null | undefined
  fabricWidth: number | null | undefined
}

const FABRIC_TYPES: readonly MaterialType[] = ["FABRIC", "LINING", "INTERLINING"]
const MANUAL_TYPES: readonly MaterialType[] = ["PACKAGING_BAG", "POLYBAG", "BOX", "OTHER"]

/** 結果を組み立てる小さな器 */
class Builder {
  reasons: string[] = []
  missing: HsMissing[] = []
  need(key: HsMissing): void {
    if (!this.missing.includes(key)) this.missing.push(key)
  }
  done(code: string | null, heading: string | null, label: string): HsResult {
    return { code, heading, label, reasons: this.reasons, missing: this.missing, verified: false }
  }
}

function toNumber(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function fmtWeight(w: number): string {
  return `${Number.isInteger(w) ? w : Math.round(w * 10) / 10}g/㎡`
}

// =============================================================================
// 入口
// =============================================================================
export function classifyHs(input: ClassifyInput): HsResult {
  const spec = input.exportSpec ?? null
  const rows = input.compositionData ?? []
  const weight = toNumber(input.fabricWeight)
  const width = toNumber(input.fabricWidth)
  const t = input.materialType

  if (FABRIC_TYPES.includes(t)) return classifyFabric(rows, spec, weight, width)
  switch (t) {
    case "ZIPPER":
      return classifyZipper(spec)
    case "BUTTON":
      return classifyButton(spec)
    case "TAPE":
    case "ELASTIC":
      return classifyNarrow(rows, spec)
    case "LABEL":
    case "CARE_LABEL":
      return classifyLabel(spec)
    case "HANG_TAG":
      return classifyHangTag(spec)
    case "THREAD":
      return classifyThread(rows, spec)
    default:
      break
  }
  const b = new Builder()
  if (MANUAL_TYPES.includes(t)) {
    b.reasons.push("袋・ポリ袋・箱・その他は v1 の木に無い → 手入力")
  } else {
    b.reasons.push(`素材タイプ ${t} は v1 の木に無い → 手入力`)
  }
  return b.done(null, null, "手入力（判定の木に無い素材タイプ）")
}

// =============================================================================
// 生地（FABRIC / LINING / INTERLINING）
// =============================================================================
function classifyFabric(
  rows: CompositionData,
  spec: ExportSpec | null,
  weight: number | null,
  width: number | null,
): HsResult {
  const b = new Builder()
  const primary = primaryFiber(rows)
  if (!primary) {
    b.need("composition")
    b.reasons.push("混率が未入力 → 主素材が決まらない")
    return b.done(null, null, "混率を入れてください")
  }
  if (primary.tie) {
    b.need("composition")
    b.reasons.push(`${formatComposition(rows)} → 主素材が同率 → HS の注の規定で決まる（v1 は要確認）`)
    return b.done(null, null, "主素材が同率（要確認・手入力）")
  }
  const form = spec?.fabricForm
  if (!form) {
    b.need("fabricForm")
    b.reasons.push("織物／編物／不織布が未選択 → 類が決まらない")
    return b.done(null, null, "織物・編物・不織布を選んでください")
  }
  if (form === "NONWOVEN") {
    b.reasons.push("不織布 → 5603")
    if (weight === null) b.need("fabricWeight")
    if (!spec?.yarnType) b.need("yarnType")
    b.reasons.push("号は長繊維か・重量区分で分かれる → 手入力")
    return b.done(null, "5603", "不織布（5603）")
  }
  if (form === "KNIT") return classifyKnit(rows, spec, weight, width, b)
  return classifyWoven(rows, spec, weight, b, primary)
}

// --- 織物 ---------------------------------------------------------------------
function classifyWoven(
  rows: CompositionData,
  spec: ExportSpec | null,
  weight: number | null,
  b: Builder,
  primary: NonNullable<ReturnType<typeof primaryFiber>>,
): HsResult {
  const fiber = primary.fiber
  const pct = percentOf(rows, fiber)
  const group = FIBER_GROUP[fiber]
  const comp = formatComposition(rows)
  const fiberLabel = FIBER_LABELS[fiber]

  if (group === "COTTON") {
    if (pct < 85) {
      b.need("composition")
      if (weight === null) b.need("fabricWeight")
      b.reasons.push(`${comp} → 綿85%未満 → 5210〜5212（混ぜた繊維と目付で分かれる）`)
      return b.done(null, "5210〜5212", "綿織物（綿85%未満）— 混ぜた繊維と目付で 5210〜5212 に分かれる（手入力）")
    }
    b.reasons.push(`${comp} → 綿85%以上 → 52類`)
    if (weight === null) {
      b.need("fabricWeight")
      b.reasons.push("目付が未入力 → 5208（200g/㎡以下）か 5209（200g/㎡超）か決まらない")
      return b.done(null, "5208／5209", "綿織物（綿85%以上）— 目付で 5208／5209 に分かれる")
    }
    return weight <= 200 ? classifyCotton5208(spec, weight, b) : classifyCotton5209(spec, weight, b)
  }

  if (fiber === "LINEN") {
    const over = pct >= 85
    b.reasons.push(`${comp} → 亜麻 → 5309（亜麻織物）`)
    const sub = over ? "1" : "2"
    b.reasons.push(over ? `亜麻 ${pct}% → 85%以上 → 5309.${sub}x` : `亜麻 ${pct}% → 85%未満 → 5309.${sub}x`)
    const finish = spec?.finish
    if (!finish) {
      b.need("finish")
      b.reasons.push("仕上げが未選択 → 未晒・漂白（x1）かその他（x9）か決まらない")
      return b.done(null, "5309", `亜麻織物（亜麻${over ? "85%以上" : "85%未満"}）`)
    }
    const last = finish === "UNBLEACHED" || finish === "BLEACHED" ? "1" : "9"
    b.reasons.push(`${FINISH_LABELS[finish]} → ${last === "1" ? "未晒・漂白" : "その他"} → 5309.${sub}${last}`)
    return b.done(`5309.${sub}${last}`, "5309", `亜麻織物（亜麻${over ? "85%以上" : "85%未満"}）／${FINISH_LABELS[finish]}`)
  }

  if (group === "WOOL") {
    b.reasons.push(`${comp} → 毛 → 5111（紡毛）／5112（梳毛）`)
    b.reasons.push("紡毛か梳毛かは v1 の規格に欄が無い → 手入力")
    return b.done(null, "5111／5112", "毛織物 — 紡毛（5111）か梳毛（5112）か（手入力）")
  }

  if (group === "SYNTHETIC" || group === "ARTIFICIAL") {
    const isSyn = group === "SYNTHETIC"
    b.reasons.push(`${comp} → ${isSyn ? "合成繊維" : "再生・半合成繊維"}（${fiberLabel}）`)
    const yarn = spec?.yarnType
    if (!yarn) {
      b.need("yarnType")
      b.reasons.push("長繊維か短繊維か未選択 → 項が決まらない")
      return b.done(null, null, `${isSyn ? "合成" : "再生"}繊維の織物 — 長繊維／短繊維を選んでください`)
    }
    if (yarn === "FILAMENT") {
      const h = isSyn ? "5407" : "5408"
      b.reasons.push(`長繊維 → ${h}`)
      b.need("finish")
      b.reasons.push("号は加工糸か・仕上げで分かれる → 手入力")
      return b.done(null, h, `${isSyn ? "合成" : "再生"}繊維の長繊維の織物（${h}）`)
    }
    // 短繊維
    if (!isSyn) {
      b.reasons.push("短繊維 → 5516")
      b.need("finish")
      b.reasons.push("号は混ぜた繊維・仕上げで分かれる → 手入力")
      return b.done(null, "5516", "再生繊維の短繊維の織物（5516）")
    }
    if (pct < 85) {
      if (weight === null) b.need("fabricWeight")
      b.reasons.push(`短繊維・${fiberLabel} ${pct}% → 85%未満 → 5513／5514／5515（綿と混ぜたか・170g/㎡以下か）`)
      return b.done(null, "5513／5514／5515", "合成繊維の短繊維の織物（85%未満）— 混ぜた繊維と目付で分かれる（手入力）")
    }
    b.reasons.push(`短繊維・${fiberLabel} ${pct}% → 85%以上 → 5512`)
    const sub = fiber === "POLYESTER" ? "1" : fiber === "ACRYLIC" ? "2" : "9"
    b.reasons.push(`${fiberLabel} → 5512.${sub}x`)
    const finish = spec?.finish
    if (!finish) {
      b.need("finish")
      b.reasons.push("仕上げが未選択 → 未晒・漂白（x1）かその他（x9）か決まらない")
      return b.done(null, "5512", `合成繊維の短繊維の織物（${fiberLabel}85%以上）`)
    }
    const last = finish === "UNBLEACHED" || finish === "BLEACHED" ? "1" : "9"
    b.reasons.push(`${FINISH_LABELS[finish]} → ${last === "1" ? "未晒・漂白" : "その他"} → 5512.${sub}${last}`)
    return b.done(`5512.${sub}${last}`, "5512", `合成繊維の短繊維の織物（${fiberLabel}85%以上）／${FINISH_LABELS[finish]}`)
  }

  b.reasons.push(`${comp} → 主素材 ${fiberLabel} は v1 の木に無い → 手入力`)
  return b.done(null, null, `手入力（${fiberLabel}の織物は v1 の木に無い）`)
}

const FINISH_DIGIT: Record<Finish, string> = {
  UNBLEACHED: "1",
  BLEACHED: "2",
  DYED: "3",
  YARN_DYED: "4",
  PRINTED: "5",
}

/** 5208（綿85%以上・200g/㎡以下） */
function classifyCotton5208(spec: ExportSpec | null, weight: number, b: Builder): HsResult {
  b.reasons.push(`${fmtWeight(weight)} → 200g/㎡以下 → 5208`)
  const base = "綿織物（綿85%以上・200g/㎡以下）"
  const finish = spec?.finish
  if (!finish) {
    b.need("finish")
    b.reasons.push("仕上げが未選択 → 号の十の位が決まらない")
    return b.done(null, "5208", base)
  }
  const d1 = FINISH_DIGIT[finish]
  b.reasons.push(`${FINISH_LABELS[finish]} → 5208.${d1}x`)
  const weave = spec?.weave
  if (!weave) {
    b.need("weave")
    b.reasons.push("組織が未選択 → 号の一の位が決まらない")
    return b.done(null, "5208", `${base}／${FINISH_LABELS[finish]}`)
  }
  let d2: string
  if (weave === "PLAIN") {
    d2 = weight <= 100 ? "1" : "2"
    b.reasons.push(`平織・${fmtWeight(weight)} → ${weight <= 100 ? "100g/㎡以下" : "100g/㎡超"} → 5208.${d1}${d2}`)
  } else if (weave === "TWILL_3_4" && finish !== "PRINTED") {
    d2 = "3"
    b.reasons.push(`${WEAVE_LABELS[weave]} → 5208.${d1}${d2}`)
  } else {
    // 朱子・その他。なせんは綾織も .59（.53 は無い）
    d2 = "9"
    b.reasons.push(
      finish === "PRINTED" && weave === "TWILL_3_4"
        ? `なせんの綾織 → 5208.53 は無い → 5208.59`
        : `${WEAVE_LABELS[weave]} → 5208.${d1}${d2}`,
    )
  }
  return b.done(`5208.${d1}${d2}`, "5208", `${base}／${FINISH_LABELS[finish]}／${WEAVE_LABELS[weave]}`)
}

/** 5209（綿85%以上・200g/㎡超） */
function classifyCotton5209(spec: ExportSpec | null, weight: number, b: Builder): HsResult {
  b.reasons.push(`${fmtWeight(weight)} → 200g/㎡超 → 5209`)
  const base = "綿織物（綿85%以上・200g/㎡超）"
  const finish = spec?.finish
  if (!finish) {
    b.need("finish")
    b.reasons.push("仕上げが未選択 → 号の十の位が決まらない")
    return b.done(null, "5209", base)
  }
  const d1 = FINISH_DIGIT[finish]
  b.reasons.push(`${FINISH_LABELS[finish]} → 5209.${d1}x`)
  const weave = spec?.weave
  if (!weave) {
    b.need("weave")
    b.reasons.push("組織が未選択 → 号の一の位が決まらない")
    return b.done(null, "5209", `${base}／${FINISH_LABELS[finish]}`)
  }
  const label = `${base}／${FINISH_LABELS[finish]}／${WEAVE_LABELS[weave]}`
  if (finish === "YARN_DYED") {
    if (weave === "PLAIN") {
      b.reasons.push("平織 → 5209.41")
      return b.done("5209.41", "5209", label)
    }
    if (weave === "TWILL_3_4") {
      if (spec?.isDenim === undefined) {
        b.need("isDenim")
        b.reasons.push("先染めの綾織 → デニム（.42）かその他の綾織（.43）か未回答")
        return b.done(null, "5209", label)
      }
      if (spec.isDenim) {
        b.reasons.push("先染めの綾織・デニム → 5209.42")
        return b.done("5209.42", "5209", `${label}／デニム`)
      }
      b.reasons.push("先染めの綾織・デニムでない → 5209.43")
      return b.done("5209.43", "5209", label)
    }
    b.reasons.push(`${WEAVE_LABELS[weave]} → 5209.49`)
    return b.done("5209.49", "5209", label)
  }
  const d2 = weave === "PLAIN" ? "1" : weave === "TWILL_3_4" ? "2" : "9"
  b.reasons.push(`${WEAVE_LABELS[weave]} → 5209.${d1}${d2}`)
  return b.done(`5209.${d1}${d2}`, "5209", label)
}

// --- 編物 ---------------------------------------------------------------------
function classifyKnit(
  rows: CompositionData,
  spec: ExportSpec | null,
  weight: number | null,
  width: number | null,
  b: Builder,
): HsResult {
  void weight
  const comp = formatComposition(rows)
  const pu = percentOf(rows, "POLYURETHANE")
  if (spec?.isPile) {
    b.reasons.push("編物・パイル → 6001")
    b.reasons.push("号は長パイルか・ループパイルか・繊維で分かれる（v1 の規格に欄が無い） → 手入力")
    return b.done(null, "6001", "パイル編物（6001）")
  }
  if (width === null) {
    b.need("fabricWidth")
    b.reasons.push("幅が未入力 → 30cm 超とみなす（30cm 以下なら 6002／6003）")
  } else if (width <= 30) {
    const h = pu >= 5 ? "6002" : "6003"
    b.reasons.push(`幅 ${width}cm → 30cm 以下 → ${h}（${pu >= 5 ? "弾性糸5%以上" : "弾性糸5%未満"}）`)
    b.reasons.push("号は繊維で分かれる → 手入力")
    return b.done(null, h, `幅30cm以下の編物（${h}）`)
  }
  if (pu >= 5) {
    b.reasons.push(`${comp} → ポリウレタン ${pu}% → 弾性糸5%以上 → 6004（幅30cm超）`)
    b.reasons.push("号はゴム糸を含むかで分かれる（v1 の規格に欄が無い） → 手入力")
    return b.done(null, "6004", "弾性糸5%以上の編物（6004）")
  }
  const primary = primaryFiber(rows)!
  const group = FIBER_GROUP[primary.fiber]
  const fiberLabel = FIBER_LABELS[primary.fiber]
  b.reasons.push(`編物・幅30cm超・弾性糸5%未満 → 6006`)
  if (group === "WOOL") {
    b.reasons.push(`${comp} → 毛 → 6006.10`)
    return b.done("6006.10", "6006", "毛の編物（6006.10）")
  }
  const sub = group === "COTTON" ? "2" : group === "SYNTHETIC" ? "3" : group === "ARTIFICIAL" ? "4" : null
  if (sub === null) {
    b.reasons.push(`${comp} → ${fiberLabel} → その他 → 6006.90`)
    return b.done("6006.90", "6006", `その他の繊維の編物（${fiberLabel}）`)
  }
  b.reasons.push(`${comp} → ${group === "COTTON" ? "綿" : group === "SYNTHETIC" ? "合成繊維" : "再生繊維"} → 6006.${sub}x`)
  const finish = spec?.finish
  if (!finish) {
    b.need("finish")
    b.reasons.push("仕上げが未選択 → 号の一の位が決まらない")
    return b.done(null, "6006", `編物（${fiberLabel}）`)
  }
  const last = finish === "UNBLEACHED" || finish === "BLEACHED" ? "1" : finish === "DYED" ? "2" : finish === "YARN_DYED" ? "3" : "4"
  b.reasons.push(`${FINISH_LABELS[finish]} → 6006.${sub}${last}`)
  return b.done(`6006.${sub}${last}`, "6006", `編物（${fiberLabel}）／${FINISH_LABELS[finish]}`)
}

// =============================================================================
// 付属
// =============================================================================
function classifyZipper(spec: ExportSpec | null): HsResult {
  const b = new Builder()
  b.reasons.push("ファスナー → 9607")
  const m = spec?.trimMaterial
  if (!m) {
    b.need("trimMaterial")
    b.reasons.push("務歯の素材が未選択 → 卑金属（.11）かその他（.19）か決まらない")
    return b.done(null, "9607", "スライドファスナー（9607）")
  }
  if (m === "METAL") {
    b.reasons.push("務歯が卑金属 → 9607.11")
    return b.done("9607.11", "9607", "スライドファスナー（務歯が卑金属）")
  }
  b.reasons.push(`務歯が${TRIM_MATERIAL_LABELS[m]} → その他 → 9607.19`)
  return b.done("9607.19", "9607", `スライドファスナー（${TRIM_MATERIAL_LABELS[m]}）`)
}

function classifyButton(spec: ExportSpec | null): HsResult {
  const b = new Builder()
  b.reasons.push("ボタン → 9606")
  if (spec?.trimForm === "PRESS_FASTENER") {
    b.reasons.push("スナップ（プレスファスナー） → 9606.10")
    return b.done("9606.10", "9606", "スナップ（プレスファスナー）")
  }
  const m = spec?.trimMaterial
  if (!m) {
    b.need("trimMaterial")
    b.reasons.push("素材が未選択 → 樹脂（.21）・卑金属（.22）・その他（.29）が決まらない")
    return b.done(null, "9606", "ボタン（9606）")
  }
  if (m === "PLASTIC") {
    b.reasons.push("樹脂・くるみでない → 9606.21")
    return b.done("9606.21", "9606", "ボタン（樹脂・くるみでない）")
  }
  if (m === "METAL") {
    b.reasons.push("卑金属・くるみでない → 9606.22")
    return b.done("9606.22", "9606", "ボタン（卑金属・くるみでない）")
  }
  b.reasons.push(`${TRIM_MATERIAL_LABELS[m]} → その他（くるみ・貝・木など） → 9606.29`)
  return b.done("9606.29", "9606", `ボタン（${TRIM_MATERIAL_LABELS[m]}）`)
}

function classifyNarrow(rows: CompositionData, spec: ExportSpec | null): HsResult {
  const b = new Builder()
  b.reasons.push("テープ・ゴム（細幅織物） → 5806")
  const pu = percentOf(rows, "POLYURETHANE")
  if (spec?.trimForm === "ELASTIC" || pu >= 5) {
    b.reasons.push(pu >= 5 ? `ポリウレタン ${pu}% → 弾性糸5%以上 → 5806.20` : "ゴム（弾性） → 弾性糸5%以上 → 5806.20")
    return b.done("5806.20", "5806", "細幅織物（弾性糸5%以上）")
  }
  const primary = primaryFiber(rows)
  if (!primary) {
    b.need("composition")
    b.reasons.push("混率が未入力 → 綿（.31）・人造繊維（.32）・その他（.39）が決まらない")
    return b.done(null, "5806", "細幅織物（5806）")
  }
  const group = FIBER_GROUP[primary.fiber]
  const comp = formatComposition(rows)
  if (group === "COTTON") {
    b.reasons.push(`${comp} → 綿 → 5806.31`)
    return b.done("5806.31", "5806", "細幅織物（綿）")
  }
  if (group === "SYNTHETIC" || group === "ARTIFICIAL") {
    b.reasons.push(`${comp} → 人造繊維 → 5806.32`)
    return b.done("5806.32", "5806", "細幅織物（人造繊維）")
  }
  b.reasons.push(`${comp} → その他の繊維 → 5806.39`)
  return b.done("5806.39", "5806", "細幅織物（その他の繊維）")
}

function classifyLabel(spec: ExportSpec | null): HsResult {
  const b = new Builder()
  b.reasons.push("ネーム・品質表示 → 5807")
  const f = spec?.trimForm
  if (!f) {
    b.need("trimForm")
    b.reasons.push("織ったものか印刷したものか未選択 → .10／.90 が決まらない")
    return b.done(null, "5807", "ネーム（5807）")
  }
  if (f === "WOVEN") {
    b.reasons.push("織ったもの → 5807.10")
    return b.done("5807.10", "5807", "織りネーム（5807.10）")
  }
  b.reasons.push(`${TRIM_FORM_LABELS[f]} → その他 → 5807.90`)
  return b.done("5807.90", "5807", `ネーム（${TRIM_FORM_LABELS[f]}）`)
}

function classifyHangTag(spec: ExportSpec | null): HsResult {
  const b = new Builder()
  b.reasons.push("下げ札（紙） → 4821")
  if (!spec?.trimForm) b.need("trimForm")
  b.reasons.push("号は印刷したものかで分かれる → 手入力")
  return b.done(null, "4821", "紙の下げ札（4821）")
}

function classifyThread(rows: CompositionData, spec: ExportSpec | null): HsResult {
  const b = new Builder()
  const primary = primaryFiber(rows)
  if (!primary) {
    b.need("composition")
    b.reasons.push("混率が未入力 → 綿（5204）か合成繊維（5401／5508）か決まらない")
    return b.done(null, null, "糸 — 混率を入れてください")
  }
  const comp = formatComposition(rows)
  const group = FIBER_GROUP[primary.fiber]
  if (group === "COTTON") {
    b.reasons.push(`${comp} → 綿の縫糸 → 5204`)
    b.reasons.push("号は小売用かで分かれる → 手入力")
    return b.done(null, "5204", "綿の縫糸（5204）")
  }
  if (group === "SYNTHETIC") {
    const yarn = spec?.yarnType
    if (!yarn) {
      b.need("yarnType")
      b.reasons.push(`${comp} → 合成繊維 → 長繊維（5401）か短繊維（5508）か未選択`)
      return b.done(null, "5401／5508", "合成繊維の縫糸 — 長繊維／短繊維を選んでください")
    }
    const h = yarn === "FILAMENT" ? "5401" : "5508"
    b.reasons.push(`${comp}・${yarn === "FILAMENT" ? "長繊維" : "短繊維"} → ${h}`)
    b.reasons.push("号は小売用かで分かれる → 手入力")
    return b.done(null, h, `合成繊維の縫糸（${h}）`)
  }
  b.reasons.push(`${comp} → ${FIBER_LABELS[primary.fiber]}の糸は v1 の木に無い → 手入力`)
  return b.done(null, null, "手入力（v1 の木に無い糸）")
}

/**
 * 画面の表示用の番号。
 * - code があればそのまま（例 "5208.33"）
 * - 項が 4 桁 1 つだけなら「5208..」（号は手入力の印）
 * - 範囲・複数（"5210〜5212"・"5111／5112"）は「..」を付けずそのまま（FIX-1 B-2）
 */
export function displayHsCandidate(r: HsResult): string {
  if (r.code) return r.code
  if (r.heading) return /^\d{4}$/.test(r.heading) ? `${r.heading}..` : r.heading
  return "—"
}

/** 画面に添える一言: 号まで決まらないときの案内（code が無く heading があるときだけ） */
export function candidateNote(r: HsResult): string | null {
  if (r.code || !r.heading) return null
  return /^\d{4}$/.test(r.heading) ? "項まで（号は手入力）" : "項の候補が複数（号は手入力）"
}

/** 今の HS コードと候補の code が両方あって違うか（FIX-1 B-4 の注意に使う） */
export function candidateDiffersFromHsCode(r: HsResult, hsCode: string | null | undefined): boolean {
  const current = (hsCode ?? "").trim()
  return current !== "" && r.code !== null && current !== r.code
}

/** 画面の表示用: 候補を HS コード欄に入れられるか */
export function canAdoptCandidate(r: HsResult): boolean {
  return r.code !== null
}

export type { Weave }
