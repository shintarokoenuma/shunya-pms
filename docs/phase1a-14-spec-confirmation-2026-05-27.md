# Phase 1A-14 ProductCategory（商品カテゴリマスター）仕様確定議事録

**作成日**: 2026 年 5 月 27 日
**作成者**: Shin（肥沼慎太郎） + Claude
**バージョン**: v1.0
**ステータス**: 確定（実装着手可能）

---

## 1. 目的

shunya 生産管理システム Phase 1A-14 にあたる ProductCategory（商品カテゴリマスター）の実装仕様を確定する。

ProductCategory は ModelCode の categoryId 参照先として既存スキーマに定義済みだが、Phase 1A-12 ModelCode 実装時には未実装のため Select が disabled となっていた。本フェーズで実装することで、ModelCode の Category Select を有効化する。

業界実務的にアパレル商品のカテゴリは「大分類 / 中分類 / 小分類」の 3 階層で管理されることが多く、本実装でもこの階層構造を採用する。

---

## 2. 確定事項サマリー

| # | 論点 | 確定内容 |
|---|---|---|
| A-1 | 階層深さ | **3 階層まで**（parent.parent.parentCategoryId === null をバリデーション） |
| A-2 | ステータス値 | **2 値**（ACTIVE / ARCHIVED）、Buyer/DD パターン |
| A-3 | 採番方式 | **手動入力 + サジェスト** |
| A-3.1 | サジェスト方式 | (i) 日本語名 → ローマ字変換 + (ii) parent code からの派生 |
| D-1 | 階層表示 | **パンくず表示 + フラットテーブル**（レディース > トップス > Tシャツ） |
| D-2 | カード構成 | **3 カード**（基本情報 / 階層 / ステータス） |
| D-3 | 一覧フィルタ | **3 軸**（キーワード + parent + Status） |
| D-4 | ModelCode 連携 | Phase 1A-14 完了時に ModelCode の Category Select を有効化 |

---

## 3. 論点 A: 実装方針

### A-1: 階層深さ 3 階層まで

アパレル業界の商品分類標準に倣う。

```
Lv1: レディース / メンズ / キッズ                (大分類)
  └─ Lv2: トップス / ボトムス / アウター        (中分類)
       └─ Lv3: Tシャツ / シャツ / ブラウス      (小分類)
```

バリデーション:
- parent が Lv3（parentCategoryId が 2 階層上まで遡れる）の場合、子の作成を拒否
- 実装は `parent.parent.parentCategoryId !== null` のチェック

### A-2: ステータス値 2 値

```prisma
enum ProductCategoryStatus {
  ACTIVE
  ARCHIVED
}
```

Buyer/DD と同じ構成。理由: カテゴリは商品をグルーピングする箱であり、廃番という概念が薄い。

### A-3: 採番方式 - 手動入力 + サジェスト

#### A-3.1: サジェスト方式

**(i) + (ii) の組み合わせ** を採用。

**(i) 日本語名 → ローマ字変換**

```
categoryName 入力: "レディース"
  ↓ サジェスト表示
"LADIES"
"LADIES_WEAR"
"WOMENS"
```

実装:
- 主要なアパレル用語の辞書を用意（数十語程度）
  - レディース → LADIES / WOMENS
  - メンズ → MENS
  - トップス → TOPS
  - ボトムス → BOTTOMS
  - Tシャツ → TSHIRT / T-SHIRT
  - シャツ → SHIRT
  - ブラウス → BLOUSE
  - パンツ → PANTS
  - スカート → SKIRT
  - ジャケット → JACKET
  - コート → COAT
  - その他...
- 辞書にない場合は wanakana や kuroshiro 等のローマ字変換ライブラリでフォールバック
- 候補は最大 3 件表示

**(ii) parent の code からの派生**

```
parent 選択: "LADIES (レディース)"
  ↓ サジェスト表示（categoryName: "トップス" 入力時）
"LADIES-TOPS"
"LADIES_TOPS"
```

実装:
- parent が選択されている時、サジェストに parent の categoryCode + `-` + (i) の候補 を組み合わせて表示
- ユーザーは候補から選択するか、自由入力で上書き可能

#### 採番バリデーション

- categoryCode: 1〜50 文字、英数字 + ハイフン + アンダースコア（`^[A-Z0-9_\-]+$`）
- `@@unique([companyId, categoryCode])` で重複防止
- 大文字推奨（辞書も大文字で登録）、入力時に小文字 → 大文字に自動変換

---

## 4. 論点 D: UI 設計

### D-1: 階層表示方法 - パンくず + フラットテーブル

