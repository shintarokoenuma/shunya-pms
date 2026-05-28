/**
 * Phase 1A-15: MaterialCategory カテゴリコード サジェスト
 *
 * 入力された日本語のカテゴリ名（および選択中の親カテゴリコード）から、
 * categoryCode の候補を最大 3 件まで返す。
 *
 * Phase 1A-14 ProductCategory のサジェスト実装と同じ構造だが、
 * 辞書は素材分類用の独自セット（大分類 / 素材名 / 規格・加工 / 副資材材質）。
 *
 * (i)  辞書ベースで日本語 → 英字候補を返す
 * (ii) 親カテゴリが選択されていれば、親 code + "-" + 候補 を組み合わせる
 *
 * 辞書ヒットなしの場合は空配列（ライブラリ非依存）。
 */

type DictEntry = readonly string[]

/**
 * 素材分類用の辞書（初期 ~50 語）。
 * key は trim 済み日本語、value は推奨される英字候補（優先順）。
 */
export const MATERIAL_TERM_DICT: Record<string, DictEntry> = {
  // 大分類
  表地: ["FABRIC", "OUTER"],
  裏地: ["LINING"],
  芯地: ["INTERLINING"],
  副資材: ["ACCESSORY"],
  ファスナー: ["ZIPPER", "FASTENER"],
  ボタン: ["BUTTON"],
  糸: ["THREAD"],
  ゴム: ["ELASTIC"],
  テープ: ["TAPE"],
  ネーム: ["LABEL"],
  下げ札: ["HANG_TAG", "HANGTAG"],
  品質表示: ["CARE_LABEL"],
  袋: ["PACKAGING_BAG"],
  ポリ袋: ["POLYBAG"],
  箱: ["BOX"],

  // 素材名（中分類想定）
  コットン: ["COTTON"],
  ウール: ["WOOL"],
  シルク: ["SILK"],
  リネン: ["LINEN"],
  ポリエステル: ["POLYESTER", "POLY"],
  ナイロン: ["NYLON"],
  レーヨン: ["RAYON"],
  アクリル: ["ACRYLIC"],
  カシミヤ: ["CASHMERE"],
  キュプラ: ["CUPRO"],
  モヘア: ["MOHAIR"],
  スパンデックス: ["SPANDEX"],
  デニム: ["DENIM"],
  レザー: ["LEATHER"],
  スウェード: ["SUEDE"],

  // 規格・加工（小分類想定）
  ポプリン: ["POPLIN"],
  ツイル: ["TWILL"],
  ガーゼ: ["GAUZE"],
  シャンブレー: ["CHAMBRAY"],
  オックス: ["OXFORD"],
  サテン: ["SATIN"],
  ジャージー: ["JERSEY"],
  プリント: ["PRINT"],
  染色: ["DYED"],
  起毛: ["BRUSHED"],
  防水: ["WATERPROOF"],
  撥水: ["WATER_REPELLENT"],
  オーガニック: ["ORGANIC"],

  // 副資材材質（小分類想定）
  金属: ["METAL"],
  プラスチック: ["PLASTIC"],
  樹脂: ["RESIN"],
  木: ["WOOD"],
  シェル: ["SHELL"],
  水牛: ["BUFFALO"],
}

export type MaterialCategoryCodeSuggestion = {
  value: string
  source: "dict" | "parent-dict"
}

/**
 * 入力 categoryName と（あれば）親 categoryCode から候補を生成。
 * 最大 maxResults（既定 3）件まで返す。重複は除外。
 */
export function suggestMaterialCategoryCode(
  categoryName: string,
  parentCategoryCode: string | null | undefined,
  maxResults = 3,
): MaterialCategoryCodeSuggestion[] {
  const trimmed = categoryName.trim()
  if (trimmed.length === 0) return []

  const parent = parentCategoryCode?.trim() ?? ""
  const dictHits = MATERIAL_TERM_DICT[trimmed] ?? []

  const results: MaterialCategoryCodeSuggestion[] = []
  const seen = new Set<string>()

  // (ii) 親 + 辞書
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
