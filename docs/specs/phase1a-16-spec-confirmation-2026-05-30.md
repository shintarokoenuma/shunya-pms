# Phase 1A-16 CostCategory（原価費目マスター）仕様確定議事録（ドラフト）

**作成日**: 2026 年 5 月 30 日
**作成者**: Shin（肥沼慎太郎）+ Claude
**バージョン**: v0.1（ドラフト、要レビュー）
**ステータス**: 設計確定協議中

---

## 1. 目的

Phase 1A-16 として、従来の `ExpenseCategory`（諸経費マスター）を **全コスト費目を扱う階層マスター `CostCategory`（原価費目マスター）に格上げ・再設計**する。

本システムの 2 大原則である「全業務が連動して 2 度手間を防ぐ」「AI を駆使した自動化」を、コスト分類の基盤レベルで実現することが狙い。

---

## 2. 背景（設計確認の結論）

設計ドキュメント（仕様書 Part 2 §4.3、`QuotationCostBreakdown` スキーマ、sidebar 設計 §3.5）を確認した結果、以下が判明した。

### 2.1 設計で確定していたこと

- 見積もりエンジンの原価は **2 層構造**（社外集約 4 値 + 社内詳細 約 30 値）で設計済み。
- 原価明細 `QuotationCostBreakdown` は `expenseCategoryId`（諸経費マスターへの FK）と `calculationType`（「諸経費マスターと連動」とコメント明記）を持ち、**マスターを参照して標準金額・計算方法を自動取得する**連動が意図されていた。
- 「データの真実は 1 箇所に集約する」（sidebar §3.5）という設計思想が一貫して存在する。

### 2.2 現状のギャップ（＝2 度手間・不整合の温床）

コストの「分類」が 3 箇所に分散している。

| 分類軸 | 実体 | 値数 |
|---|---|---|
| `ExpenseCategory.expenseType` | enum（マスター側） | 15 |
| `InternalCostCategory` | enum（見積もり社内詳細） | 約 30 |
| `ExternalCostCategory` | enum（見積もり社外集約） | 4 |

しかも中身がズレている（例: マスターには `RENTAL_FEE` があるが社内詳細 enum には無い／社内詳細 enum には `INSURANCE`・`REMITTANCE_FEE`・`FX_LOSS`・`DESIGN_FEE` があるがマスターには無い）。費目を 1 つ追加するたびに複数の enum をコード変更する必要があり、AI も enum に無い費目を扱えない。さらに現状の `ExpenseCategory` はフラットで、設計済みの 2 層構造を表現できていない。

---

## 3. 確定方針（慎太郎さん承認済み）

- コスト費目は **enum ではなくマスター（テーブル）に統一**する。
- 4 大分類（材料費・縫製費・加工費・諸経費）は変わらないが、その配下の費目は増える前提。
- 階層管理を考慮し、単一の階層マスターに集約する。

---

## 4. 確定事項サマリー

| # | 論点 | 内容 | 状態 |
|---|---|---|---|
| A-1 | マスター名 | `ExpenseCategory` → **`CostCategory`（原価費目マスター）** に改名・格上げ | 提案（要確認） |
| A-2 | 適用範囲 | 諸経費に限定せず、材料費・縫製費・加工費・諸経費の **全コスト費目**を扱う | 確定 |
| B-1 | 階層 | `parentCategoryId` + `level` の自己参照階層（ProductCategory / MaterialCategory と同型） | 確定 |
| B-2 | Lv1 | 4 大分類を **システム予約行**として Lv1 に置く（削除・コード変更不可） | 提案（要確認） |
| B-3 | Lv2 以下 | 個別費目。N 階層許容、初期シードは 2 階層 | 確定 |
| C-1 | 社外集約キー | 各行に `externalCategory`（enum 4 値）を保持。社外表示・集約ロジックはこれを参照（型安全） | 提案（要確認） |
| C-2 | `InternalCostCategory` | enum を**廃止**し、約 30 値を本マスターの Lv2 シード行へ吸収 | 提案（要確認） |
| C-3 | enum で残すもの | `ExternalCostCategory`（4 値）/ `CalculationType` / `status` は enum 維持 | 提案（要確認） |
| D-1 | 採番 | Lv1 は予約コード（`MATERIAL` 等）。Lv2 以下は手動 `categoryCode`（先例踏襲） | 提案（要確認） |
| D-2 | 多言語名 | 日英中越 4 言語（見積もり PDF が 4 言語のため） | 提案（要確認） |
| D-3 | 標準金額・計算方法 | 主に葉ノードで設定。Lv1・中間ノードは原則 null | 確定 |
| E-1 | 見積もり連動 | `QuotationCostBreakdown.expenseCategoryId` → `costCategoryId` に改名し、これを分類の主キーとする。`internalCategory` enum 列は廃止 | 提案（要確認） |

---