```
一覧画面:
┌──────────────────┬────────────────────────────┬──────────┐
│ コード            │ カテゴリ階層                │ ステータス│
├──────────────────┼────────────────────────────┼──────────┤
│ LADIES           │ レディース                  │ 稼働中   │
│ MENS             │ メンズ                      │ 稼働中   │
│ LADIES-TOPS      │ レディース > トップス        │ 稼働中   │
│ MENS-TOPS        │ メンズ > トップス            │ 稼働中   │
│ LADIES-TOPS-TSHIRT │ レディース > トップス > Tシャツ │ 稼働中 │
└──────────────────┴────────────────────────────┴──────────┘
```

理由:
- ツリー表示は美しいが、ソート / フィルタが効きにくい
- パンくずなら一目で階層関係が分かる
- Lv で行高さを変えない（フラット）ため、視認性が高い

ソート: categoryCode の昇順（parent + child が自然にグループ化される）

### D-2: カード構成（3 カード）

```
カード 1: 基本情報
├─ categoryCode（手動入力 + サジェスト、必須）
│   - サジェストの表示位置: 入力欄の下にドロップダウン
│   - サジェストのトリガー: parent 選択時 + categoryName 入力時
├─ categoryName（必須）
└─ categoryNameEn

カード 2: 階層
└─ parentCategoryId（Select、optional）
  - 「（なし - 大分類）」「レディース (LADIES) - Lv1」「レディース > トップス (LADIES-TOPS) - Lv2」のように選択肢を階層付き表示
  - Lv3 のカテゴリは選択肢に出さない（子カテゴリは作れない）
  - 編集時、自身を parent に選択不可

カード 3: ステータス
└─ status（2 値 Select）
```

### D-3: 一覧画面のフィルタ（3 軸）

- キーワード検索: categoryCode / categoryName / categoryNameEn の部分一致
- parent フィルタ: ALL / 各 parent カテゴリ（階層パンくず表示）
- Status フィルタ: ALL / ACTIVE / ARCHIVED

### D-4: ModelCode との連携

Phase 1A-14 の最後のコミット（または別 PR）で以下を実装:

- ModelCode フォームの Category Select の disabled を解除
- listActiveProductCategoriesForSelect ヘルパーを実装
- ModelCode フォームから呼び出し、Select に選択肢を populate
- ヘルプテキストの更新: 「商品カテゴリマスター実装後に選択可能」→ 削除

---

## 5. データモデル（既存スキーマの確認）

既存スキーマで ProductCategory モデルがどう定義されているか確認し、必要なら status enum を追加する。

想定スキーマ（確認後に確定）:

```prisma
model ProductCategory {
  id                String   @id @default(uuid())
  companyId         String   @map("company_id")
  categoryCode      String   @map("category_code") @db.VarChar(50)
  categoryName      String   @map("category_name") @db.VarChar(255)
  categoryNameEn    String?  @map("category_name_en") @db.VarChar(255)
  parentCategoryId  String?  @map("parent_category_id")
  status            ProductCategoryStatus @default(ACTIVE)  // 新規追加 or 型変更
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")

  parent            ProductCategory?  @relation("ProductCategoryHierarchy", fields: [parentCategoryId], references: [id])
  children          ProductCategory[] @relation("ProductCategoryHierarchy")
  modelCodes        ModelCode[]
  products          Product[]

  @@unique([companyId, categoryCode])
  @@index([companyId, parentCategoryId])
  @@index([companyId, status])
  @@map("product_categories")
}

enum ProductCategoryStatus {
  ACTIVE
  ARCHIVED
}
```

実装時に既存スキーマを確認し、不足があれば migration を追加。

---

## 6. 実装手順（master-patterns v1.2 準拠）

### Phase 1: スキーマ確認 & 必要なら変更

1. `prisma/schema.prisma` の ProductCategory モデルを確認
2. status が未定義または String 型なら ProductCategoryStatus enum を追加
3. 必要なら `npx prisma migrate dev --name add_product_category_status_enum`

### Phase 2: 論理層 + サジェストロジック

- `src/lib/validators/product-category.ts` 作成
  - categoryCode の正規表現 `^[A-Z0-9_\-]+$`
  - categoryName 必須、parentCategoryId optional
  - 階層深さチェック（parent.parent.parentCategoryId === null をクライアント側 + actions 側両方で）
- `src/app/(app)/product-categories/_components/labels.ts` 作成
  - PRODUCT_CATEGORY_STATUS_LABELS / _OPTIONS / _BADGE_VARIANT（2 値）
