/**
 * B-211 PR-2（§4）: questions.ts の検証（テストランナー非依存・DB 非接続）。手動実行: npx tsx src/lib/hs/questions.test.ts
 */
import { classifyHs, type ClassifyInput } from "./classify"
import { hsQuestionKind, hsQuestionOptions, nextHsQuestion, HS_QUESTION_LABELS } from "./questions"
import type { CompositionData, ExportSpec } from "./export-spec"

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`)
}
let passed = 0

function ask(
  materialType: ClassifyInput["materialType"],
  compositionData: CompositionData | null,
  exportSpec: Partial<ExportSpec> | null,
  fabricWeight: number | null = null,
  fabricWidth: number | null = null,
) {
  const r = classifyHs({
    materialType,
    compositionData,
    exportSpec: exportSpec ? { version: 1, ...exportSpec } : null,
    fabricWeight,
    fabricWidth,
  })
  return { r, q: nextHsQuestion(r) }
}
const cotton100: CompositionData = [{ fiber: "COTTON", percent: 100 }]

// ① 素材タイプだけの生地 → composition（混率が先）／混率だけ → fabricForm
{
  assert(ask("FABRIC", null, null).q === "composition", "①-1 混率を先に聞く")
  assert(ask("FABRIC", cotton100, null).q === "fabricForm", "①-2 次は織物／編物／不織布")
  passed++
}

// ② 綿 100%・織物・綾織・浸染・目付なし → fabricWeight／全部そろう → null
{
  assert(ask("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "DYED" }, null).q === "fabricWeight", "②-1 目付")
  const done = ask("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "DYED" }, 162)
  assert(done.q === null && done.r.code === "5208.33", `②-2 そろえば null → ${done.q} ${done.r.code}`)
  passed++
}

// ③ ファスナーで素材なし → trimMaterial／袋 → null（手入力）
{
  assert(ask("ZIPPER", null, null).q === "trimMaterial", "③-1 ファスナー")
  const bag = ask("POLYBAG", null, null)
  assert(bag.q === null && bag.r.code === null && bag.r.heading === null, "③-2 袋は質問なし・手入力")
  passed++
}

// ④ 質問に順に答えると 5208.33 に着く（SY8300624 の生地）
{
  let comp: CompositionData | null = null
  const spec: Partial<ExportSpec> = {}
  let weight: number | null = null
  const trail: string[] = []
  for (let i = 0; i < 10; i++) {
    const { r, q } = ask("FABRIC", comp, spec, weight)
    if (q === null) {
      assert(r.code === "5208.33", `④ 最後の code → ${r.code}`)
      break
    }
    trail.push(q)
    switch (q) {
      case "composition":
        comp = cotton100
        break
      case "fabricForm":
        spec.fabricForm = "WOVEN"
        break
      case "fabricWeight":
        weight = 162
        break
      case "finish":
        spec.finish = "DYED"
        break
      case "weave":
        spec.weave = "TWILL_3_4"
        break
      default:
        throw new Error(`④ 想定外の質問 ${q}`)
    }
  }
  assert(
    JSON.stringify(trail) === JSON.stringify(["composition", "fabricForm", "fabricWeight", "finish", "weave"]),
    `④ 質問の順 → ${JSON.stringify(trail)}`,
  )
  passed++
}

// ⑤ 聞き方と選択肢
{
  assert(hsQuestionKind("composition") === "composition" && hsQuestionKind("fabricWeight") === "number", "⑤-1 kind")
  assert(hsQuestionKind("finish") === "choice" && hsQuestionKind("isDenim") === "boolean", "⑤-2 kind")
  const fin = hsQuestionOptions("finish")
  assert(fin !== null && fin.length === 5 && fin[2].value === "DYED" && fin[2].label === "浸染（後染め）", "⑤-3 仕上げの選択肢")
  assert(hsQuestionOptions("composition") === null && hsQuestionOptions("fabricWeight") === null, "⑤-4 混率・目付は選択肢なし")
  const den = hsQuestionOptions("isDenim")
  assert(den !== null && den.length === 2 && den[0].value === "true", "⑤-5 はい／いいえ")
  assert(HS_QUESTION_LABELS.fabricWeight.includes("目付") && HS_QUESTION_LABELS.trimMaterial.includes("素材"), "⑤-6 文言")
  passed++
}

// ⑥ 先染めの綾織 230g → isDenim を聞く → いいえ → 5209.43
{
  const a = ask("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "YARN_DYED" }, 230)
  assert(a.q === "isDenim", `⑥-1 → ${a.q}`)
  const b = ask("FABRIC", cotton100, { fabricForm: "WOVEN", weave: "TWILL_3_4", finish: "YARN_DYED", isDenim: false }, 230)
  assert(b.q === null && b.r.code === "5209.43", `⑥-2 → ${b.r.code}`)
  passed++
}

console.log(`questions.test.ts: ${passed} groups passed`)
