/**
 * (A) 量産見積の表示ラベル・選択肢（中立モジュール・client からも import 可）。
 * @prisma/client からは enum のみ import（値はビルド時インライン化）。
 */
import {
  Currency,
  ProductionEstimateCategory,
  ProductionEstimateItemSource,
  FabricProcurementMode,
} from "@prisma/client"

export const PRODUCTION_ESTIMATE_CATEGORY_LABELS: Record<
  ProductionEstimateCategory,
  string
> = {
  [ProductionEstimateCategory.MATERIAL]: "材料費",
  [ProductionEstimateCategory.LABOR]: "工賃",
}

export const PRODUCTION_ESTIMATE_SOURCE_LABELS: Record<
  ProductionEstimateItemSource,
  string
> = {
  [ProductionEstimateItemSource.MANUAL]: "手入力",
  [ProductionEstimateItemSource.SAMPLE_PO]: "サンプル PO",
  [ProductionEstimateItemSource.SAMPLE_WO]: "サンプル WO",
  [ProductionEstimateItemSource.BOM]: "BOM",
}

/** 行通貨の選択肢（5値・§1-6: T-0 前データの通貨を人が確認・修正できる）。 */
export const PE_CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: Currency.JPY, label: "JPY（円）" },
  { value: Currency.USD, label: "USD（米ドル）" },
  { value: Currency.CNY, label: "CNY（元）" },
  { value: Currency.VND, label: "VND（ドン）" },
  { value: Currency.EUR, label: "EUR（ユーロ）" },
]

/** JPY 換算対象（他は計算除外＝除外表示）。 */
export const PE_CONVERTIBLE_CURRENCIES: Currency[] = [Currency.JPY, Currency.USD]

/** PE 明細の単位候補（プルダウン・末尾に「その他…」自由入力フォールバック）。 */
export const PE_UNIT_OPTIONS: string[] = [
  "m",
  "yd",
  "個",
  "枚",
  "組",
  "式",
  "巻",
  "反",
  "㎏",
  "cm",
]

export const PE_PROCUREMENT_MODE_OPTIONS: Array<{
  value: FabricProcurementMode
  label: string
}> = [
  { value: FabricProcurementMode.ROLL, label: "ROLL（反売り・取り切り）" },
  { value: FabricProcurementMode.METER, label: "METER（メーター売り）" },
]
