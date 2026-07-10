# Phase 1A-16 CostCategory（原価費目マスター）仕様確定議事録

**作成日**: 2026 年 5 月 30 日
**バージョン**: v0.2（確定）
**ステータス**: 設計確定・実装着手可
**前提環境**: dev DB（`postgres-development`）優先、本番は smoke test のみ

---

## 1. 目的

既存の `ExpenseCategory`（諸経費マスター）を、**全コスト費目を扱う階層マスター `CostCategory`（原価費目マスター）へリネーム・進化**させる。本システムの 2 大原則「全業務が連動して 2 度手間を防ぐ」「AI を駆使した自動化」を、コスト分類の基盤レベルで実現する。

---

## 2. v0.1 からの訂正（重要）

v0.1 は 2026-05-16 時点のスキーマスナップショットに基づいており、その後ライブのリポジトリで `ExpenseCategory` が実装された事実を反映できていなかった。Claude Code による read-only 確認で以下が判明し、訂正する。

| # | v0.1 の記述（誤） | 確定事実（正） |
|---|---|---|
| 1 | ExpenseCategory は実装未着手・データ 0 件 | **コードは実装済み**（schema + actions + validators + ページ4枚 + コンポーネント6枚、計12ファイル）。ただし **dev DB は 0 件** |
| 2 | `CalculationType` は FIXED/PER_UNIT/PERCENTAGE/WEIGHT_BASED… | **3 値のみ**（FIXED / PER_UNIT / PERCENTAGE） |
| 3 | status は VarChar 文字列 | 専用 enum **`ExpenseCategoryStatus`**（ACTIVE / ARCHIVED）が存在 |
| 4 | 多言語名を日英中越 4 言語で持たせる | 既存実装・precedent は **日英のみ**。中越は Phase 1B（見積もり PDF 構築時）へ先送り |
| 5 | `showToClientDefault` 列を追加 | 1A-16 のスコープ外（Phase 1B）。今回は追加しない |
| 6 | `QuotationCostBreakdown.expenseCategoryId` は要改名 | 現状は relation 宣言のない生 `String?` 列。データ 0 件。**1A-16 では一切触らず Phase 1B へ先送り** |

実装方式も「DROP→CREATE（新規）」から「**リネーム＋進化（既存資産を活かす）**」へ変更する。

---

## 3. 確定方針（慎太郎さん承認済み）

- コスト費目は enum ではなく**マスター（テーブル）に統一**する。
- マスター名を `ExpenseCategory` → **`CostCategory`** に正式リネーム（案 R）。データ 0・実装直後の今が改名の最終好機。
- 4 大分類（材料費・縫製費・加工費・諸経費）は固定だが配下の費目は増える前提で、**単一の階層マスター**に集約。
- 既存の CRUD コード資産（precedent: ProductCategory / MaterialCategory）を活かし、進化型で改修する。

---

## 4. 確定事項サマリー

| # | 論点 | 決定 |
|---|---|---|
| A-1 | マスター名 | `ExpenseCategory` → `CostCategory`（テーブル `cost_categories`） |
| A-2 | 適用範囲 | 全コスト費目（材料費・縫製費・加工費・諸経費） |
| B-1 | 階層 | `parentCategoryId` + `level` の自己参照（ProductCategory / MaterialCategory と同型） |
| B-2 | Lv1 | 4 大分類を**システム予約行**（`isSystemReserved`）として配置。削除・コード変更不可、名称編集のみ可 |
| B-3 | Lv2 以下 | 個別費目。N 階層許容、初期シードは 2 階層 |
| C-1 | 社外集約キー | 各行に `externalCategory`（`ExternalCostCategory` enum）を保持。子は親から継承 |
| C-2 | `ExpenseType` enum | **廃止**し、値をマスターの Lv2 シード行へ移す |
| C-3 | `ExpenseCategoryStatus` enum | `CostCategoryStatus` へリネーム（型安全維持） |
| C-4 | `CalculationType` / `Currency` / `ExternalCostCategory` | enum 維持（振る舞い軸・固定値） |
| C-5 | `InternalCostCategory` enum | **今回は維持**。Phase 1B で QCB を costCategoryId に切替時に廃止 |
| D-1 | 採番 | Lv1 は予約コード（`MATERIAL` 等）、Lv2 以下は手動 `categoryCode`（先例踏襲） |
| D-2 | 多言語名 | 日英のみ（既存踏襲）。中越は Phase 1B |
| D-3 | 標準金額・計算方法 | 主に葉ノードで設定。Lv1・中間は原則 null |
| E-1 | QuotationCostBreakdown | 1A-16 では変更しない（Phase 1B で costCategoryId 化） |

---

## 5. ターゲットスキーマ（Prisma）

```prisma
// =====================================================
// 原価費目マスター（旧 ExpenseCategory をリネーム・階層化）
// =====================================================

/// 原価費目マスター
/// 材料費・縫製費・加工費・諸経費の4大分類(Lv1)配下に費目を階層管理する。
/// 見積もり原価明細はこのマスターを参照し、標準金額・計算方法・社外集約
/// カテゴリを自動取得する（2度手間防止）。※連動の実装は Phase 1B。
model CostCategory {
  id        String @id @default(uuid())
  companyId String @map("company_id")

  categoryCode   String  @map("category_code") @db.VarChar(50)
  categoryName   String  @map("category_name") @db.VarChar(100)
  categoryNameEn String? @map("category_name_en") @db.VarChar(100)

  // 階層構造
  parentCategoryId String? @map("parent_category_id")
  level            Int     @default(1)

  // 社外集約キー（4大分類。固定値のため enum。子は親から継承し保持）
  externalCategory ExternalCostCategory @map("external_category")

  // システム予約行（4大分類。削除・コード変更不可、名称編集のみ可）
  isSystemReserved Boolean @default(false) @map("is_system_reserved")

  // 標準値（主に葉ノードで設定）
  standardAmount  Decimal?        @map("standard_amount") @db.Decimal(15, 2)
  currency        Currency        @default(JPY)
  calculationType CalculationType @default(FIXED) @map("calculation_type")

  notes  String?            @db.Text
  status CostCategoryStatus @default(ACTIVE)

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  // 自己参照
  parent   CostCategory?  @relation("CostCategoryHierarchy", fields: [parentCategoryId], references: [id])
  children CostCategory[] @relation("CostCategoryHierarchy")

  @@unique([companyId, categoryCode])
  @@index([companyId, status])
  @@index([companyId, parentCategoryId])
  @@index([companyId, externalCategory])
  @@map("cost_categories")
}

enum CostCategoryStatus {
  ACTIVE
  ARCHIVED
}
```

