# 仕様確認議事録 — S-4b 発注（WO/PO）作成・進行チェックリスト紐付け（v1.0 確定版）

- 作成日: 2026-06-08 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v1.0（確定・S-4b-1 実装着手可能）**
- 位置づけ: S-4 の第2段。S-4a（schema 受け皿・本番反映済み）の上に、サンプルラウンド起点で WO/PO を起票し進行チェックリストのタスクに紐付ける操作系を作る。
- 上位仕様: `docs/specs/s-4-order-linkage-spec-confirmation-v1_0-2026-06-08.md`（D1〜D6）/ 親 `product-sample-spec-confirmation-v1_0-2026-06-06.md` §6
- 前提（live 確認済み・2026-06-08）:
  - S-4a の schema 受け皿が **main・本番に反映済み**（migration `20260607181752` 本番適用確認済み・23 migrations）。
  - **WO/PO はグリーンフィールド**: server actions・画面ルートともに未実装。進行チェックリスト UI（`progress-checklist.tsx:254-258`）に非活性「発注書」ボタン（`title="S-4 で実装予定"`）が位置だけ確保済み。
  - マスター削除ガードの WO/PO usage は **0 ハードコード**（`factories.ts`/`contractors.ts` の `workOrderCount:0`、`suppliers.ts` の `purchaseOrderCount:0`、「将来追加」コメント付き）。
  - 既存の発注先マスター actions（`factories.ts`/`suppliers.ts`/`contractors.ts`）は select 再利用可。
  - `WorkOrder.patternWoId`/`sewingWoId` は AuditLog snapshot で読むのみ（`sample-productions.ts:579-580`）。S-4 の紐付け（伝票側 `progressTaskId`）とは別系統。

> 設計の重要前提: WO/PO は**業務トランザクション**であり、`shunya-master-patterns.md` §1 の非適用範囲。マスターの8関数構成・住所4分割等はそのまま当てはめない。流用するのは ActionResult 型・保存時確定採番・auditLog 記録・archive/物理削除ガードの規律のみ。

---

## 0. このドキュメントの読み方

- 「✓ 確定」= 慎太郎さんと合意済み（E1〜E8）。
- S-4b は **migration 見込み無し**（S-4a で受け皿は投入済み）。schema 無変更で進める想定。着手時に横断 grep で schema 真値を再確認し、もし不足列があれば実装前に報告。
- PR 必須。dev 検証 → 本番。

---

## 1. S-4b のスコープと分割（E7・✓ 確定）

WO/PO がゼロからのため重い。**2分割**する。各々が S-1（Product CRUD）級。

| 段階 | 内容 | 主な成果物 |
|---|---|---|
| **S-4b-1** | PO 系（先行） | PurchaseOrder + PoItem の採番・CRUD actions・作成UI。FABRIC/TRIM/BODY タスクから起票し `progressTaskId`/`sampleProductionId` を結ぶ。費目・売り立て区分・現物資産/保管期限の入力。`suppliers.ts` の `purchaseOrderCount` 実値化（E8） |
| **S-4b-2** | WO 系 | WorkOrder + WoItem の採番・CRUD actions・作成UI。PATTERN/SEWING/PROCESSING タスクから起票し `progressTaskId`/`processingTypeId` を結ぶ。費目・売り立て区分の入力。`factories.ts`/`contractors.ts` の `workOrderCount` 実値化（E8） |

PO を先行する理由: 生地/付属/ボディが案件で最初に動く発注。現物資産（版＝PoItem）も PO 側。E1〜E5 の確定材料が一番揃う。

本書は **S-4b-1（PO 系）を確定仕様として詳述**。S-4b-2 は方針確定のみ（詳細は着手時に詰める）。

### S-4b でやらないこと（S-4c 送り）

- **自動算出**（`recomputeTaskStatus`）= AUTO_FROM_DOC。**S-4b では紐付けてもタスク status は手動のまま**（自動 DONE 化しない）。
- 発注書ボタンの「PDF 出力・送付」フロー。S-4b は「起票して結ぶ」まで。ボタン活性化＝作成画面への導線までは S-4b に含むが、伝票完了→タスク自動チェックは S-4c。
- コスト集計（SampleProduction.totalXxxCost への反映）。

---

## 2. 確定事項（E1〜E8）

### E1. 紐付けの起点UI（✓ 確定）

