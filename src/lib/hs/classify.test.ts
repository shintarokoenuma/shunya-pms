/**
 * B-211 PR-1（§4）: classify.ts の検証（テストランナー非依存・DB 非接続）。手動実行: npx tsx src/lib/hs/classify.test.ts
 */
import { classifyHs, displayHsCandidate, type ClassifyInput } from "./classify"
import {
  compositionDataSchema,
  exportSpecSchema,
  formatComposition,
  normalizeExportSpec,
  primaryFiber,
  referenceUrlsSchema,
  type CompositionData,
  type ExportSpec,
} from "./export-spec"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}
let passed = 0

function run(
  materialType: ClassifyInput["materialType"],
  compositionData: CompositionData | null,
  exportSpec: Partial<ExportSpec> | null,
  fabricWeight: number | null = null,
  fabricWidth: number | null = null,
) {
  return classifyHs({
    materialType,
    compositionData,
    exportSpec: exportSpec ? { version: 1, ...exportSpec } : null,
    fabricWeight,
    fabricWidth,
  })
}
const cotton100: CompositionData = [{ fiber: "COTTON", percent: 100 }]
const linen100: CompositionData = [{ fiber: "LINEN", percent: 100 }]

// ① SY8300624 の生地: 綿100%・織物・短繊維・綾織・浸染・162g → 5208.33・reasons 4 本・verified false
{
  const r = run("FABRIC", cotton100, { fabricForm: "WOVEN", yarnType: "STAPLE", weave: "TWILL_3_4", finish: "DYED" }, 162)
  assert(r.code === "5208.33", `①-1 code → ${r.code}`)
  assert(r.heading === "5208", `①-2 heading → ${r.heading}`)
  assert(r.reasons.length === 4, `①-3 reasons 4 本 → ${r.reasons.length}: ${JSON.stringify(r.reasons)}`)
  assert(r.verified === false, "①-4 verified false")
  assert(r.missing.length === 0, `①-5 missing 空 → ${JSON.stringify(r.missing)}`)
  assert(r.reasons[0].includes("綿85%以上") && r.reasons[0].includes("52類"), `①-6 根拠1 → ${r.reasons[0]}`)
  assert(r.reasons[1].includes("200g/㎡以下") && r.reasons[1].includes("5208"), `①-7 根拠2 → ${r.reasons[1]}`)
  assert(r.reasons[2].includes("5208.3x"), `①-8 根拠3 → ${r.reasons[2]}`)
  assert(r.reasons[3].includes("5208.33"), `①-9 根拠4 → ${r.reasons[3]}`)
  assert(r.label.includes("綿織物") && r.label.includes("浸染") && r.label.includes("綾織"), `①-10 label → ${r.label}`)
  passed++
}

// ② 230g → 5209.32／先染め 230g デニム → 5209.42／先染め 230g デニムでない → 5209.43
{
  const a = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "DYED" }, 230)
  assert(a.code === "5209.32", `②-1 → ${a.code}`)
  const b = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "YARN_DYED", isDenim: true }, 230)
  assert(b.code === "5209.42", `②-2 → ${b.code}`)
  const c = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "YARN_DYED", isDenim: false }, 230)
  assert(c.code === "5209.43", `②-3 → ${c.code}`)
  const d = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "YARN_DYED" }, 230)
  assert(d.code === null && d.heading === "5209" && d.missing.includes("isDenim"), `②-4 デニム未回答 → ${d.code} ${JSON.stringify(d.missing)}`)
  const e = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "PLAIN", finish: "YARN_DYED" }, 230)
  assert(e.code === "5209.41", `②-5 先染め平織 → ${e.code}`)
  const f = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "PRINTED" }, 230)
  assert(f.code === "5209.52", `②-6 なせん綾織 200超 → ${f.code}`)
  passed++
}

// ③ なせん・綾織・162g → 5208.59（.53 にならない）／なせん・平織・90g → 5208.51／平織 162g 浸染 → 5208.32
{
  const a = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "PRINTED" }, 162)
  assert(a.code === "5208.59", `③-1 → ${a.code}`)
  const b = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "PLAIN", finish: "PRINTED" }, 90)
  assert(b.code === "5208.51", `③-2 → ${b.code}`)
  const c = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "PLAIN", finish: "DYED" }, 162)
  assert(c.code === "5208.32", `③-3 → ${c.code}`)
  const d = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "PLAIN", finish: "UNBLEACHED" }, 100)
  assert(d.code === "5208.11", `③-4 未晒平織 100g → ${d.code}`)
  passed++
}

