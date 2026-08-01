/**
 * B-094: 品番カルテ 縫製指示の共有型（中立モジュール・"use server"/prisma 非依存）。
 * client component が "use server" の actions ファイルから型を import すると
 * ブラウザバンドルに @prisma/client が漏れるため、型はここに置いて decouple する（PR #85 の轍）。
 */

/** Product.sewingInstructions(Json) の形。全 value は string | null（未入力＝null）。 */
export type SewingInstruction = {
  version: 1
  fixed: {
    namePosition: string | null
    careLabelPosition: string | null
    finishingMethod: string | null
    postProcessing: string | null
    hangTag: string | null
  }
  sewing: {
    lining: string | null
    thread: string | null
    stitch: string | null
    patternMatching: string | null
    insertion: string | null
    fabricDirection: string | null
  }
}

export type SewingFixedKey = keyof SewingInstruction["fixed"]
export type SewingDetailKey = keyof SewingInstruction["sewing"]

/** 項目ラベル（画面・将来の B-054 PDF で共用）。 */
export const SEWING_INSTRUCTION_LABELS: Record<SewingFixedKey | SewingDetailKey, string> = {
  namePosition: "ネーム位置",
  careLabelPosition: "洗濯ネーム位置",
  finishingMethod: "仕上げ方法",
  postProcessing: "製品後加工",
  hangTag: "下げ札",
  lining: "裏",
  thread: "糸",
  stitch: "ステッチ（番手）",
  patternMatching: "柄合わせ",
  insertion: "差し込み",
  fabricDirection: "生地方向",
}

/**
 * 既定候補。空配列＝候補なし（自由入力のみ）。
 * 現場 Excel 縫製仕様書の印字候補が出典（M-65 パッチJKT / 26A-SH01 ウエスタンSH）。
 * 運用で追記して育てる。
 */
export const SEWING_INSTRUCTION_OPTIONS: Record<SewingFixedKey | SewingDetailKey, readonly string[]> = {
  namePosition: ["CB衿ぐり付け～3.0cm下", "CB流し込み"],
  careLabelPosition: [],
  finishingMethod: [],
  postProcessing: [],
  hangTag: [],
  lining: ["総裏", "身頃のみ", "背裏", "袖裏", "裏無し"],
  thread: ["地色", "その他"],
  stitch: [],
  patternMatching: ["有", "無"],
  insertion: ["不可", "組合せ", "一方向"],
  fabricDirection: ["並", "逆"],
}

/** 表示順（画面・PDF で共用）。 */
export const SEWING_FIXED_ORDER: readonly SewingFixedKey[] = [
  "namePosition",
  "careLabelPosition",
  "finishingMethod",
  "postProcessing",
  "hangTag",
]

export const SEWING_DETAIL_ORDER: readonly SewingDetailKey[] = [
  "lining",
  "thread",
  "stitch",
  "patternMatching",
  "insertion",
  "fabricDirection",
]

/** 全項目 null の空値。列が null の場合の表示・編集初期値に使う。 */
export const EMPTY_SEWING_INSTRUCTION: SewingInstruction = {
  version: 1,
  fixed: {
    namePosition: null,
    careLabelPosition: null,
    finishingMethod: null,
    postProcessing: null,
    hangTag: null,
  },
  sewing: {
    lining: null,
    thread: null,
    stitch: null,
    patternMatching: null,
    insertion: null,
    fabricDirection: null,
  },
}
