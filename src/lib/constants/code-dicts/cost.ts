import type { DictEntry } from "@/lib/utils/code-suggest"

/**
 * Phase 1A-17: CostCategory (原価費目) のコード辞書
 *
 * 1A-16 で定義した CostCategory Lv2 35 行の categoryCode を機械的に辞書化 +
 * 表記揺れ数語を追加。Lv1 (予約 4 行) は新規作成 UI が無いため辞書には含めない。
 *
 * 候補は新規 Lv2 作成フォームで親選択時に `親コード-候補` の組み合わせで提示される。
 */
export const COST_TERM_DICT: Record<string, DictEntry> = {
  // ────────── MATERIAL 配下 ──────────
  本体生地: ["MAIN_FABRIC"],
  裏地: ["LINING"],
  芯地: ["INTERLINING"],
  ファスナー: ["ZIPPER"],
  ボタン: ["BUTTON"],
  糸: ["THREAD"],
  その他副資材: ["ACCESSORY"],
  "ラベル・ネーム類": ["LABEL"],
  包装材: ["PACKAGING"],
  梱包: ["PACKAGING"],

  // ────────── SEWING 配下 ──────────
  通常縫製: ["REGULAR_SEWING"],
  縫製: ["REGULAR_SEWING"],
  特殊縫製: ["SPECIAL_SEWING"],
  仕上げ: ["FINISHING"],

  // ────────── PROCESSING 配下 ──────────
  プリント: ["PRINTING"],
  刺繍: ["EMBROIDERY"],
  洗い加工: ["WASHING"],
  染色: ["DYEING"],
  特殊加工: ["SPECIAL_PROCESSING"],

  // ────────── OVERHEAD 配下 ──────────
  パターン代: ["PATTERN_FEE"],
  グレーディング代: ["GRADING_FEE"],
  サンプル製作費: ["SAMPLE_FEE"],
  検品費: ["INSPECTION_FEE"],
  国内輸送費: ["DOMESTIC_TRANSPORT"],
  国際輸送費: ["INTERNATIONAL_TRANSPORT"],
  通関費: ["CUSTOMS_FEE"],
  関税: ["TARIFF"],
  輸入消費税: ["IMPORT_TAX"],
  保管費: ["STORAGE_FEE"],
  保険料: ["INSURANCE"],
  送金手数料: ["REMITTANCE_FEE"],
  為替差損: ["FX_LOSS"],
  ロイヤリティ: ["ROYALTY"],
  撮影費: ["PHOTOGRAPHY_FEE"],
  デザイン費: ["DESIGN_FEE"],
  レンタル費: ["RENTAL_FEE"],
  その他諸経費: ["OTHER_OVERHEAD"],
}
