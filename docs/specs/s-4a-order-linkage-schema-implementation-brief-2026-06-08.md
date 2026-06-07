【対象プロジェクト】shunya-pms（生産管理システム）
  - リポジトリ: shintarokoenuma/shunya-pms
  - ローカルパス: ~/shunya-production-system
  - 本番URL: shunya-pms-web-production.up.railway.app
  - ※ saagara-v2（saagara-v2-production / 別リポジトリ）とは別物。
    このウィンドウが ~/shunya-production-system を開いているか着手前に必ず目視確認すること。

---

# S-4a 実装指示書 — 発注（WO/PO）連携の schema 受け皿

- 日付: 2026-06-08
- 上位仕様: `docs/specs/s-4-order-linkage-spec-confirmation-v1_0-2026-06-08.md`（保存後・main）/ 親 `docs/specs/product-sample-spec-confirmation-v1_0-2026-06-06.md` §3・§6
- 段階: 業務トランザクション「最初の山」の S-4 のうち **S-4a（schema 拡張のみ）**。順序は S-4a → S-4b（作成UI/紐付け）→ S-4c（自動算出/発注書ボタン活性化）。
- 前提: **migration あり**（新規 enum 追加 + 既存5モデルへ列追加）。すべて**追加のみ・nullable/default 付き＝非破壊**。
- ブランチ: main 最新（`996359f` 以降）から `feature/s-4a-order-linkage-schema` を新規に切る。
- Git運用: コードを含むため **PR 必須**（main 直 push 禁止）。schema コミット → migration コミット（1 PR）。
- **重要（停止ポイント）**: 本ブリーフは **dev での migrate + 検証 + PR 作成まで**。**マージ＝Railway 本番自動デプロイ＝本番 migration 自動適用（不可逆）**なので、**マージはしない**。PR 作成後に慎太郎さん（Claude.ai）へ報告して止まること。

---

## 0. 最初にやること（着手前ガード・順守）

1. **ウィンドウ確認**: VS Code が `~/shunya-production-system` を開いているか目視。saagara-v2 でないこと。
2. **ブランチ作成**:
   ```
   cd ~/shunya-production-system
   git checkout main && git pull origin main
   git checkout -b feature/s-4a-order-linkage-schema
   ```
3. **スキーマ真値確認（最重要・schema 変更前に必ず）**: 以下を実物 grep で確認。1つでも想定と食い違ったら**編集せず慎太郎さん（Claude.ai）に報告**。
   ```
   # 既存モデル（追加先）の現状
   awk '/^model WorkOrder \{/,/^\}/' prisma/schema.prisma
   awk '/^model PurchaseOrder \{/,/^\}/' prisma/schema.prisma
   awk '/^model PoItem \{/,/^\}/' prisma/schema.prisma
   awk '/^model WoItem \{/,/^\}/' prisma/schema.prisma
   # ProgressTask の taskType enum（BODY を足す先）
   awk '/^enum ProgressTaskType \{/,/^\}/' prisma/schema.prisma
   # evidenceMode enum 実名と値（D1 の前提確認・1行）
   grep -n "enum ProgressTaskEvidenceMode" -A 6 prisma/schema.prisma
   # 参照先マスターの存在確認
   grep -n "model ProcessingType\|model CostCategory" prisma/schema.prisma
   ```
   想定真値（2026-06-08 grep 済み）:
   - `WorkOrder` に `processingTypeId` / `progressTaskId` は**無い**（これから足す）。`samplProductionId`（綴りミス）は**温存・触らない**（B-035）。
   - `PurchaseOrder` に `sampleProductionId` / `progressTaskId` は**無い**（これから足す）。
   - `PoItem` / `WoItem` に費目・売り立て区分・現物資産・保管期限は**無い**（これから足す）。
   - `ProgressTaskType` に `BODY` は**無い**（これから足す）。SAMPLE phase 群 = QUOTE/SPEC_LOCK/PATTERN/FABRIC/TRIM/SEWING/PROCESSING/INSPECTION/CLIENT_REVIEW。
   - `ProgressTaskEvidenceMode` = `AUTO_FROM_DOC / MANUAL` の2値であること（違ったら報告）。
   - `ProcessingType` / `CostCategory` モデルが存在すること（FK 参照先）。