// ④ 綿 60%・ポリエステル 40% → code null・heading に 5210〜5212 の案内・missing に composition
{
  const r = run(
    "FABRIC",
    [
      { fiber: "COTTON", percent: 60 },
      { fiber: "POLYESTER", percent: 40 },
    ],
    { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "DYED" },
    162,
  )
  assert(r.code === null, `④-1 code null → ${r.code}`)
  assert(r.heading !== null && r.heading.includes("5210") && r.heading.includes("5212"), `④-2 heading → ${r.heading}`)
  assert(r.missing.includes("composition"), `④-3 missing → ${JSON.stringify(r.missing)}`)
  assert(displayHsCandidate(r) === "5210〜5212..", `④-4 表示 → ${displayHsCandidate(r)}`)
  passed++
}

// ⑤ 目付が空の綿織物 → code null・missing に fabricWeight
{
  const r = run("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "DYED" }, null)
  assert(r.code === null, `⑤-1 → ${r.code}`)
  assert(r.missing.includes("fabricWeight"), `⑤-2 → ${JSON.stringify(r.missing)}`)
  assert(r.verified === false, "⑤-3 verified false")
  passed++
}

// ⑥ リネン 100% 先染め → 5309.19／リネン 100% 未晒 → 5309.11／リネン 70% 浸染 → 5309.29
{
  const a = run("FABRIC", linen100, { fabricForm: "WOVEN", weave: "PLAIN", finish: "YARN_DYED" })
  assert(a.code === "5309.19", `⑥-1 → ${a.code}`)
  const b = run("FABRIC", linen100, { fabricForm: "WOVEN", finish: "UNBLEACHED" })
  assert(b.code === "5309.11", `⑥-2 → ${b.code}`)
  const c = run(
    "FABRIC",
    [
      { fiber: "LINEN", percent: 70 },
      { fiber: "COTTON", percent: 30 },
    ],
    { fabricForm: "WOVEN", finish: "DYED" },
  )
  assert(c.code === "5309.29", `⑥-3 → ${c.code}`)
  const d = run("FABRIC", linen100, { fabricForm: "WOVEN" })
  assert(d.code === null && d.heading === "5309" && d.missing.includes("finish"), `⑥-4 仕上げ未選択 → ${d.code} ${JSON.stringify(d.missing)}`)
  passed++
}

// ⑦ ポリエステル 100% 短繊維 浸染 → 5512.19／長繊維 → heading 5407／レーヨン短繊維 → 5516
{
  const poly: CompositionData = [{ fiber: "POLYESTER", percent: 100 }]
  const a = run("FABRIC", poly, { fabricForm: "WOVEN", yarnType: "STAPLE", finish: "DYED" })
  assert(a.code === "5512.19", `⑦-1 → ${a.code}`)
  const b = run("FABRIC", poly, { fabricForm: "WOVEN", yarnType: "STAPLE", finish: "BLEACHED" })
  assert(b.code === "5512.11", `⑦-2 → ${b.code}`)
  const c = run("FABRIC", poly, { fabricForm: "WOVEN", yarnType: "FILAMENT" })
  assert(c.code === null && c.heading === "5407", `⑦-3 → ${c.code} ${c.heading}`)
  const d = run("FABRIC", [{ fiber: "RAYON", percent: 100 }], { fabricForm: "WOVEN", yarnType: "STAPLE" })
  assert(d.code === null && d.heading === "5516", `⑦-4 → ${d.heading}`)
  const e = run("FABRIC", poly, { fabricForm: "WOVEN" })
  assert(e.code === null && e.missing.includes("yarnType"), `⑦-5 糸の種類未選択 → ${JSON.stringify(e.missing)}`)
  passed++
}

// ⑧ 編物・綿 100%・浸染 → 6006.22／編物・ポリウレタン 8% → heading 6004／パイル → 6001／幅 25cm → 6003
{
  const a = run("FABRIC", cotton100, { fabricForm: "KNIT", finish: "DYED" }, null, 150)
  assert(a.code === "6006.22", `⑧-1 → ${a.code}`)
  const b = run(
    "FABRIC",
    [
      { fiber: "COTTON", percent: 92 },
      { fiber: "POLYURETHANE", percent: 8 },
    ],
    { fabricForm: "KNIT", finish: "DYED" },
    null,
    150,
  )
  assert(b.code === null && b.heading === "6004", `⑧-2 → ${b.code} ${b.heading}`)
  const c = run("FABRIC", cotton100, { fabricForm: "KNIT", isPile: true }, null, 150)
  assert(c.code === null && c.heading === "6001", `⑧-3 → ${c.heading}`)
  const d = run("FABRIC", cotton100, { fabricForm: "KNIT", finish: "DYED" }, null, 25)
  assert(d.code === null && d.heading === "6003", `⑧-4 → ${d.heading}`)
  const e = run("FABRIC", cotton100, { fabricForm: "KNIT", finish: "DYED" }, null, null)
  assert(e.code === "6006.22" && e.missing.includes("fabricWidth"), `⑧-5 幅未入力でも 6006.22・missing に fabricWidth → ${e.code} ${JSON.stringify(e.missing)}`)
  const f = run("FABRIC", [{ fiber: "POLYESTER", percent: 100 }], { fabricForm: "KNIT", finish: "YARN_DYED" }, null, 150)
  assert(f.code === "6006.33", `⑧-6 合成・先染め → ${f.code}`)
  passed++
}

// ⑨ ファスナー金属 → 9607.11／樹脂 → 9607.19／ボタン樹脂 → 9606.21／くるみ → 9606.29／金属 → 9606.22／スナップ → 9606.10
{
  assert(run("ZIPPER", null, { trimMaterial: "METAL", trimForm: "SLIDE_FASTENER" }).code === "9607.11", "⑨-1 ファスナー金属")
  assert(run("ZIPPER", null, { trimMaterial: "PLASTIC" }).code === "9607.19", "⑨-2 ファスナー樹脂")
  const z = run("ZIPPER", null, null)
  assert(z.code === null && z.heading === "9607" && z.missing.includes("trimMaterial"), "⑨-3 ファスナー素材未選択")
  assert(run("BUTTON", null, { trimMaterial: "PLASTIC", trimForm: "BUTTON" }).code === "9606.21", "⑨-4 ボタン樹脂")
  assert(run("BUTTON", null, { trimMaterial: "COVERED", trimForm: "BUTTON" }).code === "9606.29", "⑨-5 ボタンくるみ")
  assert(run("BUTTON", null, { trimMaterial: "SHELL" }).code === "9606.29", "⑨-6 ボタン貝")
  assert(run("BUTTON", null, { trimMaterial: "METAL" }).code === "9606.22", "⑨-7 ボタン金属")
  assert(run("BUTTON", null, { trimForm: "PRESS_FASTENER", trimMaterial: "METAL" }).code === "9606.10", "⑨-8 スナップ")
  passed++
}

// ⑩ ゴムテープ → 5806.20／織りネーム → 5807.10／綿テープ → 5806.31／印刷ネーム → 5807.90／下げ札 → 4821 のみ
{
  assert(run("ELASTIC", null, { trimForm: "ELASTIC" }).code === "5806.20", "⑩-1 ゴムテープ（形）")
  assert(
    run("TAPE", [{ fiber: "POLYESTER", percent: 90 }, { fiber: "POLYURETHANE", percent: 10 }], { trimForm: "NARROW_WOVEN" }).code === "5806.20",
    "⑩-2 ゴム 10% のテープ",
  )
  assert(run("TAPE", cotton100, { trimForm: "NARROW_WOVEN" }).code === "5806.31", "⑩-3 綿テープ")
  assert(run("TAPE", [{ fiber: "POLYESTER", percent: 100 }], { trimForm: "NARROW_WOVEN" }).code === "5806.32", "⑩-4 ポリエステルテープ")
  assert(run("LABEL", null, { trimForm: "WOVEN", trimMaterial: "TEXTILE" }).code === "5807.10", "⑩-5 織りネーム")
  assert(run("CARE_LABEL", null, { trimForm: "PRINTED" }).code === "5807.90", "⑩-6 印刷ネーム")
  const h = run("HANG_TAG", null, { trimMaterial: "PAPER" })
  assert(h.code === null && h.heading === "4821", `⑩-7 下げ札 → ${h.heading}`)
  passed++
}

// ⑪ 袋 → code・heading とも null／糸
{
  const a = run("POLYBAG", null, null)
  assert(a.code === null && a.heading === null, "⑪-1 ポリ袋")
  assert(run("PACKAGING_BAG", null, null).heading === null && run("BOX", null, null).heading === null, "⑪-2 袋・箱")
  const t = run("THREAD", [{ fiber: "POLYESTER", percent: 100 }], { yarnType: "STAPLE" })
  assert(t.code === null && t.heading === "5508", `⑪-3 糸 → ${t.heading}`)
  assert(run("THREAD", cotton100, null).heading === "5204", "⑪-4 綿糸")
  passed++
}

// ⑫ 混率が無い・同率・織物／編物未選択・毛
{
  const a = run("FABRIC", null, { fabricForm: "WOVEN" })
  assert(a.code === null && a.missing.includes("composition"), "⑫-1 混率なし")
  const b = run("FABRIC", [{ fiber: "COTTON", percent: 50 }, { fiber: "POLYESTER", percent: 50 }], { fabricForm: "WOVEN" }, 150)
  assert(b.code === null && b.missing.includes("composition"), "⑫-2 同率")
  const c = run("FABRIC", cotton100, null, 150)
  assert(c.code === null && c.missing.includes("fabricForm"), "⑫-3 織物／編物未選択")
  const d = run("FABRIC", [{ fiber: "WOOL", percent: 100 }], { fabricForm: "WOVEN" })
  assert(d.code === null && d.heading === "5111／5112", `⑫-4 毛 → ${d.heading}`)
  const e = run("FABRIC", cotton100, { fabricForm: "NONWOVEN" })
  assert(e.code === null && e.heading === "5603" && e.missing.includes("fabricWeight"), "⑫-5 不織布")
  passed++
}

// ⑬ export-spec の zod・補助
{
  const c = compositionDataSchema.safeParse([{ fiber: "COTTON", percent: "60" }, { fiber: "POLYESTER", percent: 40 }])
  assert(c.success && c.data[0].percent === 60, "⑬-1 percent の文字列を number 化")
  assert(!compositionDataSchema.safeParse([{ fiber: "GOLD", percent: 1 }]).success, "⑬-2 未知の繊維は弾く")
  assert(!compositionDataSchema.safeParse([{ fiber: "COTTON", percent: 101 }]).success, "⑬-3 101% は弾く")
  assert(!compositionDataSchema.safeParse([{ fiber: "COTTON", percent: "" }]).success, "⑬-3b 空の % は弾く（0% にしない）")
  const s = exportSpecSchema.safeParse({ fabricForm: "WOVEN", weave: "TWILL_3_4" })
  assert(s.success && s.data.version === 1, "⑬-4 version を補う")
  assert(!exportSpecSchema.safeParse({ fabricForm: "LACE" }).success, "⑬-5 未知の値は弾く")
  assert(normalizeExportSpec({ version: 1 }) === null, "⑬-6 空の規格は null")
  assert(normalizeExportSpec({ version: 1, finish: undefined, hsSource: "MANUAL" })?.hsSource === "MANUAL", "⑬-7 記録だけでも残る")
  assert(!("finish" in (normalizeExportSpec({ version: 1, finish: undefined, hsSource: "MANUAL" }) ?? {})), "⑬-8 undefined の欄は落とす")
  assert(formatComposition(cotton100) === "綿 100%", `⑬-9 → ${formatComposition(cotton100)}`)
  const p = primaryFiber([{ fiber: "COTTON", percent: 60 }, { fiber: "POLYESTER", percent: 40 }])
  assert(p?.fiber === "COTTON" && p.tie === false, "⑬-10 主素材")
  assert(referenceUrlsSchema.safeParse([{ label: "メーカー", url: "https://example.com/x" }]).success, "⑬-11 URL ok")
  assert(!referenceUrlsSchema.safeParse([{ label: "", url: "ftp://x" }]).success, "⑬-12 http(s) 以外は弾く")
  passed++
}

console.log(`classify.test.ts: ${passed} groups passed`)
