import { BomItemCategory, FabricProcurementMode } from "@prisma/client"

/** QE-0b: BOM 明細区分の日本語ラベル（enum 全20値を網羅）。 */
export const BOM_ITEM_CATEGORY_LABELS: Record<BomItemCategory, string> = {
  MAIN_FABRIC: "本体生地",
  LINING_FABRIC: "裏地",
  INTERLINING: "芯地",
  ZIPPER: "ファスナー",
  BUTTON: "ボタン",
  THREAD: "糸",
  ELASTIC: "ゴム",
  TAPE: "テープ",
  RIVET: "リベット",
  BRAND_LABEL: "ブランドネーム",
  SIZE_LABEL: "サイズラベル",
  CARE_LABEL: "品質表示",
  HANG_TAG: "下げ札",
  POLYBAG: "ポリ袋",
  OPP_BAG: "OPP袋",
  BOX: "箱",
  TISSUE: "詰め紙",
  ACCESSORY: "その他副資材",
  OTHER: "その他",
}

export const BOM_ITEM_CATEGORY_OPTIONS: {
  value: BomItemCategory
  label: string
}[] = (Object.keys(BOM_ITEM_CATEGORY_LABELS) as BomItemCategory[]).map(
  (value) => ({ value, label: BOM_ITEM_CATEGORY_LABELS[value] }),
)

/** 生地系カテゴリ（procurementMode を出すかの判定用）。 */
export const FABRIC_CATEGORIES: ReadonlySet<BomItemCategory> = new Set([
  BomItemCategory.MAIN_FABRIC,
  BomItemCategory.LINING_FABRIC,
  BomItemCategory.INTERLINING,
])

export const PROCUREMENT_MODE_LABELS: Record<FabricProcurementMode, string> = {
  ROLL: "反売り（取り切り）",
  METER: "メーター売り",
}

export const PROCUREMENT_MODE_OPTIONS: {
  value: FabricProcurementMode
  label: string
}[] = [
  { value: "ROLL", label: "反売り（取り切り）" },
  { value: "METER", label: "メーター売り" },
]

/** 単位プルダウン（PoItem の流儀に揃える + BOM 用に組/巻 を追加）。 */
export const BOM_UNIT_OPTIONS = ["m", "個", "組", "巻", "kg", "本", "枚", "一式"] as const

/** サイズ単位（PoItem v1.2 と同型）。 */
export const SIZE_UNIT_OPTIONS = ["cm", "mm", "m", "inch"] as const

/** 用尺の出所（CAD は B-047 予約・UI 非対象）。 */
export const USAGE_SOURCE_LABELS: Record<"MANUAL" | "MARKING_SHEET", string> = {
  MANUAL: "直接入力",
  MARKING_SHEET: "マーキング図から転記",
}
