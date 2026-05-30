# Phase 1A-17 実装指示書: コードサジェスト共通化 + 入力順統一（Claude Code 向け）

**対象リポジトリ**: `shunya-production-system`
**作成**: 2026-05-31 / Claude.ai セッション
**スコープ**: ①サジェスト共通化（B-007 回収）②CostCategory にサジェスト追加 ③全マスター入力順「名前先頭」統一 ④辞書増補 ⑤master-patterns 更新

---

## 0. 重要な前提（着手前に必ず確認）

- **環境**: 本タスクは UI / utility / 辞書のコード変更が中心で、**DB マイグレーション・シードは無し**（CostCategory のスキーマは 1A-16 で投入済み）。dev での `npm run dev` 目視確認のみ。
- **着手前**: `git checkout main && git pull origin main`、HEAD が `b1fb10a`（1A-16）であることを確認。ブランチ `feat/phase1a-17-code-suggest-unify` を作成。
- **1A-16 本番反映はこの PR マージ後**にまとめて行う（本タスクでは本番に触れない）。

---

## 1. サジェスト共通化（B-007 回収）

### 1.1 汎用 utility 新設

`src/lib/utils/code-suggest.ts` を新規作成。既存 2 ファイルの関数本体は辞書名以外同一なので、辞書を引数化した汎用関数に畳む。

```typescript
type DictEntry = readonly string[]
export type CodeSuggestion = { value: string; source: "dict" | "parent-dict" }

export function suggestCodeFromName(
  name: string,
  parentCode: string | null | undefined,
  dict: Record<string, DictEntry>,
  maxResults = 3,
): CodeSuggestion[] {
  const trimmed = name.trim()
  if (trimmed.length === 0) return []
  const parent = parentCode?.trim() ?? ""
  const dictHits = dict[trimmed] ?? []
  const results: CodeSuggestion[] = []
  const seen = new Set<string>()
  if (parent !== "") {
    for (const term of dictHits) {
      const code = `${parent}-${term}`.toUpperCase()
      if (!seen.has(code)) { seen.add(code); results.push({ value: code, source: "parent-dict" }) }
    }
  }
  for (const term of dictHits) {
    const code = term.toUpperCase()
    if (!seen.has(code)) { seen.add(code); results.push({ value: code, source: "dict" }) }
  }
  return results.slice(0, maxResults)
}
```

### 1.2 辞書をドメイン別に分離

辞書定義を `src/lib/constants/code-dicts/` 配下に移設・分離。
- `apparel.ts` … 既存 `APPAREL_TERM_DICT`（+ §4 の追加語彙）
- `material.ts` … 既存 `MATERIAL_TERM_DICT`（+ §4 の追加語彙）
- `cost.ts` … 新規 `COST_TERM_DICT`（§3）

### 1.3 旧 utility の扱い

`category-code-suggest.ts` / `material-category-code-suggest.ts` は、中身を汎用関数 + 辞書 import に置き換えるか、`suggestCodeFromName` への薄い re-export にして**後方互換を保ったまま**削減（呼び出し側のリグレッションを避けるため一気に消さず段階移行で可）。

### 1.4 UI の共通化

`category-code-suggester.tsx`（Product）と `material-category-code-suggester.tsx`（Material）を、汎用 `src/components/code-suggester.tsx`（仮）1 つに統合。
- props: `name: string` / `parentCode: string | null` / `dict: Record<string, readonly string[]>` / `onSelect: (code: string) => void`
- 内部で `suggestCodeFromName` を呼び、候補チップを描画。`name` 空 or 候補 0 件のときは何も出さない（現状挙動を踏襲）。
- ※ §1（A・B）の調査結果（既存サジェスター UI の描画・親コード受け渡し方法、全フォームの現状入力順）を反映して props と並べ替え対象を確定すること。

---

## 2. 入力順「名前先頭」統一（全マスター）

