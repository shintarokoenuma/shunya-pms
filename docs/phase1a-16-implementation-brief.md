# Phase 1A-16 CostCategory 実装指示書（Claude Code 向け・リネーム＋進化方式）

**対象**: `shunya-production-system`
**前提仕様**: `docs/phase1a-16-spec-confirmation-2026-05-30.md`（v0.2）
**方式**: 既存 `ExpenseCategory` を `CostCategory` へ**リネーム＋階層化**（DROP→CREATE ではない）
**ブランチ**: `feat/phase1a-16-cost-category`（作成済み）

---

## 0. 前提（着手前に確認）

- **環境**: マイグレーション・シードは **dev DB（`postgres-development` = hopper:12921）** のみ。本番は触らない。各 DB 操作の前に `.env` のホストが dev であることを確認する（`docs/SESSION_HANDOVER.md §③` が正）。
- dev DB は `expense_categories` / `quotation_cost_breakdowns` ともに **0 件**(確認済み)→ マイグレーションのデータロスなし。
- 既存実装（12 ファイル）を**活かして改修**する。ゼロから作り直さない。precedent は **ProductCategory / MaterialCategory**（階層マスターの実装パターン）。

---

## 1. 追加の事前 grep（ルート文字列・ラベルの取りこぼし確認）

シンボル grep（前回実施済み）に加え、ルート文字列と日本語ラベルの参照を確認（ナビ・サイドバー・パンくず等の取りこぼし防止）。ヒットは改修対象に含める。

```bash
grep -rn "expense-categories" src --include="*.ts" --include="*.tsx"
grep -rn "諸経費" src --include="*.ts" --include="*.tsx"
```

---

## 2. スキーマ改定（`prisma/schema.prisma`）

`ExpenseCategory` モデル定義を仕様書 v0.2 §5 の `CostCategory` に置換し、enum を改定する。

- モデル `ExpenseCategory` → `CostCategory`、`@@map("expense_categories")` → `@@map("cost_categories")`
- 列リネーム: `expenseCode`→`categoryCode` / `expenseName`→`categoryName` / `expenseNameEn`→`categoryNameEn`
- 列削除: `expenseType`
- 列追加: `parentCategoryId` / `level` / `externalCategory`(`ExternalCostCategory`) / `isSystemReserved`
- 自己参照 relation `CostCategoryHierarchy`（parent / children）追加
- index 改定: `[companyId, expenseType]` を削除し `[companyId, parentCategoryId]` `[companyId, externalCategory]` を追加（`[companyId, status]` は維持）
- enum `ExpenseType` 削除
- enum `ExpenseCategoryStatus` → `CostCategoryStatus`（値は ACTIVE / ARCHIVED のまま）
- `CalculationType`(3値) / `Currency` / `ExternalCostCategory` / `InternalCostCategory` は変更しない

`QuotationCostBreakdown` は変更しない（`expense_category_id` 生列はそのまま残置。Phase 1B で対応）。

---

## 3. マイグレーション（dev）

```bash
# .env が postgres-development を指していることを確認してから
npx prisma format
npx prisma validate
npx prisma migrate dev --name rename_expense_to_cost_category --create-only
```

生成 SQL をレビューし、以下だけが含まれることを確認（他テーブルへの影響がないこと）:

- `expense_categories` の DROP（または rename）+ `cost_categories` の CREATE
- `DROP TYPE "ExpenseType"`、`"ExpenseCategoryStatus"` → `"CostCategoryStatus"` 化
- `expense_categories` 以外のテーブルに DROP/ALTER が出ていないこと（特に `quotation_cost_breakdowns`）

問題なければ適用:

```bash
npx prisma migrate dev
npx prisma generate
```

---

## 4. コード改修（ファイル別）

precedent（ProductCategory / MaterialCategory）の階層マスター実装を参照しながら、`expense`→`cost` / `Expense`→`Cost` にリネームしつつ階層対応ロジックを追加。

### 4.1 リネーム（ディレクトリ・ファイル）

