# Phase 1A-12 ModelCode（型番マスター）仕様確定議事録

**作成日**: 2026 年 5 月 27 日
**作成者**: Shin（肥沼慎太郎）+ Claude
**バージョン**: v1.0
**ステータス**: 確定（実装着手可能）

---

## 1. 目的

shunya 生産管理システム Phase 1A-12 にあたる ModelCode（モデルコード / 型番マスター）の実装仕様を確定する。

ModelCode は仕様書 Part 2 で「商品の『型』を表す不変 ID、リピートで継承」と定義されており、Product（品番）の親エンティティとなる。他のマスター（Client / Buyer / DD 等）と異なり、**集計マスター的な性格** を持つため、Phase 1A における実装方針を明示的に確定する必要がある。

---

## 2. 確定事項サマリー

| # | 論点 | 確定内容 |
|---|---|---|
| A-1 | 実装方針 | **C: ハイブリッド**（基本情報は手動編集可、集計データは読み取り専用） |
| A-2 | ステータス値 | **4 値維持**（ACTIVE / INACTIVE / DISCONTINUED / ARCHIVED） |
| A-3 | 採番方式 | **自動採番** `M-{ブランド略号}-{連番4桁}` |
| A-4 | 採番タイミング | **(a) 新規作成画面で Brand 選択時にプレビュー表示 + 保存時に最終確定** |
| B-1 | UI カード構成 | **6 カード**（基本情報 / 商品分類 / 所有権 / 累積データ / 保有資産 / ステータス） |
| B-2 | 一覧フィルタ | **Brand + Category + Status の 3 軸 + キーワード検索** |
| B-3 | 詳細画面追加要素 | 関連品番一覧セクション（Phase 1A は空表示）、リピート系譜セクション（Phase 1B 以降） |
| C-1 | ProductCategory 依存 | **categoryId を optional のまま進める**（ProductCategory は別タスクで実装） |
| C-2 | Brand 依存 | 実装済みのため、そのまま参照 |

---

## 3. 論点 A: 実装方針

### A-1: 実装方針

ModelCode は他のマスターと異なり、本来は **業務トランザクション（Product 作成）から自動発番される集計マスター** である。

仕様書側の設計：
- 発番タイミング = サンプル依頼確定時に Product と同時に自動発番
- 累積データ（リピート数、累計生産数、累計売上）= Product から自動集計
- 保有資産フラグ = PatternVersion / DesignVersion の存在から自動算出

3 つの選択肢を検討した結果、**C: ハイブリッド** を採用：

| 選択肢 | 内容 | 採否 |
|---|---|---|
| A | 完全な手動 CRUD マスターとして実装 | × |
| B | 読み取り専用ビューとして実装（Phase 1B で自動採番） | × |
| C | 基本情報は手動編集可、集計データは読み取り専用 | **○** |

採用理由：
- Phase 1A の目的（マスターを動かせる状態にする）を達成できる
- 累積データ等を手入力可能にしない（運用上の整合性を保護）
- Phase 1B で Product と連携した時点で、手動採番 UI を消すだけで自然移行できる

### A-2: ステータス値

ModelCode のステータスは **4 値を維持** する。

```
ACTIVE        // 現役モデル
INACTIVE      // 一時休止
DISCONTINUED  // 廃番
ARCHIVED      // アーカイブ
```

Buyer / DD の 2 値（ACTIVE / ARCHIVED）とは異なる理由：

- ModelCode は「型」であり、廃番 / 休止という業務的な状態区別が必要
- Product から見たとき、INACTIVE の型は新規 Product で使えない（DISCONTINUED は完全に廃止）
- archive とは別の業務ステータスとして扱う

### A-3: 採番方式

**自動採番** とする。フォーマット：

```
M-{ブランド略号}-{連番4桁}
例: M-MK-0001（MARKA の 1 番目）
    M-BMS-0001（BEAMS の 1 番目）
```

