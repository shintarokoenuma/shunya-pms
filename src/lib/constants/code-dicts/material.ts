import type { DictEntry } from "@/lib/utils/code-suggest"

/**
 * Phase 1A-17: MaterialCategory (素材分類) のコード辞書
 *
 * Phase 1A-15 で `src/lib/utils/material-category-code-suggest.ts` 内に定義していた
 * MATERIAL_TERM_DICT をここに移設。Phase 1A-17 で §4.2 の追加語彙を反映。
 *
 * key は trim 済み日本語、value は推奨される英字候補 (優先順)。
 */
export const MATERIAL_TERM_DICT: Record<string, DictEntry> = {
  // ────────── 大分類 ──────────
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

  // ────────── 素材名 (中分類想定) ──────────
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
  // Phase 1A-17 追加
  麻: ["HEMP"],
  テンセル: ["TENCEL"],
  リヨセル: ["LYOCELL"],
  モダール: ["MODAL"],
  アセテート: ["ACETATE"],
  ポリウレタン: ["POLYURETHANE"],
  コーデュロイ: ["CORDUROY"],
  ベロア: ["VELOUR"],
  ベルベット: ["VELVET"],
  ツイード: ["TWEED"],
  フランネル: ["FLANNEL"],
  シフォン: ["CHIFFON"],
  チュール: ["TULLE"],
  メッシュ: ["MESH"],
  レース: ["LACE"],

  // ────────── 規格・加工 (小分類想定) ──────────
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
  // Phase 1A-17 追加
  ヘリンボーン: ["HERRINGBONE"],
  ギンガム: ["GINGHAM"],
  ストライプ: ["STRIPE"],
  ボーダー: ["BORDER"],
  チェック: ["CHECK"],
  リブ: ["RIB"],
  天竺: ["PLAIN_KNIT"],
  裏毛: ["FRENCH_TERRY"],
  ワッフル: ["WAFFLE"],

  // ────────── 副資材材質 (小分類想定) ──────────
  金属: ["METAL"],
  プラスチック: ["PLASTIC"],
  樹脂: ["RESIN"],
  木: ["WOOD"],
  シェル: ["SHELL"],
  水牛: ["BUFFALO"],
  // Phase 1A-17 追加
  スナップ: ["SNAP"],
  ホック: ["HOOK"],
  アイレット: ["EYELET"],
  リベット: ["RIVET"],
  バックル: ["BUCKLE"],
  Dカン: ["D_RING"],
  面ファスナー: ["HOOK_AND_LOOP"],
  肩パッド: ["SHOULDER_PAD"],
}