進行チェックリストの**各タスク行に「発注を作成」ボタン**（S-3 の非活性「発注書」ボタンを活性化）。taskType で伝票種別を自動判定:
- FABRIC / TRIM / BODY → **PO**（S-4b-1）
- PATTERN / SEWING / PROCESSING / GRADING → **WO**（S-4b-2）

行起点のため「どのタスクの伝票か」が自明。作成時に `progressTaskId`（そのタスク）と `sampleProductionId`（そのラウンド）を自動で埋める。

### E2. 多重度（✓ 確定）

- **1タスクに複数伝票を許す**（分割発注。生地を2社に分けたら FABRIC タスクに PO が2本ぶら下がる）。
- **1伝票は1タスクに紐付く**（`progressTaskId` は単一カラム）。1伝票が複数タスクにまたがるケースは S-4b では持たない。
- UI: タスク行の下に紐づく伝票を列挙表示。

### E3. 作成フォームの粒度（✓ 確定：最小限から）

S-4b は「伝票を起こして品番/ラウンド/タスクに正しく結ぶ」が主目的。フォームは必須項目に絞る:
- 発注先（PO=supplier / WO=factory or contractor）
- タイトル / 摘要（任意）
- 明細1行以上（PoItem/WoItem）
- 明細ごとに費目（costCategoryId）・売り立て区分（billingClassification）
- 通貨（既定 JPY）・納期（任意）

作り込まない（後続）: 金額の自動集計・JPY 換算・PDF 出力・送付（email/fax）フロー・承認ワークフロー・配分（SHARED/STOCK）・国際送金。理由: サンプル起点に絞る仕様 v1.0 §6 を守り、量産発注並みの肥大化を避ける。

### E4. 採番（✓ 確定）

`PO-2026-0001` / `WO-2026-0001`。**保存時確定・選択時プレビュー**方式（ModelCode/Product/SP と統一）。連番は `companyId × 年` 単位・4桁ゼロ埋め。transaction 内で再計算・確定。schema は既存 `poNumber`/`woNumber`（VarChar50・`@@unique([companyId, poNumber/woNumber])`）を使用。

### E5. 版類の現物資産入力（✓ 確定：S-4b-1 に含む）

PO 作成フォームの明細行（PoItem）に「現物資産チェック（`isPhysicalAsset`）＋保管開始日（`assetStorageStartDate`）／保管期限（`assetStorageExpiryDate`）」を出す。版・型・刺繍パンチの PO はサンプル起点でまさに S-4b-1 で起票するため同フォームで入力。在庫一覧・再利用判定 UI は B-023（後続）のまま。

### E6. 既存 WO/PO 画面との関係（✓ 確定：grep 結果に基づく）

WO/PO はグリーンフィールド（actions・画面ともゼロ）。よって S-4b で**新規にゼロから作る**。既存の流用は発注先マスターの select のみ。一覧/詳細画面は最小限（サンプル起点の確認に足る範囲）から。

### E7. S-4b の分割（✓ 確定）

§1 のとおり S-4b-1（PO）→ S-4b-2（WO）。

### E8. マスター削除ガードの実値化（✓ 確定：各系統で同時回収）

- S-4b-1（PO）で `suppliers.ts` の `purchaseOrderCount` を実値化（その supplier に紐づく PO 件数を数える）。
- S-4b-2（WO）で `factories.ts`/`contractors.ts` の `workOrderCount` を実値化。
- 理由: その系統の actions を作るついで。発注が紐づく発注先を誤って物理削除できる穴を開けっぱなしにしない。

---

## 3. S-4b-1（PO 系）実装スコープ（確定）

### 3-1. server actions（`src/lib/actions/purchase-orders.ts` 新規）

トランザクション伝票としての関数構成（マスター8関数とは別物）:

| 関数 | 役割 |
|---|---|
| `listPurchaseOrders` | 一覧（品番/ラウンド/タスク/supplier/status で絞り込み） |
| `getPurchaseOrder` | 詳細（PoItem 群含む・明示クエリ） |
| `createPurchaseOrder` | 新規（採番・PoItem 同時作成・progressTaskId/sampleProductionId 紐付け・auditLog） |
| `updatePurchaseOrder` | 更新（明細・費目・売り立て区分・現物資産含む） |
| `deletePurchaseOrder` | soft-delete（`deletedAt`。SampleProduction/ProgressTask 系の方針に揃える） |
| （`recomputeTaskStatus` 連携は呼ばない） | S-4b では status 手動。AUTO は S-4c |

- ActionResult 型（`{ ok, error }`）に統一。
- house style: `@relation` 不使用・明示クエリ・一括 in 句結合（N+1回避）。
- `checkSupplierUsage`（`suppliers.ts`）の `purchaseOrderCount` を実値化（E8）。