- **M-** : ModelCode の固定接頭辞
- **{ブランド略号}** : Brand マスターから `brand.code`（または相当フィールド）を取得
- **{連番4桁}** : ブランドごとの独立した連番、4 桁ゼロ埋め

ブランドごとの連番のため、`@@unique([companyId, modelCode])` の制約で衝突を防ぐ。

### A-4: 採番タイミング

**(a) プレビュー表示 + 保存時に最終確定** とする。

```
ユーザーが新規作成画面で Brand を選択
→ その瞬間、modelCode 欄に "M-MK-0002" のようにプレビュー表示（読み取り専用）
ユーザーが他のフィールドを入力して保存ボタンを押す
→ 保存時に再度連番を計算し、最終確定
同時編集等で先に番号が使われていた場合、次の番号が割り当てられる
```

UI 上の注記：
> ※ 採番は保存時に確定します。表示中の番号は参考です。

実装上の注意点：
- プレビュー時のクエリは「現在の最大連番 + 1」をブランドごとに取得
- 保存時に Prisma の transaction 内で再計算 + create を実施
- 衝突時はリトライまたはエラー表示

---

## 4. 論点 B: UI 設計

### B-1: フォームのカード構成（6 カード）

```
カード 1: 基本情報
├─ modelCode（自動採番、編集不可表示）
├─ brandId（Select、必須）
├─ modelName（必須）
├─ modelNameEn
└─ description（Textarea）

カード 2: 商品分類
├─ categoryId（Select、optional、Phase 1A では未実装のため空表示）
└─ silhouette（自由入力：オーバーサイズ / レギュラー / スリム等）

カード 3: 所有権（著作権・パターン・デザイン）
├─ patternOwnership（Select: SHUNYA / CLIENT / SHARED / CONTRACT_BASED）
└─ designOwnership（同上）

カード 4: 累積データ ← 読み取り専用
├─ totalRepetitions（リピート回数）
├─ totalProductionQty（累計生産数）
├─ totalRevenue（累計売上）
├─ totalPatternCost / totalDesignCost
└─ costPerUnit（累計コスト ÷ 累計生産数）

カード 5: 保有資産 ← 読み取り専用
├─ hasPattern / hasDesign / hasGrading（Boolean）
└─ latestProductId（最新使用品番へのリンク）

カード 6: ステータス
└─ status（Select: ACTIVE / INACTIVE / DISCONTINUED / ARCHIVED）
```

カード 4 と 5 は Phase 1A では常に「データなし」または「0 件」表示となる。ヘッダーに以下の注記を付ける：

> ※ このセクションは Product / PatternVersion / DesignVersion が実装された段階で自動更新されます（Phase 1B 以降）

### B-2: 一覧画面のフィルタ

- **キーワード検索**: `modelCode` / `modelName` 部分一致
- **Brand フィルタ**: Select、ALL / 各 Brand
- **Category フィルタ**: Select、ALL / 各 Category（Phase 1A は空 Select）
- **Status フィルタ**: Select、ALL / ACTIVE / INACTIVE / DISCONTINUED / ARCHIVED

### B-3: 詳細画面の構成

フォームの 6 カードに加え、以下を表示：

- セクション「関連品番（Product）」: Phase 1A は「Phase 1B で表示されます」のプレースホルダ。Phase 1B 以降は Product 一覧（テーブル形式、シーズン降順）
- セクション「リピート系譜」: Phase 1A は「Phase 1B で表示されます」のプレースホルダ。Phase 1B 以降は親子関係の樹形図表示

詳細画面の編集ボタン、archive / restore / 物理削除ボタンも master-patterns に従って配置。

---

## 5. 論点 C: 依存関係

### C-1: ProductCategory（未実装）への依存

ModelCode は `categoryId` で ProductCategory を参照するが、ProductCategory は Phase 1A の実装対象外。

対応方針：
- **categoryId を optional のまま実装**
- 商品分類カードの Category Select は表示するが、選択肢は空
- ヘルプテキストとして「商品カテゴリマスター実装後に選択可能になります」と表示
- ProductCategory 実装後、自動的に選択肢が埋まる