全マスターフォームの基本情報カードで、**名称（categoryName / <master>Name）を先頭、コードを次**に並べ替える。
- **カテゴリ系（商品・素材・原価費目）**: 名前 → コード（直下に共通サジェスター）。Material は既にこの順なので確認のみ。
- **連絡先系（クライアント・仕入先・工場・外注先・納品先・型番ほか）**: 名前 → コードに並べ替え。**サジェスターは付けない**（コードは手入力。採番ルール尊重）。
- 並べ替え対象の具体ファイルは §1-A の grep 結果（コードが先になっているフォーム）で確定する。

---

## 3. CostCategory サジェスト追加 + 辞書（COST_TERM_DICT）

`cost-category-form.tsx` の入力順を「コード → 名前」から「名前 → コード」に逆転し、共通 `<CodeSuggester dict={COST_TERM_DICT} ... />` をコード欄直下に配置。予約行（isSystemReserved）の編集制限はそのまま維持（サジェスターは新規 Lv2 作成時のみ意味を持つ）。

`COST_TERM_DICT`（ブリーフ 1A-16 §4.2 の全 Lv2 語彙を機械的に辞書化 + 表記揺れ数語）:

```typescript
export const COST_TERM_DICT: Record<string, readonly string[]> = {
  // MATERIAL 配下
  本体生地: ["MAIN_FABRIC"], 裏地: ["LINING"], 芯地: ["INTERLINING"],
  ファスナー: ["ZIPPER"], ボタン: ["BUTTON"], 糸: ["THREAD"],
  その他副資材: ["ACCESSORY"], "ラベル・ネーム類": ["LABEL"], 包装材: ["PACKAGING"], 梱包: ["PACKAGING"],
  // SEWING 配下
  通常縫製: ["REGULAR_SEWING"], 縫製: ["REGULAR_SEWING"], 特殊縫製: ["SPECIAL_SEWING"], 仕上げ: ["FINISHING"],
  // PROCESSING 配下
  プリント: ["PRINTING"], 刺繍: ["EMBROIDERY"], 洗い加工: ["WASHING"], 染色: ["DYEING"], 特殊加工: ["SPECIAL_PROCESSING"],
  // OVERHEAD 配下
  パターン代: ["PATTERN_FEE"], グレーディング代: ["GRADING_FEE"], サンプル製作費: ["SAMPLE_FEE"],
  検品費: ["INSPECTION_FEE"], 国内輸送費: ["DOMESTIC_TRANSPORT"], 国際輸送費: ["INTERNATIONAL_TRANSPORT"],
  通関費: ["CUSTOMS_FEE"], 関税: ["TARIFF"], 輸入消費税: ["IMPORT_TAX"], 保管費: ["STORAGE_FEE"],
  保険料: ["INSURANCE"], 送金手数料: ["REMITTANCE_FEE"], 為替差損: ["FX_LOSS"], ロイヤリティ: ["ROYALTY"],
  撮影費: ["PHOTOGRAPHY_FEE"], デザイン費: ["DESIGN_FEE"], レンタル費: ["RENTAL_FEE"], その他諸経費: ["OTHER_OVERHEAD"],
}
```

---

## 4. 辞書増補（apparel / material）

### 4.1 APPAREL_TERM_DICT 追加

```typescript
// 大分類
水着: ["SWIMWEAR"], ルームウェア: ["LOUNGEWEAR"], スポーツウェア: ["ACTIVEWEAR"],
フォーマル: ["FORMAL"], オールインワン: ["ALLINONE"], サロペット: ["OVERALLS"], つなぎ: ["JUMPSUIT"],
// トップス
キャミソール: ["CAMISOLE"], チュニック: ["TUNIC"], ボディスーツ: ["BODYSUIT"],
// ボトムス
チノパン: ["CHINO"], スラックス: ["SLACKS"], カーゴパンツ: ["CARGO"], ジョガーパンツ: ["JOGGER"],
ワイドパンツ: ["WIDE"], ガウチョ: ["GAUCHO"], キュロット: ["CULOTTE"],
// アウター
ステンカラーコート: ["BALMACAAN"], ダッフルコート: ["DUFFLE"], マウンテンパーカ: ["MOUNTAIN_PARKA"],
フリース: ["FLEECE"], レインコート: ["RAINCOAT"], ポンチョ: ["PONCHO"],
// 靴
スニーカー: ["SNEAKER"], ブーツ: ["BOOTS"], サンダル: ["SANDAL"], パンプス: ["PUMPS"], ローファー: ["LOAFER"],
// バッグ・小物
トートバッグ: ["TOTE"], リュック: ["BACKPACK"], ショルダーバッグ: ["SHOULDER"],
ポーチ: ["POUCH"], 財布: ["WALLET"], サングラス: ["SUNGLASSES"],
```