## 5. 論点詳細

### 論点 A: マスター名と位置づけ

`ExpenseCategory`（＝諸経費）のままでは「材料費・縫製費・加工費」を含む全コスト費目を扱う実態と名前が乖離する。Phase 1A 時点で実データ 0 件・画面未実装のため、改名コストはほぼゼロ。**`CostCategory`（原価費目マスター）への改名を推奨**。

### 論点 B: 階層構造

- Lv1 = 4 大分類（材料費 / 縫製費 / 加工費 / 諸経費）。**システム予約行**（`isSystemReserved = true`）とし、ユーザーは削除・コード変更不可、名称（多言語）の編集のみ可。
- Lv2 = 個別費目（本体生地・裏地・パターン代・検品費…）。運用で追加・編集・archive 可能。
- Lv3 以降も `parentCategoryId` で表現可能（例: 諸経費 > 輸送費 > 国内輸送 / 国際輸送）。初期シードは 2 階層に留める。

### 論点 C: 4 大分類の扱い（型安全の担保）

4 大分類は「変わらない」かつ「見積もり PDF の社外表示ロジックが分岐に使う」値。完全データ駆動にするとコード側が文字列マジックになり危険。したがって:

- `ExternalCostCategory`（enum 4 値）は **維持**し、各 `CostCategory` 行に `externalCategory` 属性として持たせる。
- Lv1 の 4 行は各 enum 値と 1:1 対応。子ノードは Lv1 祖先の `externalCategory` を引き継ぐ（書き込み時にデノーマライズ保持し、集計クエリを高速化）。

これにより「マスターに統一（階層は 1 本）」と「4 分類の型安全」を両立する。

### 論点 D: InternalCostCategory enum の廃止・吸収

約 30 値の社内詳細 enum を `CostCategory` の Lv2 シード行へ移す。`expenseType`（15 値）と `InternalCostCategory`（約 30 値）の **和集合**を取り、現状のズレ（前述）を解消した統一リストをシードとする。費目分類が「コード固定の enum」から「運用で育つデータ」になり、AI による自動費目マッピング（仕様書 Part 3 §7.1 のAI候補提示→担当者承認方式）が成立する。

### 論点 E: enum で残すもの（振る舞い軸）

分類軸はマスター、**振る舞い軸（ロジックが依存する固定値）は enum** で残す。

- `CalculationType`（FIXED / PER_UNIT / PERCENTAGE / WEIGHT_BASED…）: 計算ロジックそのもの。`switch` 対象なので enum 維持。
- `ExternalCostCategory`（4 値）: 上記論点 C のとおり維持。
- `status`（ACTIVE / ARCHIVED 等）: 状態遷移ロジックに使用。enum 維持。

---

## 6. スキーマ案（Prisma）

```prisma
// =====================================================
// 原価費目マスター（旧 ExpenseCategory を全コスト費目に格上げ・階層化）
// =====================================================

/// 原価費目マスター
/// 材料費・縫製費・加工費・諸経費の4大分類(Lv1)配下に費目を階層管理する。
/// 見積もり原価明細(QuotationCostBreakdown)はこのマスターを参照し、
/// 標準金額・計算方法・社外集約カテゴリを自動取得する（2度手間防止）。
model CostCategory {
  id                  String   @id @default(uuid())
  companyId           String   @map("company_id")

  // 識別
  categoryCode        String   @map("category_code") @db.VarChar(50)
  categoryName        String   @map("category_name") @db.VarChar(255)
  categoryNameEn      String?  @map("category_name_en") @db.VarChar(255)
  categoryNameZh      String?  @map("category_name_zh") @db.VarChar(255)
  categoryNameVi      String?  @map("category_name_vi") @db.VarChar(255)

  // 階層構造
  parentCategoryId    String?  @map("parent_category_id")
  level               Int      @default(1)

  // 社外集約キー（4大分類。固定値のため enum で型安全に保持。子は祖先から継承し保持）
  externalCategory    ExternalCostCategory @map("external_category")

  // システム予約行（4大分類等。ユーザーは削除・コード変更不可、名称編集のみ可）
  isSystemReserved    Boolean  @default(false) @map("is_system_reserved")

  // 標準値（主に葉ノードで設定。Lv1・中間ノードは原則 null）
  standardAmount      Decimal? @map("standard_amount") @db.Decimal(15, 2)
  currency            Currency @default(JPY)
  calculationType     CalculationType @default(FIXED) @map("calculation_type")

  // 表示制御
  showToClientDefault Boolean  @default(false) @map("show_to_client_default")

  // メモ・ステータス
  notes               String?  @db.Text
  status              String   @default("ACTIVE") @db.VarChar(20)

  // タイムスタンプ
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  deletedAt           DateTime? @map("deleted_at")

  // 自己参照
  parent              CostCategory?  @relation("CostCategoryHierarchy", fields: [parentCategoryId], references: [id])
  children            CostCategory[] @relation("CostCategoryHierarchy")

  // 見積もり原価明細からの参照
  costBreakdowns      QuotationCostBreakdown[]

  @@unique([companyId, categoryCode])
  @@index([companyId, parentCategoryId])
  @@index([companyId, externalCategory])
  @@map("cost_categories")
}
```

