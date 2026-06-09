import { WorkOrderType } from "@prisma/client"

/**
 * 発注種別（WorkOrderType・大分類）共通モジュール
 *
 * 加工分類の 2 階層のうち「大分類」。小分類は ProcessingType マスター（name）。
 * ProcessingType.workType / WorkOrder.workType（PR② S-4b-2）で共通使用する。
 *
 * ★WASHING のラベルは「洗い・加工」。加工工場で洗いまで一括処理する運用実態に合わせ、
 *   加工単独の大分類を設けず WASHING に寄せている（enum 値は WASHING のまま）。
 *   FINISHING（仕上げ）は別大分類で据え置き。
 *
 * Record は全 14 値を網羅（漏れると型エラーでコンパイルが落ちる）。
 */

export const WORK_ORDER_TYPE_LABELS: Record<WorkOrderType, string> = {
  SEWING: "縫製",
  CUTTING: "裁断",
  PRINTING: "プリント",
  EMBROIDERY: "刺繍",
  WASHING: "洗い・加工",
  DYEING: "染色",
  FINISHING: "仕上げ",
  PATTERN_MAKING: "パターンメイキング",
  PATTERN_REVISION: "パターン修正",
  GRADING: "グレーディング",
  SAMPLE_MAKING: "サンプル製作",
  ASSEMBLY: "組立",
  INSPECTION: "検品",
  OTHER: "その他",
}

export const WORK_ORDER_TYPE_OPTIONS: Array<{
  value: WorkOrderType
  label: string
}> = (Object.keys(WORK_ORDER_TYPE_LABELS) as WorkOrderType[]).map((value) => ({
  value,
  label: WORK_ORDER_TYPE_LABELS[value],
}))