### 4.2 MATERIAL_TERM_DICT 追加

```typescript
// 素材名
麻: ["HEMP"], テンセル: ["TENCEL"], リヨセル: ["LYOCELL"], モダール: ["MODAL"], アセテート: ["ACETATE"],
ポリウレタン: ["POLYURETHANE"], コーデュロイ: ["CORDUROY"], ベロア: ["VELOUR"], ベルベット: ["VELVET"],
ツイード: ["TWEED"], フランネル: ["FLANNEL"], シフォン: ["CHIFFON"], チュール: ["TULLE"], メッシュ: ["MESH"], レース: ["LACE"],
// 規格・加工
ヘリンボーン: ["HERRINGBONE"], ギンガム: ["GINGHAM"], ストライプ: ["STRIPE"], ボーダー: ["BORDER"],
チェック: ["CHECK"], リブ: ["RIB"], 天竺: ["PLAIN_KNIT"], 裏毛: ["FRENCH_TERRY"], ワッフル: ["WAFFLE"],
// 副資材
スナップ: ["SNAP"], ホック: ["HOOK"], アイレット: ["EYELET"], リベット: ["RIVET"], バックル: ["BUCKLE"],
Dカン: ["D_RING"], 面ファスナー: ["HOOK_AND_LOOP"], 肩パッド: ["SHOULDER_PAD"],
```

> 既存キーと重複しないこと（追加前に既存辞書を確認）。`toUpperCase()` を通すので value は大文字英数 + アンダースコアで統一。

---

## 5. master-patterns 更新（B-007 クローズ）

`shunya-master-patterns.md` に追記:
- 「マスターフォームの基本情報は **名称を先頭、コードを次** に置く」を標準化（§9 フォーム構成）
- 「カテゴリ系マスターは `suggestCodeFromName` + ドメイン辞書 + 共通 `<CodeSuggester>` でコード候補を提示。連絡先系はコード手入力」を新パターンとして明記
- 改訂履歴に v1.1 を追加。バックログ B-007 を「Phase 1A-17 で回収済み」にクローズ

---

## 6. 動作確認（dev、localhost）

- [ ] `npm run build` 0 errors / tsc clean
- [ ] 商品・素材カテゴリ: 既存サジェストがリグレッションなく動く（共通化後）
- [ ] 原価費目: 新規 Lv2 作成で、名前「本体生地」入力 → `MAIN_FABRIC`（親選択時は `MATERIAL-MAIN_FABRIC`）が候補に出る
- [ ] 辞書未収録語で候補 0・コード手入力に支障なし
- [ ] 全マスターフォームで名称が先頭に来ている（連絡先系はサジェスター無し）
- [ ] 増補語が数件サジェストに出る（例: スニーカー→SNEAKER、麻→HEMP）

---

## 7. PR

- ブランチ: `feat/phase1a-17-code-suggest-unify`
- タイトル: `feat: Phase 1A-17 コードサジェスト共通化 + 入力順統一（B-007 回収・CostCategory サジェスト追加）`
- 本文: スコープ（案 2: 入力順は全マスター名前先頭 / サジェストはカテゴリ系のみ）/ B-007 回収 / dev 確認済みの旨
- マージ: Squash and merge