### 3-2. バリデータ（`src/lib/validators/purchase-order.ts` 新規）

- `purchaseOrderInputSchema` / `PurchaseOrderInput` / `PurchaseOrderFormValues`。
- PoItem 明細配列（1行以上必須）。各行: materialId? or customItemName / quantity / unit / unitPrice / costCategoryId? / billingClassification? / isPhysicalAsset / assetStorageStartDate? / assetStorageExpiryDate?。
- 現物資産チェック時のみ保管日付を促す（必須化はしない＝任意運用）。

### 3-3. UI

- 起点: 進行チェックリストのタスク行（FABRIC/TRIM/BODY）の「発注を作成」ボタン → PO 作成画面へ（`progressTaskId`/`sampleProductionId` をクエリ or props で渡す）。
- `purchase-order-form.tsx`（最小カード構成: 発注先 / 基本情報 / 明細テーブル / 費目・売り立て区分・現物資産）。
- ルート: `src/app/(app)/purchase-orders/`（一覧 `page.tsx` / 作成 `new/page.tsx` / 詳細 `[id]/page.tsx`）。最小限。
- 進行チェックリスト側: タスク行に紐づく PO を列挙表示（E2）。
- ナビゲーション追加は最小限（必要なら nav-items に「発注（PO）」）。

### 3-4. 採番

`generatePoNumber(companyId, year)` を transaction 内で実行。`PO-{年}-{連番4桁}`。SP 採番（`sample-productions.ts`）の保存時確定ロジックを参照実装にする。

---

## 4. S-4b-2（WO 系）方針（確定のみ・詳細は着手時）

- `src/lib/actions/work-orders.ts` / `src/lib/validators/work-order.ts` / `src/app/(app)/work-orders/`。
- 起点: PATTERN/SEWING/PROCESSING タスク行の「発注を作成」→ WO 作成。
- PROCESSING タスクから起票時は、そのタスクの `processingTypeId` を WO の `processingTypeId` に引き継ぐ（D2 の突合）。
- 発注先: PATTERN→contractor（パタンナー）/ SEWING→factory / PROCESSING→factory or contractor。
- `factories.ts`/`contractors.ts` の `workOrderCount` 実値化（E8）。
- 採番 `WO-{年}-{連番4桁}`。
- 既存 `patternWoId`/`sewingWoId`（SampleProduction）との関係: 別系統として温存。S-4 の正は `progressTaskId` 経由。必要なら将来整理（バックログ判断）。

---

## 5. 安全・Git

- migration 見込み無し。着手時に横断 grep で S-4a の受け皿列が main に揃っていること（progressTaskId/sampleProductionId/costCategoryId/billingClassification/isPhysicalAsset/assetStorage*）を確認。
- PR 必須（コード変更）。論理層コミット → UI コミット → PR。dev 検証 → 本番はマージ（=自動デプロイ）。
- dev 検証: PO を1件作成し、FABRIC タスクに紐づくこと・supplier usage カウントが実値化されることを確認。dev データ（progress_tasks=10）は温存（掃除は S-4c 直前）。

---

## 6. 確定状況

| # | 論点 | 確定 |
|---|---|---|
| E1 | 起点UI | タスク行の「発注を作成」ボタン。taskType で WO/PO 自動判定 |
| E2 | 多重度 | 1タスク複数伝票可。1伝票1タスク（progressTaskId 単一） |
| E3 | フォーム粒度 | 最小限（発注先・明細・費目・売り立て区分）。PDF/送付/集計は後続 |
| E4 | 採番 | PO-/WO-{年}-{4桁}・保存時確定 |
| E5 | 現物資産入力 | S-4b-1 の PO 明細フォームに含む |
| E6 | 既存画面 | グリーンフィールド・新規作成 |
| E7 | 分割 | S-4b-1（PO）→ S-4b-2（WO） |
| E8 | 削除ガード | 各系統で usage カウント実値化 |

→ 本書 v1.0 確定。次は **S-4b-1 実装ブリーフ**（Claude Code 向け・【対象プロジェクト】ヘッダ固定・コードブロック出力）を作成する。

---

## 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-06-08 | v1.0 | S-4b 確定。E1〜E8（起点UI・多重度・最小フォーム・採番・現物資産・グリーンフィールド・PO先行分割・削除ガード実値化）。S-4b-1 詳述・S-4b-2 方針 | 慎太郎さん + Claude |