- `src/lib/utils/category-code-suggest.ts` 作成
  - アパレル用語辞書（数十語）
  - `suggestCategoryCode(categoryName, parentCategoryCode?)` 関数
  - 日本語 → ローマ字変換ロジック
- `src/lib/actions/product-categories.ts` 作成（8 関数 + 2 ヘルパー）
  - list / get / create / update / archive / restore / checkUsage / deletePermanently
  - `listAllActiveProductCategoriesForSelect()` ヘルパー（parent Select 用、階層情報付き）
  - `buildCategoryBreadcrumb(categoryId)` ヘルパー（パンくず生成）

### Phase 3: UI

- `_components/product-category-form.tsx`（3 カードフォーム、サジェスト機能付き）
- `_components/product-category-delete-button.tsx`
- `_components/product-categories-table.tsx`（パンくず表示）
- `_components/product-categories-search.tsx`（3 軸フィルタ）
- `_components/product-categories-pagination.tsx`
- `_components/category-code-suggest-input.tsx`（サジェスト UI コンポーネント）
- `page.tsx` / `new/page.tsx` / `[id]/page.tsx` / `[id]/edit/page.tsx`
- ナビゲーション（`nav-items.ts`）への追加（「商品カテゴリ」エントリ）

### Phase 4: ModelCode 連携

- ModelCode のフォームで Category Select を有効化
- listAllActiveProductCategoriesForSelect を ModelCode フォームから呼び出し
- ヘルプテキスト「商品カテゴリマスター実装後に選択可能」を削除

### Phase 5: PR & デプロイ

- 4 コミット構成
  - Commit 1: schema（必要なら）
  - Commit 2: 論理層 + サジェストロジック + 議事録
  - Commit 3: UI components + 4 pages + nav
  - Commit 4: ModelCode 連携
- PR タイトル: `feat(phase1a-14): 商品カテゴリマスター（階層 3 段 + コードサジェスト）`
- PR 作成、動作確認、マージ、Railway 自動デプロイ

---

## 7. 動作確認チェックリスト

### master-patterns §11 標準 7 項目

- [ ] 新規作成
- [ ] 詳細表示
- [ ] 一覧表示（3 軸フィルタ動作確認）
- [ ] 編集
- [ ] アーカイブ
- [ ] 復元
- [ ] 物理削除（MASTER_ADMIN、ARCHIVED、名前一致、紐付き 0 件）

### Phase 1A-14 固有

- [ ] 階層作成: Lv1（parent なし）→ Lv2（parent=Lv1）→ Lv3（parent=Lv2）が作成できる
- [ ] 階層深さ制限: Lv3 を parent に選んで Lv4 を作成しようとするとエラー
- [ ] サジェスト(i): categoryName に「レディース」入力 → categoryCode 欄に LADIES などの候補表示
- [ ] サジェスト(ii): parent に LADIES を選び、categoryName に「トップス」入力 → LADIES-TOPS などの候補表示
- [ ] パンくず表示: 一覧で「レディース > トップス > Tシャツ」のように階層が表示される
- [ ] 自己参照防止: 編集画面で自身を parent に選べない
- [ ] ModelCode 連携: ModelCode 編集画面で Category Select が enabled になり、選択肢が表示される
- [ ] 紐付き確認: Category に紐づく ModelCode / Product があれば物理削除で警告

---

## 8. Phase 1B 以降のフォローアップ項目

### 8.1 Material との連携

将来 MaterialCategory も同様の階層マスターとして実装する。本フェーズで作るサジェストロジックと階層 UI コンポーネントは MaterialCategory でも再利用可能（precedent として活用）。

### 8.2 商品分類のサジェスト辞書拡充

アパレル業界の用語を追加していく。初期は数十語、運用で徐々に増やす。辞書ファイルは `src/lib/data/apparel-terms.ts` 等に切り出して管理。

### 8.3 Category 削除時のカスケード戦略

子カテゴリがある親カテゴリを削除しようとした場合の挙動を Phase 1B で確定:
- 案 1: 子があれば削除拒否（現状の onDelete: Restrict）
- 案 2: 子も一括アーカイブ
- 案 3: 子の parent を null に付け替え（昇格）

### 8.4 ModelCode / Product 既存データの Category 設定

ProductCategory 実装後、既存の ModelCode / Product にデフォルトで categoryId が null になっている。慎太郎さんが手動でセットアップする運用とする（Phase 1B でバルクアップデート UI を検討）。

---

## 9. 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-05-27 | v1.0 | 初版作成、確定 | Shin + Claude |