維持: `CalculationType`（3 値）、`Currency`、`ExternalCostCategory`、`InternalCostCategory`（Phase 1B まで）。
廃止: `ExpenseType`。リネーム: `ExpenseCategoryStatus` → `CostCategoryStatus`。

---

## 6. リネーム対応表（旧 → 新）

| 区分 | 旧 | 新 |
|---|---|---|
| モデル | `ExpenseCategory` | `CostCategory` |
| テーブル | `expense_categories` | `cost_categories` |
| 列 | `expenseCode` / `expense_code` | `categoryCode` / `category_code` |
| 列 | `expenseName` / `expense_name` | `categoryName` / `category_name` |
| 列 | `expenseNameEn` / `expense_name_en` | `categoryNameEn` / `category_name_en` |
| 列 | `expenseType`（削除） | （階層 + `externalCategory` で代替） |
| 列（新規） | — | `parentCategoryId` / `level` / `externalCategory` / `isSystemReserved` |
| enum | `ExpenseType`（削除） | — |
| enum | `ExpenseCategoryStatus` | `CostCategoryStatus` |
| ルート | `/expense-categories` | `/cost-categories` |

---

## 7. 移行方式

- データ 0 件のため、`prisma migrate dev` が生成する DROP/CREATE は**データロスなし**。`expense_categories` と `ExpenseType` / `ExpenseCategoryStatus` enum が落ち、`cost_categories` + `CostCategoryStatus` が作られる想定。
- `QuotationCostBreakdown` は 1A-16 で変更しない（`expense_category_id` 生列は残置）。
- 生成マイグレーション SQL を必ずレビューし、上記以外のテーブルに影響が及んでいないことを確認してから適用。
- 動作確認は dev DB 優先、本番は smoke test のみ。

---

## 8. シード（`scripts/seed-cost-categories.ts`）

冪等（upsert）。`companyId` は既存シードと同方式で取得。AuditLog 書き込みを含める。実行後件数: Lv1 = 4 / Lv2 = 35。

### Lv1（予約 4 行・`isSystemReserved = true`・`level = 1`）

`MATERIAL` 材料費 / `SEWING` 縫製費 / `PROCESSING` 加工費 / `OVERHEAD` 諸経費（`externalCategory` は同名）

### Lv2（`level = 2`、`externalCategory` は親と同値、手動コード）

- **MATERIAL**: MAIN_FABRIC 本体生地 / LINING 裏地 / INTERLINING 芯地 / ZIPPER ファスナー / BUTTON ボタン / THREAD 糸 / ACCESSORY その他副資材 / LABEL ラベル・ネーム類 / PACKAGING 包装材
- **SEWING**: REGULAR_SEWING 通常縫製 / SPECIAL_SEWING 特殊縫製 / FINISHING 仕上げ
- **PROCESSING**: PRINTING プリント / EMBROIDERY 刺繍 / WASHING 洗い加工 / DYEING 染色 / SPECIAL_PROCESSING 特殊加工
- **OVERHEAD**: PATTERN_FEE パターン代 / GRADING_FEE グレーディング代 / SAMPLE_FEE サンプル製作費 / INSPECTION_FEE 検品費 / DOMESTIC_TRANSPORT 国内輸送費 / INTERNATIONAL_TRANSPORT 国際輸送費 / CUSTOMS_FEE 通関費 / TARIFF 関税 / IMPORT_TAX 輸入消費税 / STORAGE_FEE 保管費 / INSURANCE 保険料 / REMITTANCE_FEE 送金手数料 / FX_LOSS 為替差損 / ROYALTY ロイヤリティ / PHOTOGRAPHY_FEE 撮影費 / DESIGN_FEE デザイン費 / RENTAL_FEE レンタル費 / OTHER_OVERHEAD その他諸経費

`categoryName`（日本語）は必須。`categoryNameEn` は Lv1 のみ設定（Material/Sewing/Processing/Overhead）、Lv2 は null（運用で追加）。翻訳の創作はしない。

---

## 9. Phase 1B 申し送り

- `QuotationCostBreakdown.expenseCategoryId` → `costCategoryId`（FK 化、`@relation` 宣言）
- `QuotationCostBreakdown.internalCategory`（`InternalCostCategory`）列を廃止し `costCategoryId` に一本化
- `enum InternalCostCategory` の削除
- 多言語名 `categoryNameZh` / `categoryNameVi` の追加（見積もり PDF 4 言語対応）
- 見積もり作成時、`costCategoryId` 選択で standardAmount / calculationType / externalCategory を自動充填するロジック

---

## 10. 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-05-30 | v0.1 | 初版ドラフト（スキーマ前提に誤りあり） |
| 2026-05-30 | v0.2 | ライブ実装・dev 件数・enum 実体の確定事実を反映。リネーム＋進化方式に改訂。案 R 確定 |