- `src/app/(app)/expense-categories/` → `src/app/(app)/cost-categories/`
  - `_components/expense-categories-table.tsx` → `cost-categories-table.tsx`
  - `_components/expense-categories-search.tsx` → `cost-categories-search.tsx`
  - `_components/expense-category-form.tsx` → `cost-category-form.tsx`
  - `_components/expense-category-delete-button.tsx` → `cost-category-delete-button.tsx`
  - `_components/labels.ts`（維持）
  - `page.tsx` / `new/page.tsx` / `[id]/page.tsx` / `[id]/edit/page.tsx`
- `src/lib/actions/expense-categories.ts` → `src/lib/actions/cost-categories.ts`
- `src/lib/validators/expense-category.ts` → `src/lib/validators/cost-category.ts`
- `src/lib/actions/buyers.ts:19` のコメント参照（`ExpenseCategory` → `CostCategory`）を更新

### 4.2 ロジック追加・変更（precedent に上乗せ）

1. **階層**: `parentCategoryId` / `level` を扱う。フォームに親セレクタ（Lv1 のみ選択可）、一覧を大分類でドリルダウンできる階層表示に（ProductCategory / MaterialCategory の階層 UI を踏襲）。
2. **予約行の保護**: `isSystemReserved = true` の行は archive / 物理削除 / `categoryCode` 変更を server action でガード（UI も無効化）。名称編集のみ許可。新規 Lv1 作成 UI は出さない（Lv1 は予約 4 行のみ）。
3. **externalCategory の継承**: 子作成時に親の `externalCategory` を自動設定（ユーザーに選ばせない／親値に固定）。
4. **expenseType の除去**: フォーム・検索・`labels.ts`・バリデータから `ExpenseType` / `EXPENSE_TYPE_LABELS` を削除。検索フィルタは `externalCategory`（大分類）に置換。
5. **status enum**: `ExpenseCategoryStatus` → `CostCategoryStatus` に追従。
6. **バリデータ**: `categoryCode` / `categoryName` / `categoryNameEn` / `parentCategoryId` / `level` / `externalCategory` / `standardAmount` / `currency` / `calculationType` / `notes` / `status` を反映。`expenseType` を除去。
7. **既存の audit / checkUsage**: `entityType` を `"CostCategory"` に。`checkUsage` の `quotationCostBreakdown` 集計は現状の `expenseCategoryId` 列のまま残す（Phase 1B で `costCategoryId` に変更）。

---

## 5. シード（`scripts/seed-cost-categories.ts` 新規）

仕様書 v0.2 §8 のデータ。既存 seed の作法に倣い冪等（upsert）に。AuditLog 書き込みを含める。`categoryName`（日本語）必須、`categoryNameEn` は Lv1 のみ、Lv2 は null。実行後 Lv1=4 / Lv2=35。

```bash
# .env が dev であることを確認してから
npx tsx scripts/seed-cost-categories.ts
```

---

## 6. 動作確認（dev DB）

### 標準 7（master-patterns §11）

- [ ] 新規作成 / 詳細 / 一覧 / 編集 / アーカイブ / 復元 / 物理削除

### 1A-16 固有

- [ ] 旧 `/expense-categories` への参照（ナビ等）が `/cost-categories` に更新され、404 が出ない
- [ ] Lv1 予約 4 行が seed され、削除・コード変更不可（名称編集のみ可）
- [ ] Lv2 追加時に `externalCategory` が親から自動継承される
- [ ] 大分類でのドリルダウン／フィルタが動作
- [ ] `standardAmount` / `calculationType` を葉ノードで設定できる
- [ ] `npm run build`（型エラーなし。`ExpenseType` 等の旧シンボル残存が無いこと）

---

## 7. PR

- ブランチ: `feat/phase1a-16-cost-category`
- タイトル: `feat: Phase 1A-16 原価費目マスター(CostCategory) 新設（ExpenseCategory リネーム＋階層化）`
- 本文: 仕様書 v0.2 参照 / 方式（リネーム＋進化）/ スコープ（QCB・InternalCostCategory・中越名は Phase 1B 先送り）/ dev 動作確認済み
- マージ: Squash and merge

---

## 8. 停止ポイント（報告して指示を仰ぐ）

- §1 の追加 grep で、ナビ・サイドバー以外に想定外の参照が出た場合
- §3 の生成マイグレーション SQL に `expense_categories` 以外への DROP/ALTER が含まれる場合
- `.env` が dev を指していない場合

上記以外は通しで進めて構わない。完了後、PR URL と動作確認結果を報告。