ProductCategory の実装タイミング：
- 案: Phase 1A の追加タスク（1A-15 など）として後追い実装
- 案: Phase 1B 入り口で Product と一緒に実装

Phase 1A-12 の完了判定には ProductCategory は含めない。

### C-2: Brand（実装済み）への依存

Brand は Phase 1A-3 で実装済みのため、そのまま参照：
- ModelCode の brandId Select は Brand マスターから取得
- Brand 削除時のカスケード方針は Buyer と同様にパターン γ（警告 + 選択）を採用するか別途検討

---

## 6. データモデル（最終版）

既存スキーマに対する差分はほぼ無し。確認のみ実施する。

```prisma
model ModelCode {
  id                String   @id @default(uuid())
  companyId         String   @map("company_id")
  modelCode         String   @map("model_code") @db.VarChar(50)
  brandId           String   @map("brand_id")

  // 基本情報
  modelName         String   @map("model_name") @db.VarChar(255)
  modelNameEn       String?  @map("model_name_en") @db.VarChar(255)
  description       String?  @db.Text

  // 商品分類
  categoryId        String?  @map("category_id")
  silhouette        String?  @db.VarChar(100)

  // 累積データ（Phase 1A は集計ロジックなし、Phase 1B で実装）
  totalRepetitions    Int      @default(0) @map("total_repetitions")
  totalProductionQty  Int      @default(0) @map("total_production_qty")
  totalRevenue        Decimal? @map("total_revenue") @db.Decimal(15, 2)
  totalPatternCost    Decimal? @map("total_pattern_cost") @db.Decimal(15, 2)
  totalDesignCost     Decimal? @map("total_design_cost") @db.Decimal(15, 2)
  costPerUnit         Decimal? @map("cost_per_unit") @db.Decimal(15, 4)

  // 最新使用品番（Phase 1B で更新）
  latestProductId   String?  @map("latest_product_id")

  // 保有資産フラグ（Phase 1B で更新）
  hasPattern        Boolean  @default(false) @map("has_pattern")
  hasGrading        Boolean  @default(false) @map("has_grading")
  hasDesign         Boolean  @default(false) @map("has_design")

  // 著作権・所有権
  patternOwnership  OwnershipType @default(SHUNYA) @map("pattern_ownership")
  designOwnership   OwnershipType @default(SHUNYA) @map("design_ownership")

  // ステータス
  status            ModelCodeStatus @default(ACTIVE)

  firstCreatedAt    DateTime @default(now()) @map("first_created_at")
  lastUsedAt        DateTime? @map("last_used_at")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  deletedAt         DateTime? @map("deleted_at")

  products          Product[]

  @@unique([companyId, modelCode])
  @@index([companyId, brandId])
  @@index([companyId, status])
  @@index([companyId, categoryId])
  @@map("model_codes")
}

enum ModelCodeStatus {
  ACTIVE
  INACTIVE
  DISCONTINUED
  ARCHIVED
}
```

既存スキーマと比較した変更点：
- なし（既存スキーマをそのまま使用）

Phase 1B 以降で必要となる追加：
- Product との集計用 trigger / scheduled job
- リピート系譜の親子関係を表現する別テーブル（仕様書では `product_repetition_lineage`）

---

## 7. 実装手順（master-patterns v1.2 準拠）

### Phase 1: スキーマ
- 既存 ModelCode モデルを確認（変更不要）
- `npx prisma migrate dev` → 不要（既存スキーマで対応済み）

### Phase 2: 論理層
- `src/lib/validators/model-code.ts` 作成
  - modelCode の `M-{2-4文字}-\d{4}` 正規表現検証
  - brandId 必須
  - modelName 必須
- `src/app/(app)/model-codes/_components/labels.ts` 作成
  - MODEL_CODE_STATUS_LABELS / _OPTIONS / _BADGE_VARIANT（4 値対応）
  - OWNERSHIP_TYPE_LABELS / _OPTIONS（既存定数あれば re-export）