4. **設計方針（house style 順守・厳守）**:
   - 追加するFK列は**スカラー列のみ**（`@relation` は張らない）。本リポジトリは既存方針どおりリレーション不使用・明示クエリ・一括 in 句結合（S-2 で確立）。`@@index` は張る。
   - **本ブリーフは schema + migration のみ。** server actions / UI / `recomputeTaskStatus` には一切触らない（S-4b/S-4c の領分）。`prisma generate` で型が更新され既存コードがビルド通ることだけ確認する。

---

## 1. schema 変更（確定リスト）

### 1-1. 新規 enum（BillingClassification）

`PurchaseOrder` / `WorkOrder` 周辺の enum 群の近くに追加。

```prisma
/// 売り立て区分（S-4・仕様 §6-2）
/// 明細（PoItem/WoItem）ごとに、製品単価に溶かすか個別計上かを持つ。
enum BillingClassification {
  INDIVIDUAL_BILLING  // 個別売り立て（パターン代・版代・型代・刺繍パンチ代・グレーディング代）
  UNIT_PRICE_INCLUDED // 製品単価にインクルード（洗い・プリント等の加工工賃）
}
```

### 1-2. ProgressTaskType に BODY 追加

SAMPLE phase 群の中、`TRIM` の直後に追加（PO 起点・材料系のため FABRIC/TRIM の並びに置く）。

```prisma
  // 既存 ... FABRIC / TRIM の後に:
  BODY // ボディ仕入（既製の縫製済みボディを現物仕入・PO起点・isReceived・D6）
```

### 1-3. WorkOrder への列追加

`model WorkOrder { ... }` 内、関連エンティティ群の近くに追加。

```prisma
  // 進行チェックリスト紐付け（S-4・D1。タスク側ではなく伝票側に持つ）
  progressTaskId   String? @map("progress_task_id")
  // 加工種別マスター参照（S-4・D2。workType=PROCESSING系のとき ProcessingType を指す）
  processingTypeId String? @map("processing_type_id")
```
`@@index` に追加:
```prisma
  @@index([progressTaskId])
  @@index([companyId, processingTypeId])
```

### 1-4. PurchaseOrder への列追加

`model PurchaseOrder { ... }` 内、関連エンティティ群の近くに追加。

```prisma
  // 進行チェックリスト紐付け（S-4・D1）
  progressTaskId     String? @map("progress_task_id")
  // サンプル製作セット（ラウンド）紐付け（S-4・D3。生地/付属/ボディ PO をラウンドに結ぶ）
  sampleProductionId String? @map("sample_production_id")
```
`@@index` に追加:
```prisma
  @@index([progressTaskId])
  @@index([companyId, sampleProductionId])
```

### 1-5. PoItem への列追加

`model PoItem { ... }` 内に追加。

```prisma
  // 費目（S-4・D4。CostCategory 参照・スカラー列）
  costCategoryId        String?                @map("cost_category_id")
  // 売り立て区分（S-4・D4）
  billingClassification BillingClassification? @map("billing_classification")
  // 現物資産（版・型・刺繍パンチ等。S-4・D4 / 仕様 §6-3。本格在庫管理は B-023）
  isPhysicalAsset       Boolean                @default(false) @map("is_physical_asset")
  assetStorageStartDate  DateTime?             @map("asset_storage_start_date") @db.Date
  assetStorageExpiryDate DateTime?             @map("asset_storage_expiry_date") @db.Date
```
`@@index` に追加:
```prisma
  @@index([costCategoryId])
```

### 1-6. WoItem への列追加

`model WoItem { ... }` 内に追加。

```prisma
  // 費目（S-4・D4）
  costCategoryId        String?                @map("cost_category_id")
  // 売り立て区分（S-4・D4）
  billingClassification BillingClassification? @map("billing_classification")
```
`@@index` に追加:
```prisma
  @@index([costCategoryId])
```

> いずれも nullable または `@default` 付き＝**追加のみの非破壊変更**。既存行のバックフィル不要。

---

## 2. migration（dev）

1. schema 保存後、**dev で**生成・適用:
   ```
   # .env の DATABASE_URL が dev（hopper.proxy.rlwy.net:12921）であることを必ず確認してから
   grep -E "^DATABASE_URL=" .env | sed -E 's#.*@([^/?]+).*#host=\1#'   # → hopper:12921 を目視
   npx prisma migrate dev --name add_s4a_order_linkage_receptacles
   ```
