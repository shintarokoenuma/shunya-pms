import type { DictEntry } from "@/lib/utils/code-suggest"

/**
 * Phase 1A-17: ProductCategory (アパレル分類) のコード辞書
 *
 * Phase 1A-14 で `src/lib/utils/category-code-suggest.ts` 内に定義していた
 * APPAREL_TERM_DICT をここに移設。Phase 1A-17 で §4.1 の追加語彙を反映。
 *
 * key は trim 済み日本語、value は推奨される英字候補 (優先順)。
 * 候補は最大 3 件まで使われるため、3 件以内で重要なものから並べる。
 */
export const APPAREL_TERM_DICT: Record<string, DictEntry> = {
  // ────────── 性別 / 年齢層 ──────────
  レディース: ["LADIES", "WOMENS", "WOMEN"],
  メンズ: ["MENS", "MEN"],
  キッズ: ["KIDS", "CHILDREN"],
  ベビー: ["BABY", "INFANT"],
  ユニセックス: ["UNISEX"],

  // ────────── 大分類 (カテゴリ) ──────────
  トップス: ["TOPS"],
  ボトムス: ["BOTTOMS"],
  アウター: ["OUTER", "OUTERWEAR"],
  インナー: ["INNER", "INNERWEAR"],
  ワンピース: ["DRESS", "ONEPIECE"],
  ドレス: ["DRESS"],
  スーツ: ["SUIT"],
  セットアップ: ["SETUP"],
  // Phase 1A-17 追加
  水着: ["SWIMWEAR"],
  ルームウェア: ["LOUNGEWEAR"],
  スポーツウェア: ["ACTIVEWEAR"],
  フォーマル: ["FORMAL"],
  オールインワン: ["ALLINONE"],
  サロペット: ["OVERALLS"],
  つなぎ: ["JUMPSUIT"],

  // ────────── トップス系 ──────────
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
  // Phase 1A-17 追加
  キャミソール: ["CAMISOLE"],
  チュニック: ["TUNIC"],
  ボディスーツ: ["BODYSUIT"],

  // ────────── ボトムス系 ──────────
  パンツ: ["PANTS"],
  ジーンズ: ["JEANS", "DENIM"],
  デニム: ["DENIM", "JEANS"],
  スカート: ["SKIRT"],
  ショートパンツ: ["SHORTS"],
  ハーフパンツ: ["HALFPANTS", "SHORTS"],
  レギンス: ["LEGGINGS"],
  // Phase 1A-17 追加
  チノパン: ["CHINO"],
  スラックス: ["SLACKS"],
  カーゴパンツ: ["CARGO"],
  ジョガーパンツ: ["JOGGER"],
  ワイドパンツ: ["WIDE"],
  ガウチョ: ["GAUCHO"],
  キュロット: ["CULOTTE"],

  // ────────── アウター系 ──────────
  ジャケット: ["JACKET"],
  コート: ["COAT"],
  ブルゾン: ["BLOUSON"],
  ダウン: ["DOWN"],
  トレンチコート: ["TRENCH"],
  ピーコート: ["PEACOAT"],
  モッズコート: ["MODSCOAT"],
  // Phase 1A-17 追加
  ステンカラーコート: ["BALMACAAN"],
  ダッフルコート: ["DUFFLE"],
  マウンテンパーカ: ["MOUNTAIN_PARKA"],
  フリース: ["FLEECE"],
  レインコート: ["RAINCOAT"],
  ポンチョ: ["PONCHO"],

  // ────────── インナー / 下着 ──────────
  下着: ["UNDERWEAR"],
  靴下: ["SOCKS"],
  ソックス: ["SOCKS"],
  タイツ: ["TIGHTS"],

  // ────────── 小物 / その他 ──────────
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
  // Phase 1A-17 追加 (靴)
  スニーカー: ["SNEAKER"],
  ブーツ: ["BOOTS"],
  サンダル: ["SANDAL"],
  パンプス: ["PUMPS"],
  ローファー: ["LOAFER"],
  // Phase 1A-17 追加 (バッグ・小物)
  トートバッグ: ["TOTE"],
  リュック: ["BACKPACK"],
  ショルダーバッグ: ["SHOULDER"],
  ポーチ: ["POUCH"],
  財布: ["WALLET"],
  サングラス: ["SUNGLASSES"],
}