- `src/lib/actions/model-codes.ts` 作成（8 関数）
  - list / get / create / update / archive / restore / checkUsage / deletePermanently
  - `generateNextModelCode(brandId)` ヘルパー：自動採番のためのユーティリティ
  - `listActiveBrandsForModelCodeSelect()` ヘルパー：Brand Select 用

### Phase 3: UI
- `_components/model-code-form.tsx`（6 カードフォーム）
  - Brand 選択時の modelCode プレビュー（onChange で次番号を取得）
- `_components/model-code-delete-button.tsx`
- `_components/model-codes-table.tsx`
- `_components/model-codes-search.tsx`
- `_components/model-codes-pagination.tsx`
- `page.tsx` / `new/page.tsx` / `[id]/page.tsx` / `[id]/edit/page.tsx`
- ナビゲーション（`nav-items.ts`）への追加

### Phase 4: PR & デプロイ
- 3 コミット構成（schema 不変のため、実質 2 コミット）
  - Commit 1: logic 層（validators / labels / actions）
  - Commit 2: UI（components / pages / nav）
- PR 作成、動作確認、マージ、Railway 自動デプロイ

---

## 8. 動作確認チェックリスト

### master-patterns §11 標準 7 項目

- [ ] 新規作成（Brand を選んで自動採番される）
- [ ] 詳細表示（全 6 カード正しく表示、累積データは 0 表示）
- [ ] 一覧表示（フィルタ動作確認）
- [ ] 編集（modelCode は変更不可、その他は更新可能）
- [ ] アーカイブ
- [ ] 復元
- [ ] 物理削除（MASTER_ADMIN、ARCHIVED、名前一致、紐付き 0 件）

### Phase 1A-12 固有

- [ ] 自動採番: Brand を選択した瞬間に modelCode プレビューが表示される
- [ ] 自動採番: 保存時に番号が確定する
- [ ] 自動採番: ブランドごとに連番が独立している（MK 系と BMS 系は別カウント）
- [ ] ステータス 4 値: ACTIVE / INACTIVE / DISCONTINUED / ARCHIVED すべてフィルタ可能
- [ ] 累積データカード: 「Phase 1B 以降で自動更新」の注記が表示される
- [ ] Category Select: 選択肢が空でも UI が壊れない
- [ ] modelCode は編集画面でも変更できない

---

## 9. Phase 1B 以降のフォローアップ項目

Phase 1A-12 の完了後、以下を Phase 1B 以降で実装する。

### 9.1 Product との連携
- Product 新規作成時に ModelCode を自動採番（または既存 ModelCode から選択）
- Product 作成時に `lastUsedAt` を更新

### 9.2 累積データの自動集計
- Product 完了時に ModelCode の集計値を更新
  - `totalRepetitions` += 1
  - `totalProductionQty` += product.productionQty
  - `totalRevenue` += product.totalRevenue
- 実装方法: Prisma middleware / Postgres trigger / scheduled job のいずれか

### 9.3 保有資産フラグの自動更新
- PatternVersion 作成時に `hasPattern` を true に
- DesignVersion 作成時に `hasDesign` を true に
- グレーディング設定時に `hasGrading` を true に

### 9.4 リピート系譜の表示
- `product_repetition_lineage` テーブルを実装
- 詳細画面に親子関係の樹形図を表示

### 9.5 ProductCategory マスター実装
- Phase 1A の追加タスクまたは Phase 1B 入口で実装
- 実装後、ModelCode の Category Select に選択肢が表示される

### 9.6 手動採番 UI の削除
- Phase 1B で Product 作成時の自動採番ロジックが実装され次第、ModelCode の手動新規作成画面は不要になる
- 削除 or 「管理者のみアクセス可」の権限制御に変更

---

## 10. 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-05-27 | v1.0 | 初版作成、確定 | Shin + Claude |
