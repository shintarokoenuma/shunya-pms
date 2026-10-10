import type { HsMissing, HsResult } from "./classify"
import {
  FABRIC_FORMS,
  FABRIC_FORM_LABELS,
  FINISHES,
  FINISH_LABELS,
  TRIM_FORMS,
  TRIM_FORM_LABELS,
  TRIM_MATERIALS,
  TRIM_MATERIAL_LABELS,
  WEAVES,
  WEAVE_LABELS,
  YARN_TYPES,
  YARN_TYPE_LABELS,
} from "./export-spec"

/**
 * B-211 PR-2（P2-D3）: HS を決める質問の順番と聞き方
 * - 質問は classifyHs の missing の先頭。答えるたびに判定し直し、missing が空になれば質問は終わり
 * - 画面の文言・選択肢もここに置く（発注のダイアログと将来の画面で共有）
 */
export type HsQuestionKey = HsMissing

/** 次に聞く項目。無ければ null（号まで決まったか、手入力の材料） */
export function nextHsQuestion(result: HsResult): HsQuestionKey | null {
  return result.missing[0] ?? null
}

export type HsQuestionKind = "composition" | "number" | "choice" | "boolean"

export function hsQuestionKind(key: HsQuestionKey): HsQuestionKind {
  switch (key) {
    case "composition":
      return "composition"
    case "fabricWeight":
    case "fabricWidth":
      return "number"
    case "isDenim":
    case "isPile":
      return "boolean"
    default:
      return "choice"
  }
}

export const HS_QUESTION_LABELS: Record<HsQuestionKey, string> = {
  composition: "混率は？（繊維と %）",
  fabricWeight: "目付は？（g/㎡）",
  fabricWidth: "幅は？（cm）",
  fabricForm: "織物・編物・不織布のどれ？",
  yarnType: "糸は短繊維（紡績糸）？ 長繊維？",
  weave: "組織は？",
  finish: "仕上げは？",
  isDenim: "デニム（綿の先染め綾織・200g/㎡超）？",
  isPile: "パイル編み？",
  trimMaterial: "付属の素材は？",
  trimForm: "付属の形は？",
  // 判定の記録は質問にならない（missing に出ない）が型のため
  version: "",
  hsSource: "",
  copiedFromMaterialId: "",
  decidedAt: "",
  decidedByUserId: "",
}

export type HsQuestionOption = { value: string; label: string }

/** 選択肢（choice / boolean のとき）。composition / number は null */
export function hsQuestionOptions(key: HsQuestionKey): HsQuestionOption[] | null {
  const of = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
    values.map((v) => ({ value: v, label: labels[v] }))
  switch (key) {
    case "fabricForm":
      return of(FABRIC_FORMS, FABRIC_FORM_LABELS)
    case "yarnType":
      return of(YARN_TYPES, YARN_TYPE_LABELS)
    case "weave":
      return of(WEAVES, WEAVE_LABELS)
    case "finish":
      return of(FINISHES, FINISH_LABELS)
    case "trimMaterial":
      return of(TRIM_MATERIALS, TRIM_MATERIAL_LABELS)
    case "trimForm":
      return of(TRIM_FORMS, TRIM_FORM_LABELS)
    case "isDenim":
    case "isPile":
      return [
        { value: "true", label: "はい" },
        { value: "false", label: "いいえ" },
      ]
    default:
      return null
  }
}