2. **生成された migration SQL を必ず目視レビュー**し、本文を慎太郎さん（Claude.ai）に貼って報告:
   ```
   cat prisma/migrations/*add_s4a_order_linkage_receptacles*/migration.sql
   ```
   期待: `ALTER TABLE ... ADD COLUMN`（すべて nullable または default 付き）と `CREATE TYPE "BillingClassification"`、`ALTER TYPE "ProgressTaskType" ADD VALUE 'BODY'`、`CREATE INDEX` のみ。`DROP` / `NOT NULL 化` / 既存列の型変更が出たら**異常＝止めて報告**。
3. `npx prisma generate` で型更新。
4. **ビルド確認**: `npm run build`（または `npx tsc --noEmit`）が通ること。既存コードに型エラーが出ないこと（S-4a はロジック未変更なので通るはず。通らなければ報告）。

> enum への `ADD VALUE`（BODY）は PostgreSQL では問題なく追加可。`migrate dev` が単独 migration として生成すれば OK。

---

## 3. dev 検証（schema レベル）

UI は無いので、psql で列・型・enum の存在確認のみ（read-only）。

```
# dev（hopper:12921）であることを確認のうえ
DBURL=$(grep -E "^DATABASE_URL=" .env | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')
echo "host=$(echo "$DBURL" | sed -E 's#.*@([^/?]+).*#\1#')"   # hopper:12921

# 追加列の存在
psql "$DBURL" -c "\d work_orders"   | grep -E "progress_task_id|processing_type_id"
psql "$DBURL" -c "\d purchase_orders"| grep -E "progress_task_id|sample_production_id"
psql "$DBURL" -c "\d po_items"      | grep -E "cost_category_id|billing_classification|is_physical_asset|asset_storage_(start|expiry)_date"
psql "$DBURL" -c "\d wo_items"      | grep -E "cost_category_id|billing_classification"
# enum 値
psql "$DBURL" -tA -c "SELECT enum_range(NULL::\"BillingClassification\");"
psql "$DBURL" -tA -c "SELECT 'BODY in ProgressTaskType=' || ('BODY' = ANY(enum_range(NULL::\"ProgressTaskType\")::text[]));"
# migrate status（dev・ドリフト無し確認）
npx prisma migrate status 2>&1 | tail -4
```

期待: 列がすべて存在、`BillingClassification` = `{INDIVIDUAL_BILLING,UNIT_PRICE_INCLUDED}`、`BODY in ProgressTaskType=t`、migrate status が up to date。

> 既存の dev データ（progress_tasks=10 / processing_types=2）は S-4a では触らない・温存。掃除は S-4c 直前に別途。

---

## 4. PR 作成（ここで停止）

```
git add -A
git commit -m "feat: S-4a 発注連携 schema 受け皿（WO/PO progressTaskId・PO sampleProductionId・WO processingTypeId・明細 費目/売り立て区分・PoItem 現物資産/保管期限・ProgressTaskType BODY）"
git push -u origin feature/s-4a-order-linkage-schema
gh pr create --title "S-4a: 発注(WO/PO)連携の schema 受け皿" --body "上位仕様 docs/specs/s-4-order-linkage-spec-confirmation-v1_0-2026-06-08.md。schema 追加のみ（非破壊）。詳細は本文参照。" 
```

PR の URL を慎太郎さんに報告し、**ここで停止**。マージはしない。

報告に含めること:
- 生成された migration.sql の全文（§2-2）
- dev 検証の出力（§3）
- `npm run build` 結果
- PR URL

> マージ＝本番反映は慎太郎さん判断（shunya-pr-url-checklist の3点セット）。本 migration は全列 nullable/default ＝非破壊なので、マージ時に Railway の `migrate deploy` が本番へ自動適用しても安全（既存データへの影響なし）。本番反映後は Railway デプロイログで `add_s4a_order_linkage_receptacles` の適用を目視確認する。

---

## 5. S-4a がやらないこと（スコープ境界・厳守）

- WO/PO の作成UI・サンプルからの紐付け操作 → **S-4b**
- `recomputeTaskStatus` の中身（AUTO_FROM_DOC 自動算出）→ **S-4c**
- 発注書ボタンの活性化 → **S-4c**
- コスト集計（SampleProduction.totalXxxCost への反映）→ **S-4c**
- `WorkOrder.samplProductionId` のリネーム → **B-035**（別途）
- 案件タイプ別のタスク初期生成の出し分け → **B-036**（別途）

S-4a は「後続が乗るための器（列・enum）を非破壊で足す」ことに徹する。