廃止する enum: `ExpenseType`（旧マスター列）、`InternalCostCategory`（見積もり社内詳細）。
維持する enum: `ExternalCostCategory`、`CalculationType`。

### シード（Lv1 = 4 行・予約）

| categoryCode | categoryName | externalCategory | isSystemReserved | level |
|---|---|---|---|---|
| `MATERIAL` | 材料費 | MATERIAL | true | 1 |
| `SEWING` | 縫製費 | SEWING | true | 1 |
| `PROCESSING` | 加工費 | PROCESSING | true | 1 |
| `OVERHEAD` | 諸経費 | OVERHEAD | true | 1 |

### シード（Lv2 例・`expenseType` ∪ `InternalCostCategory` の和集合）

- 材料費(MATERIAL): 本体生地 / 裏地 / 芯地 / ファスナー / ボタン / 糸 / その他副資材 / ラベル・ネーム / 包装材
- 縫製費(SEWING): 通常縫製 / 特殊縫製 / 仕上げ
- 加工費(PROCESSING): プリント / 刺繍 / 洗い加工 / 染色 / 特殊加工
- 諸経費(OVERHEAD): パターン代 / グレーディング代 / サンプル製作費 / 検品費 / 国内輸送費 / 国際輸送費 / 通関費 / 関税 / 輸入消費税 / 保管費 / 保険料 / 送金手数料 / 為替差損 / ロイヤリティ / 撮影費 / デザイン費 / レンタル費 / その他

---

## 7. 見積もりエンジン連動（Phase 1B 接続点）

`QuotationCostBreakdown` を以下のとおり変更する（実装は Phase 1B、本 Phase ではスキーマ整合のみ）。

- `expenseCategoryId` → **`costCategoryId`**（FK → `CostCategory`）に改名。分類の主キーとする。
- `internalCategory`（`InternalCostCategory` enum）列を **廃止**。
- `externalCategory`（`ExternalCostCategory`）列は維持。書き込み時に `CostCategory.externalCategory` から自動設定（社外集約の高速化・型安全）。
- 見積もり作成時、`costCategoryId` を選ぶだけで `standardAmount` / `calculationType` / `externalCategory` が自動充填される（＝2 度手間防止の中核）。

---

## 8. 移行方針

- 現 `ExpenseCategory` は実データ 0 件・画面未実装、`QuotationCostBreakdown`（見積もりエンジン）は Phase 1B で未実装。よって **今のうちに再構造化するコストは最小**。
- 作業順: (1) Prisma スキーマ改定（`CostCategory` 新設、旧 `ExpenseCategory` / 廃止 enum 除去）→ (2) マイグレーション → (3) シードスクリプト（Lv1 予約 4 行 + Lv2 和集合）→ (4) CRUD 画面実装（master-patterns 準拠）。
- 動作確認は **dev DB（`postgres-development`）優先**、本番は smoke test のみ（環境安全チェック準拠）。

---

## 9. 動作確認チェックリスト

### master-patterns §11 標準 7 項目

- [ ] 新規作成（親を選んで子費目を追加できる）
- [ ] 詳細表示
- [ ] 一覧表示（階層 / 大分類フィルタ）
- [ ] 編集（予約行は categoryCode 変更不可、名称のみ可）
- [ ] アーカイブ
- [ ] 復元
- [ ] 物理削除（予約行は不可。一般行は紐付き 0 件のみ）

### Phase 1A-16 固有

- [ ] Lv1 の 4 予約行がシードされ、削除・コード変更ができない
- [ ] Lv2 費目を追加すると `externalCategory` が親から自動継承される
- [ ] 多言語名（日英中越）が保存・表示される
- [ ] `standardAmount` / `calculationType` が葉ノードで設定できる
- [ ] 階層フィルタ（大分類でドリルダウン）が動作する

---

## 10. 残論点（要 慎太郎さん確認）

1. マスター名 `CostCategory` でよいか（A-1）。
2. Lv1 を「予約行 + `externalCategory` enum 属性」で持つ設計でよいか、それとも `ExternalCostCategory` enum も廃止して完全データ駆動にするか（C-1 / C-3）。
3. `InternalCostCategory` enum の即時廃止でよいか、Phase 1B まで併存させるか（C-2）。
4. Lv2 以下の `categoryCode` 採番を手動（先例踏襲）とするか、親プレフィックス付き半自動とするか（D-1）。

---

## 11. 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-05-30 | v0.1 | 初版ドラフト作成 | Shin + Claude |
