# Phase 1A-15 MaterialCategory(素材カテゴリマスター)仕様確定議事録

**作成日**: 2026 年 5 月 28 日
**作成者**: Shin(肥沼慎太郎) + Claude
**バージョン**: v1.0
**ステータス**: 確定(実装着手可能)
**precedent**: Phase 1A-14 ProductCategory(PR #31)

---

## 1. 目的

shunya 生産管理システム Phase 1A-15 にあたる MaterialCategory(素材カテゴリマスター)の実装仕様を確定する。

MaterialCategory は Material の categoryId 参照先として既存スキーマに定義済みだが、Phase 1A-13a Material 実装時には未実装のため Select が disabled となっていた。本フェーズで実装することで、Material の Category Select を有効化する。

業界実務的にアパレル素材のカテゴリは「大分類(素材種別) / 中分類(素材名) / 小分類(規格・加工)」の 3 階層で管理されることが多く、本実装でも ProductCategory と同じ階層構造を採用する。

---

## 2. 確定事項サマリー

| # | 論点 | 確定内容 | precedent |
|---|---|---|---|
| A-1 | 設計方針 | **ProductCategory(1A-14)の precedent を完全流用** | 1A-14 |
| A-1.1 | 階層深さ | 3 階層まで | 1A-14 |
| A-1.2 | ステータス値 | 2 値(ACTIVE / ARCHIVED) | 1A-14 |
| A-1.3 | 採番方式 | 手動入力 + サジェスト | 1A-14 |
| A-1.4 | UI カード構成 | 3〜4 カード(既存実装に依存、確認後確定) | 1A-14 |
| A-1.5 | 一覧フィルタ | キーワード + parent + Status の 3 軸 | 1A-14 |
| A-2 | サジェスト辞書 | **素材分類用の独自辞書 ~50 語** | 新規(1A-14 とは別物) |
| A-3 | Material 連携 | Phase 1A-15 内で Material の Category Select を有効化 | 1A-14 |
| A-4 | 既存実装の確認 | Claude Code が着手時に確認、既存があれば「拡張」、なければ「新規実装」 | 1A-14 |

---

## 3. 論点 A: 設計方針

### A-1: ProductCategory の precedent を完全流用

Phase 1A-14 で確立した階層カテゴリマスターのパターンをそのまま採用する。

流用する設計要素:

| 要素 | Phase 1A-14 ProductCategory | Phase 1A-15 MaterialCategory |
|---|---|---|
| 階層深さ | 3 階層 | 同じ |
| 階層チェック | parent.parent.parentCategoryId === null | 同じ |
| ステータス | enum 2 値(ACTIVE / ARCHIVED) | 同じ |
| 採番 | 手動入力(英数字 + ハイフン + アンダースコア) | 同じ |
| categoryCode 長さ | VARCHAR(50) | 同じ(必要なら拡張) |
| categoryName unique | parent + name の組み合わせで unique | 同じ |
| サジェスト方式 | (i) 辞書 + (ii) parent code 派生 | 同じ |
| UI レイアウト | パンくず付き Select + フラットテーブル | 同じ |
| 一覧フィルタ | キーワード + parent + Status | 同じ |
| Material/ModelCode 側の解放 | Phase 1A-14 最終コミット | Phase 1A-15 最終コミット |

### A-1.1: 階層深さ 3 階層まで
Lv1: 表地 / 裏地 / 副資材                    (大分類)
└─ Lv2: コットン / ウール / ポリエステル   (中分類)
└─ Lv3: ポプリン / ツイル / ガーゼ    (小分類・規格)

または以下のような階層も想定される。
Lv1: ファスナー
└─ Lv2: 金属 / プラスチック / 樹脂
└─ Lv3: YKK / SAB / 国産

業務上、慎太郎さんが運用しやすい階層を自由に設計できる。

### A-1.2: ステータス値 2 値

```prisma
enum MaterialCategoryStatus {
  ACTIVE
  ARCHIVED
}
```

ProductCategoryStatus と同じ構成。素材カテゴリも「グルーピングの箱」であり、廃番という概念が薄いため 2 値で十分。

### A-1.3: 採番方式 - 手動入力 + サジェスト

詳細は A-2 を参照。基本ロジックは Phase 1A-14 と同じ。

### A-1.4: UI カード構成

ProductCategory の既存実装(Phase 1A-7 から拡張)に揃える。既存 MaterialCategory 実装の有無で対応が変わる:

- 既存実装あり → 既存カード構成を維持しつつ、サジェスト機能を追加(Phase 1A-14 と同じ流れ)
- 既存実装なし → 4 カード構成(基本情報 / 階層 / 標準値 / ステータス)で新規実装

### A-1.5: 一覧フィルタ 3 軸

- キーワード検索: categoryCode / categoryName / categoryNameEn の部分一致
- parent フィルタ: ALL / 各 parent カテゴリ(階層パンくず表示)
- Status フィルタ: ALL / ACTIVE / ARCHIVED

---

## 4. 論点 A-2: サジェスト辞書(素材分類用)

ProductCategory とは別物の辞書を `src/lib/utils/material-category-code-suggest.ts` として実装する。

### 4.1 辞書設計案(初期 ~50 語)

#### 大分類
表地 → OUTER, FABRIC
裏地 → LINING
芯地 → INTERLINING
副資材 → ACCESSORY
ファスナー → ZIPPER, FASTENER
ボタン → BUTTON
糸 → THREAD
ゴム → ELASTIC
テープ → TAPE
ネーム → LABEL
下げ札 → HANG_TAG, HANGTAG
品質表示 → CARE_LABEL
袋 → PACKAGING_BAG
ポリ袋 → POLYBAG
箱 → BOX

#### 素材名(中分類想定)
コットン → COTTON
ウール → WOOL
シルク → SILK
リネン → LINEN
ポリエステル → POLYESTER, POLY
ナイロン → NYLON
レーヨン → RAYON
アクリル → ACRYLIC
カシミヤ → CASHMERE
キュプラ → CUPRO
モヘア → MOHAIR
スパンデックス → SPANDEX
デニム → DENIM
レザー → LEATHER
スウェード → SUEDE

#### 規格・加工(小分類想定)
ポプリン → POPLIN
ツイル → TWILL
ガーゼ → GAUZE
シャンブレー → CHAMBRAY
オックス → OXFORD
サテン → SATIN
ジャージー → JERSEY
プリント → PRINT
染色 → DYED
起毛 → BRUSHED
防水 → WATERPROOF
撥水 → WATER_REPELLENT
オーガニック → ORGANIC

#### ボタン・ファスナー材質(副資材小分類)
金属 → METAL
プラスチック → PLASTIC
樹脂 → RESIN
木 → WOOD
シェル → SHELL
水牛 → BUFFALO

合計 ~50 語前後。慎太郎さんの運用で必要に応じて追加していく。

### 4.2 サジェストロジック

ProductCategory と同じ実装パターン:

```typescript
suggestMaterialCategoryCode(
  categoryName: string,
  parentCategoryCode: string | null,
  maxResults = 3,
): CategoryCodeSuggestion[]
```

動作:
- (ii) parent が選択されている時は `${parentCode}-${dictHit}` を優先表示
- (i) 辞書ヒット時は `${dictHit}` を表示
- 辞書ヒットなし時は空配列(自由入力)
- 大文字に統一

### 4.3 ProductCategory 辞書との共通化検討

両辞書に共通する語(例: `LADIES`, `TOPS` 等)はないため、辞書ファイル自体は独立させる。

ただし型定義(`CategoryCodeSuggestion`, `DictEntry`)は共通化のため、ProductCategory 側を `src/lib/utils/category-code-suggest-types.ts` 等に切り出すことを推奨。

---

## 5. 論点 A-3: Material 連携

Phase 1A-15 の最後のコミットで以下を実装。

### 5.1 Material フォームの Category Select 解放

`src/app/(app)/materials/_components/material-form.tsx` を修正:

- categoryId Select の `disabled` を削除
- `listAllActiveMaterialCategoriesForSelect()` を呼び出し、選択肢を populate
- SelectItem は ProductCategory と同様、パンくず付きで表示:
FABRIC-COTTON-POPLIN  表地 > コットン > ポプリン
- ヘルプテキスト「素材カテゴリマスター実装後に選択可能になります」を削除

### 5.2 listAllActiveMaterialCategoriesForSelect ヘルパー

ProductCategory の `listAllActiveProductCategoriesForSelect` と同じ実装。

```typescript
export type MaterialCategorySelectOption = {
  id: string
  categoryCode: string
  categoryName: string
  level: 1 | 2 | 3
  breadcrumb: string  // "表地 > コットン > ポプリン"
}

export async function listAllActiveMaterialCategoriesForSelect(): Promise
  MaterialCategorySelectOption[]
>
```

循環参照の防止用に `visited Set` でフェイルセーフを入れる(ProductCategory と同パターン)。

### 5.3 一覧画面の Category フィルタ追加(オプション)

Material 一覧の `materials-search.tsx` に Category フィルタを追加するかは、既存フィルタの状態次第で判断する:

- 現状: キーワード + Type + Supplier + Status の 4 軸
- 追加後: 5 軸(Category を追加)

5 軸はやや過剰なため、**Phase 1A-15 では一覧フィルタ追加は見送り**(必要なら Phase 1B 以降で対応)。フォームの Category Select 解放のみで十分。

---

## 6. 論点 A-4: 既存実装の確認

Phase 1A-14 で ProductCategory が既に Phase 1A-7 で実装済みだったように、MaterialCategory も既に部分実装されている可能性がある。

### 6.1 着手前のチェック

Claude Code が以下を確認:

```bash
ls "src/app/(app)/material-categories/" 2>/dev/null
ls src/lib/actions/ | grep -i "material-categor"
ls src/lib/validators/ | grep -i "material-categor"
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.materialCategory.count().then(n=>console.log('count:',n))"
```

### 6.2 分岐対応

**既存実装あり(Phase 1A-7 等で既に作られていた場合)**:
- ProductCategory と同様、**「既存実装への追加 / 拡張」** として進める
- 既存 CRUD ロジックは温存
- サジェスト機能と Material 連携の追加が主な変更
- 既存スキーマで `categoryCode VARCHAR(?)` の長さを確認、足りなければ拡張

**既存実装なし**:
- **新規実装** として、ProductCategory(Phase 1A-7 + 1A-14)の precedent をそのまま流用
- validator / actions / labels / 6 components / 4 pages / nav-items 一式作成

---

## 7. データモデル(既存スキーマの確認)

### 7.1 想定スキーマ

既存スキーマで MaterialCategory モデルがどう定義されているか確認後、必要なら status enum 追加 + categoryCode 長さ調整。

```prisma
model MaterialCategory {
  id                String   @id @default(uuid())
  companyId         String   @map("company_id")
  categoryCode      String   @map("category_code") @db.VarChar(50)  // 必要なら拡張
  categoryName      String   @map("category_name") @db.VarChar(255)
  categoryNameEn    String?  @map("category_name_en") @db.VarChar(255)
  parentCategoryId  String?  @map("parent_category_id")
  status            MaterialCategoryStatus @default(ACTIVE)  // 新規追加 or 型変更
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")

  parent            MaterialCategory?  @relation("MaterialCategoryHierarchy", fields: [parentCategoryId], references: [id])
  children          MaterialCategory[] @relation("MaterialCategoryHierarchy")
  materials         Material[]

  @@unique([companyId, categoryCode])
  @@index([companyId, parentCategoryId])
  @@index([companyId, status])
  @@map("material_categories")
}

enum MaterialCategoryStatus {
  ACTIVE
  ARCHIVED
}
```

実装時に既存スキーマを確認し、不足があれば migration を追加。

---

## 8. 実装手順(master-patterns v1.2 準拠)

### Phase 1: 既存実装の確認 & スキーマ変更

1. 着手前チェック(§6.1)
2. 既存実装の有無で分岐
3. スキーマ変更が必要なら migration 生成 + 適用

### Phase 2: 論理層 + サジェストロジック

- 既存実装あり: validator の maxLength 調整、listAllActiveMaterialCategoriesForSelect 追加
- 既存実装なし: 完全新規実装(ProductCategory precedent をコピー)
- 共通: `src/lib/utils/material-category-code-suggest.ts` 新規作成(辞書 ~50 語)

### Phase 3: UI

- 既存実装あり: MaterialCategoryCodeSuggester 追加 + フォーム統合
- 既存実装なし: 6 コンポーネント + 4 ページ + nav-items 一式

### Phase 4: Material 連携

- Material フォームの Category Select の disabled 解除
- 階層パンくず付き SelectItem の populate
- ヘルプテキスト更新

### Phase 5: PR & デプロイ

- コミット構成(既存実装の有無で変動):
  - 既存あり: 4 コミット(schema / 論理層 / UI / Material 連携)
  - 既存なし: 5 コミット(schema / 論理層 / UI / pages+nav / Material 連携)
- PR タイトル: `feat(phase1a-15): 素材カテゴリマスター(階層 3 段 + 素材辞書サジェスト + Material 連携)`

---

## 9. 動作確認チェックリスト

### master-patterns §11 標準 7 項目

- [ ] 新規作成
- [ ] 詳細表示
- [ ] 一覧表示
- [ ] 編集
- [ ] アーカイブ
- [ ] 復元
- [ ] 物理削除(MASTER_ADMIN、ARCHIVED、名前一致、紐付き 0 件)

### Phase 1A-15 固有

- [ ] 階層作成: Lv1(parent なし)→ Lv2(parent=Lv1)→ Lv3(parent=Lv2)が作成できる
- [ ] 階層深さ制限: Lv3 を parent に選んで Lv4 を作成しようとするとエラー
- [ ] サジェスト (i): categoryName に「コットン」入力 → 候補に `COTTON` が出る
- [ ] サジェスト (ii): parent に FABRIC を選び、categoryName に「コットン」入力 → 候補に `FABRIC-COTTON` が出る
- [ ] サジェスト辞書: 大分類(表地/ファスナー/ボタン等)、素材名(コットン/ウール等)、加工(プリント/起毛等)がそれぞれヒット
- [ ] パンくず表示: 一覧で「表地 > コットン > ポプリン」のように階層が表示される
- [ ] 自己参照防止: 編集画面で自身を parent に選べない
- [ ] Material 連携: Material 編集画面で Category Select が enabled になり、選択肢が階層パンくず付きで表示される
- [ ] Material カテゴリ保存: カテゴリを選んで Material を保存 → 詳細画面で反映を確認
- [ ] 紐付き確認: Category に紐づく Material があれば物理削除で警告

---

## 10. Phase 1B 以降のフォローアップ項目

### 10.1 Material 一覧の Category フィルタ追加

Phase 1A-15 では見送り。Material 一覧の既存フィルタが 4 軸あり、追加すると過剰のため。Phase 1B で Material の業務利用が増えてきた時に検討する。

### 10.2 素材辞書の拡充

アパレル業界の素材用語を運用しながら追加。初期は ~50 語。辞書ファイル `src/lib/utils/material-category-code-suggest.ts` に集約。

### 10.3 Category 削除時のカスケード戦略

ProductCategory と同じ論点。子カテゴリがある親カテゴリを削除しようとした場合の挙動を Phase 1B で確定。

### 10.4 Material 既存データの Category 設定

MaterialCategory 実装後、既存の Material にデフォルトで categoryId が null になっている。慎太郎さんが手動でセットアップする運用(Phase 1B でバルクアップデート UI を検討)。

### 10.5 サジェスト型定義の共通化

ProductCategory と MaterialCategory の `CategoryCodeSuggestion` 型を `src/lib/utils/category-suggest-types.ts` 等に切り出してリファクタ。Phase 1A-15 では時間優先で個別実装、Phase 1B のリファクタタスクとして記録。

---

## 11. 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-05-28 | v1.0 | 初版作成、確定 | Shin + Claude |
