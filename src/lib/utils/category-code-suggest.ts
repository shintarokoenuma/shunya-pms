/**
 * Phase 1A-14: ProductCategory カテゴリコード サジェスト
 *
 * 入力された日本語のカテゴリ名（および選択中の親カテゴリコード）から、
 * categoryCode の候補を最大 3 件まで返す。
 *
 * 採用ロジック：
 * (i)  アパレル業界の主要用語の辞書ベースで日本語 → 英字候補を返す
 * (ii) 親カテゴリが選択されていれば、親 code + "-" + 候補 を組み合わせる
 *
 * 辞書にない場合：
 * - 候補を空にする（ユーザーが手で入力）。kana → romaji の自動変換は
 *   ライブラリ依存を増やすため Phase 1A-14 では採用しない。
 *   将来辞書を拡充するか、wanakana/kuroshiro 連携で対応する。
 */

type DictEntry = readonly string[]

/**
 * 主要なアパレル用語の辞書。
 * key は trim 済み日本語、value は推奨される英字候補（優先順）。
 * 候補は最大 3 件まで使われるため、3 件以内で重要なものから並べる。
 */
export const APPAREL_TERM_DICT: Record<string, DictEntry> = {
  // 性別 / 年齢層
  レディース: ["LADIES", "WOMENS", "WOMEN"],
  メンズ: ["MENS", "MEN"],
  キッズ: ["KIDS", "CHILDREN"],
  ベビー: ["BABY", "INFANT"],
  ユニセックス: ["UNISEX"],

  // 大分類（カテゴリ）
  トップス: ["TOPS"],
  ボトムス: ["BOTTOMS"],
  アウター: ["OUTER", "OUTERWEAR"],
  インナー: ["INNER", "INNERWEAR"],
  ワンピース: ["DRESS", "ONEPIECE"],
  ドレス: ["DRESS"],
  スーツ: ["SUIT"],
  セットアップ: ["SETUP"],

  // トップス系
  Tシャツ: ["TSHIRT", "T-SHIRT", "TEE"],
  シャツ: ["SHIRT"],
  ブラウス: ["BLOUSE"],
  ニット: ["KNIT"],
  セーター: ["SWEATER"],
  カーディガン: ["CARDIGAN"],
  パーカー: ["HOODIE", "PARKA"],
  スウェット: ["SWEAT"],
  ポロシャツ: ["POLO"],
  タンクトップ: ["TANK", "TANKTOP"],
  ベスト: ["VEST"],

  // ボトムス系
  パンツ: ["PANTS"],
  ジーンズ: ["JEANS", "DENIM"],
  デニム: ["DENIM", "JEANS"],
  スカート: ["SKIRT"],
  ショートパンツ: ["SHORTS"],
  ハーフパンツ: ["HALFPANTS", "SHORTS"],
  レギンス: ["LEGGINGS"],

  // アウター系
  ジャケット: ["JACKET"],
  コート: ["COAT"],
  ブルゾン: ["BLOUSON"],
  ダウン: ["DOWN"],
  トレンチコート: ["TRENCH"],
  ピーコート: ["PEACOAT"],
  モッズコート: ["MODSCOAT"],

  // インナー / 下着
  下着: ["UNDERWEAR"],
  靴下: ["SOCKS"],
  ソックス: ["SOCKS"],
  タイツ: ["TIGHTS"],

  // 小物 / その他
  バッグ: ["BAG"],
  鞄: ["BAG"],
  シューズ: ["SHOES"],
  靴: ["SHOES"],
  帽子: ["HAT", "CAP"],
  キャップ: ["CAP"],
  ハット: ["HAT"],
  マフラー: ["MUFFLER", "SCARF"],
  スカーフ: ["SCARF"],
  手袋: ["GLOVES"],
  グローブ: ["GLOVES"],
  ベルト: ["BELT"],
  ネクタイ: ["TIE"],
}

export type CategoryCodeSuggestion = {
  /** 表示用ラベル（候補そのもの） */
  value: string
  /** 由来の説明（"辞書"・"親 + 辞書" など） */
  source: "dict" | "parent-dict"
}

/**
 * 入力 categoryName と（あれば）親 categoryCode から候補を生成。
 * 最大 maxResults（既定 3）件まで返す。重複は除外。
 */
export function suggestCategoryCode(
  categoryName: string,
  parentCategoryCode: string | null | undefined,
  maxResults = 3,
): CategoryCodeSuggestion[] {
  const trimmed = categoryName.trim()
  if (trimmed.length === 0) return []

  const parent = parentCategoryCode?.trim() ?? ""
  const dictHits = APPAREL_TERM_DICT[trimmed] ?? []

  const results: CategoryCodeSuggestion[] = []
  const seen = new Set<string>()

  // (ii) 親 + 辞書（親が選ばれている時は優先）
  if (parent !== "") {
    for (const term of dictHits) {
      const code = `${parent}-${term}`.toUpperCase()
      if (!seen.has(code)) {
        seen.add(code)
        results.push({ value: code, source: "parent-dict" })
      }
    }
  }

  // (i) 辞書のみ
  for (const term of dictHits) {
    const code = term.toUpperCase()
    if (!seen.has(code)) {
      seen.add(code)
      results.push({ value: code, source: "dict" })
    }
  }

  return results.slice(0, maxResults)
}
