# 仕様確認議事録 — S-4 発注（WO/PO）連携 × 進行チェックリスト自動算出（v1.0 確定版）

- 作成日: 2026-06-08 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v1.0（確定・S-4a 実装着手可能）**
- 位置づけ: 業務トランザクション「最初の山」の最終段。S-1（Product）→ S-2（SampleProduction）→ S-3a（ProcessingType）→ S-3（ProgressTask）に続く S-4。S-3 で開けた縫い代3点（伝票側 `progressTaskId?` / `recomputeTaskStatus` 空殻 / 発注書ボタン非活性）に中身を入れ、仕様 v1.0 §6 の受け皿を足す。
- 上位仕様: `docs/specs/product-sample-spec-confirmation-v1_0-2026-06-06.md`（§3 進行チェックリスト / §6 発注連携）が親。本書はその S-4 具体化。
- 前提（live 確認済み・2026-06-08）: `origin/main = 996359f`。S-3（`ec0b339`）本番反映済み（本番 ab6d で 22 migrations / 0 pending）。schema 真値を横断 grep で確認済み。

---

## 0. このドキュメントの読み方

- 「✓ 確定」= 慎太郎さんと合意済み。本 v1.0 ではすべての論点（D1〜D6 + 追加論点）が確定状態。
- S-4 は migration を伴うため、着手時に dev/本番の環境安全確認（safety-check）を全面適用する。dev は `migrate dev` 使用可。本番は別途明示指示 + host 照合（本番 ab6d/shuttle:16099, dev 7492/hopper:12921）+ 三重ガード。
- PR 必須（コード変更を含むため）。dev 検証 → 本番反映。

---

## 1. S-4 のスコープと3分割（D5・✓ 確定）

S-4 は大きいため3段階に割る。schema → CRUD → 自動算出の順で段階投入する。

| 段階 | 内容 | migration | 主な成果物 |
|---|---|---|---|
| **S-4a** | schema 拡張（受け皿） | あり | WO/PO への `progressTaskId?`、PO への `sampleProductionId?`、WO への `processingTypeId?`、明細（PoItem/WoItem）への費目・売り立て区分、PoItem への現物資産フラグ・保管期限、`ProgressTaskType` に `BODY` 追加、売り立て区分 enum 新設 |
| **S-4b** | サンプル起点の WO/PO 作成UI と紐付け | 見込み無変更 | サンプル製作セット（ラウンド）から WO/PO を作成し `progressTaskId` / `sampleProductionId` を結ぶUI。費目・売り立て区分の入力。版類は PO 明細で現物資産＋保管期限を入力 |
| **S-4c** | 自動算出と発注書ボタン活性化 | 見込み無変更 | `recomputeTaskStatus` 実装（AUTO_FROM_DOC）。発注書ボタン活性化。コスト集計（SampleProduction の totalXxxCost 群へ） |

本書は **S-4a を確定仕様として詳述**する。S-4b/S-4c は方針を確定し、詳細は各段階の実装ブリーフ作成時に詰める。

---

## 2. live schema 真値（2026-06-08 grep 確認済み・S-4 の出発点）

- **ProgressTask**（`schema.prisma:1344`）: linked 系 FK を持たない。`schema.prisma:1343` に「伝票連携は S-4 で伝票側に `progressTaskId?` を足す方針」と明記。`evidenceMode` の型実名は **`ProgressTaskEvidenceMode`**（既定 `MANUAL`）。`processingTypeId?` を既に保持。`isReceived?`（FABRIC/TRIM の入荷フラグ）保持。`sampleProductionId?` 保持。
- **ProgressTaskType**（`schema.prisma:1389`）: SAMPLE phase = QUOTE / SPEC_LOCK / PATTERN / FABRIC / TRIM / SEWING / PROCESSING / INSPECTION / CLIENT_REVIEW。PRODUCTION phase = GRADING / SHIPPING / DELIVERY / INVOICE（箱のみ）。
- **WorkOrder**（`schema.prisma:4009`）: `samplProductionId`（**綴りミス**・"e" 抜け、`@map("sample_production_id")` は正）/ `sampleRound` 保持。`workType`(`WorkOrderType`) は SEWING/CUTTING/PRINTING/EMBROIDERY/WASHING/DYEING/FINISHING/PATTERN_MAKING/PATTERN_REVISION/GRADING/SAMPLE_MAKING/ASSEMBLY/INSPECTION/OTHER。`processingTypeId` は **無い**。`progressTaskId` は **無い**。
- **PurchaseOrder**（`schema.prisma:3766`）: `primaryProductId?` 保持。`sampleProductionId` は **無い**。`progressTaskId` は **無い**。明細は `PoItem` / 配分は `PoAllocation`。
- **SampleProduction**（`schema.prisma:4531`）: `patternWoId?` / `sewingWoId?` のみ。コスト集計列 `totalPatternCost/totalMaterialCost/totalSewingCost/totalRevisionCost/totalCost` 保持（S-4c の集計先）。
- **ProcessingType**（`schema.prisma:1303`）: S-3a マスター。`ProgressTask.processingTypeId` の参照先。
- **CostCategory**（`schema.prisma:1437`）: 2 階層・`standardAmount`・`externalCategory`（社外公開用大分類）・`isSystemReserved` を持つ。費目参照に流用可。
- **縫い代の現在地**: `recomputeTaskStatus(_taskId)`（`src/lib/actions/progress-tasks.ts:550`）は空殻（引数未使用）。`generateTasksForRound`（同 :148）は既存SP救済・冪等。UI は `src/app/(app)/samples/_components/progress-checklist.tsx`。

---

## 3. 確定事項 D1〜D6

### D1. 縫い代①（紐付け）と自動算出の対象（✓ 確定）

- 紐付けは**伝票側に `progressTaskId?` を持たせる**。WO と PO は別テーブルのため、**`WorkOrder.progressTaskId?` と `PurchaseOrder.progressTaskId?` を各1カラム**新設。
  - 根拠: 「同一材料を複数 PO に分割発注 → 同一 FABRIC タスクを複数伝票が指す（多対1）」を自然に表現できる。タスク側に1本だけ持つ案では表現できない。
- **AUTO_FROM_DOC 化するタスクは PATTERN / FABRIC / TRIM / SEWING / PROCESSING / BODY の6種**（BODY は D6）。`QUOTE / SPEC_LOCK / INSPECTION / CLIENT_REVIEW` は MANUAL 据え置き。
  - QUOTE は見積エンジン（Phase 1B）待ちのため MANUAL。

### D2. 加工WO の種別はマスター参照（✓ 確定）

- `WorkOrder` に **`processingTypeId?`** を新設。加工WO は `workType`（大分類）＋ `processingTypeId`（S-3a マスターの細目）で持つ。
- `ProgressTask(taskType=PROCESSING, processingTypeId=X)` と `WorkOrder(processingTypeId=X)` を同一IDで突合する。
- 根拠: マスターに特殊加工を増やしても `WorkOrderType` enum とズレないデータ駆動の一貫性を保つ。`WorkOrderType` の WASHING/PRINTING 等は当面温存（破棄しない）。

### D3. PO↔ラウンド紐付け／WO タイポ（✓ 確定）

- `PurchaseOrder` に **`sampleProductionId?`**（正しい綴り）を新設。ラウンド単位の生地/付属/ボディ PO を結ぶ。
- `WorkOrder.samplProductionId`（綴りミス）は**今回触らず温存**。リネームは `@map` 据え置きで migration 不要だが参照箇所修正でスコープが膨らむため **B-035** に分離。

### D4. §6 受け皿の置き場所（✓ 確定）

「フィールドを持たせるところまで（請求出力・版類在庫UIは後続）」の前提で置き場所を確定。

| 受け皿 | 置き場所 | 内容 |
|---|---|---|
| 費目 | `PoItem.costCategoryId?` / `WoItem.costCategoryId?` | `CostCategory` 参照。版代＝PO明細、パターン/グレーディング代＝WO明細のため両明細に必要 |
| 売り立て区分 | `PoItem` / `WoItem` の明細行 | 新 enum（下記）。`INDIVIDUAL_BILLING`（個別売り立て）／`UNIT_PRICE_INCLUDED`（製品単価インクルード） |
| 現物資産フラグ | `PoItem`（版を PO 起票する §6-3 に従う） | `isPhysicalAsset Boolean @default(false)` |
| 保管期限 | `PoItem` | `assetStorageStartDate?` / `assetStorageExpiryDate?`（版1枚ごとに期限が異なるため明細行に持つ） |

- 売り立て区分の §6-2 確定: 個別売り立て＝パターン代・版代・型代・刺繍パンチ代・グレーディング代。製品単価インクルード＝加工工賃そのもの（洗い・プリント等）。本スコープは区分フィールド保持まで。請求出力は後続。
- 版類在庫の本格管理・再利用判定UIは **B-023**（既存）に送る。

### D5. S-4 の3分割（✓ 確定）

§1 の表のとおり S-4a → S-4b → S-4c。

### D6. ボディ仕入の taskType 追加（✓ 確定）

- `ProgressTaskType` に **`BODY`（ボディ仕入）** を追加。
- 性質: FABRIC/TRIM と同じ「PO 起点・発注済み≠入荷済み」。`isReceived` フラグ持ち。AUTO_FROM_DOC 対象（D1 の6種目）。紐付けは PO 側 `progressTaskId?` 経由。SEWING（WO・作業）とは明確に分離（ボディは現物仕入＝PO）。
- 出し分け: S-4 では「`BODY` を taskType に追加し、PROCESSING と同様にチェックリスト画面から都度追加できる」ところまで。自動初期生成への組み込みは **B-036** に送る。

---

## 4. 追加論点 — 必須固定タスクは存在しない（✓ 確定・漏れ検知の核心）

慎太郎さんの実務指摘（刺繍だけ／プリントだけ／ありボディ縫製のみ等、縫製・付属発注がマストでない案件が存在する）を設計原則として明文化する。

**原則: 必須固定タスクは無い。どの taskType も SKIPPED にできる。** これを前提に、以下の不変条件で誤検知を殺す（schema 変更不要・`ProgressTaskStatus.SKIPPED` を活用）。

1. **SKIPPED は終端**。進捗率の分母からも漏れ検知の対象からも外す（UIはグレーアウト）。
2. **AUTO_FROM_DOC の `recomputeTaskStatus` は SKIPPED を上書きしない**。人が「この案件には不要」と宣言した行を、伝票不在を根拠に NOT_STARTED へ戻さない。
3. 生地支給・ボディ支給など「発注しないが進める」ケースも SKIPPED で表現する。

これにより、加工のみ案件で PATTERN/FABRIC/TRIM/SEWING を SKIPPED にすれば、AUTO 化後も「伝票が無い＝未完」と誤検知されない。

---

## 5. 業務フロー検証（慎太郎さん提示ケース）

### (い) ボディ縫製だけ発注（生地支給・標準型） — 手当て不要

既存タスクの SKIPPED 運用で完結。PATTERN を SKIPPED（標準型・パターン起こし無し）、FABRIC を SKIPPED（生地支給）、TRIM は付属有無で通常/SKIPPED、SEWING は通常どおり SEWING WO。§4 の不変条件により誤検知なし。**schema 変更・新 taskType 不要。**

### (あ) 既製ボディを仕入れて加工 — `BODY` で手当て（D6）

縫製済み無地ボディを**現物仕入**するため SEWING WO ではなく PO が要る。FABRIC（生地）でも TRIM（付属）でもない「半製品の本体」なので、流用せず `BODY` taskType を新設（D6）。ボディは PurchaseOrder で扱い、PROCESSING(加工) と組み合わさる。FABRIC と同じ枠（PO起点・isReceived・AUTO対象・PO側 progressTaskId 経由）に乗る。

### 刺繍だけ／プリントだけ案件 — §4 + D6 でカバー

SPEC_LOCK・PROCESSING(刺繍 or プリント)・INSPECTION・CLIENT_REVIEW 程度が実体。PATTERN/FABRIC/TRIM/SEWING は SKIPPED。ありボディ前提なら BODY を足す。誤検知は §4 の不変条件で抑止。毎回の手動 SKIPPED の手間は B-036（案件タイプ別テンプレート）で段階的に軽減。

---

## 6. S-4a 実装スコープ（schema 変更の確定リスト）

実装ブリーフ作成時、Claude Code 側で live schema を再 grep して真値最終確認のうえ着手する。下記は本書時点の確定設計。

**新規 enum**
- 売り立て区分: `enum BillingClassification { INDIVIDUAL_BILLING; UNIT_PRICE_INCLUDED }`（命名は実装時に既存規約と突き合わせて微調整可）

**`ProgressTaskType` への追加**
- `BODY`（ボディ仕入）を SAMPLE phase 群に追加

**`WorkOrder` への追加**
- `progressTaskId String? @map("progress_task_id")`（D1）
- `processingTypeId String? @map("processing_type_id")`（D2）
- index 追加: `@@index([progressTaskId])` 等

**`PurchaseOrder` への追加**
- `progressTaskId String? @map("progress_task_id")`（D1）
- `sampleProductionId String? @map("sample_production_id")`（D3）
- index 追加

**`PoItem` への追加**
- `costCategoryId String? @map("cost_category_id")`（D4）
- `billingClassification BillingClassification? @map("billing_classification")`（D4）
- `isPhysicalAsset Boolean @default(false) @map("is_physical_asset")`（D4 現物資産）
- `assetStorageStartDate DateTime? @map("asset_storage_start_date") @db.Date`（D4 保管期限）
- `assetStorageExpiryDate DateTime? @map("asset_storage_expiry_date") @db.Date`（D4 保管期限）

**`WoItem` への追加**
- `costCategoryId String? @map("cost_category_id")`（D4）
- `billingClassification BillingClassification? @map("billing_classification")`（D4）

**確認事項（実装時1行）**: `ProgressTaskEvidenceMode` の値が `AUTO_FROM_DOC / MANUAL` の2値であることを grep 1行で確認（D1 はこれ前提）。

**安全手順**: dev で `migrate dev`（migration 名は `add_s4a_order_linkage_receptacles` 等）→ dev 検証 → PR → 本番は別途明示指示 + host 照合 + 三重ガード。

---

## 7. 本書で新規起票したバックログ

- **B-035**: `WorkOrder.samplProductionId` の綴りミス（"e" 抜け）を `sampleProductionId` にリネーム。`@map` は `sample_production_id` のままで migration 不要だが参照箇所の修正が要る。優先度: 低（実害なし・整合性のみ）。
- **B-036**: 案件タイプ別のタスク生成テンプレート出し分け（加工のみ／フル制作／ありボディ／ボディ仕入＋加工 等で SP 作成時の初期生成タスクを変える）。仕様 v1.0 §3-3「商品カテゴリ等での出し分けは要望が出たら段階拡張」の具体化。運用が固まってから段階導入。優先度: 中。

---

## 8. 確定状況

| # | 論点 | 確定 |
|---|---|---|
| D1 | 縫い代①紐付け + AUTO 対象 | 伝票側 progressTaskId?（WO/PO 各1）。AUTO=PATTERN/FABRIC/TRIM/SEWING/PROCESSING/BODY の6種 |
| D2 | 加工WO の種別 | WO に processingTypeId? 追加。workType + processingTypeId のデータ駆動 |
| D3 | PO↔ラウンド / WO タイポ | PO に sampleProductionId? 追加。WO タイポは B-035 送り |
| D4 | §6 受け皿 | PoItem/WoItem に費目+売り立て区分。PoItem に現物資産+保管期限 |
| D5 | 3分割 | S-4a(schema)→S-4b(作成UI/紐付け)→S-4c(自動算出/ボタン活性化) |
| D6 | ボディ仕入 | ProgressTaskType に BODY 追加。PO起点・isReceived・AUTO6種目・都度追加（初期生成は B-036） |
| 追加 | 必須固定タスク無し | SKIPPED 終端・AUTO は SKIPPED を上書きしない・支給は SKIPPED 表現 |

→ 本書 v1.0 確定。次は **S-4a 実装ブリーフ**（Claude Code 向け・【対象プロジェクト】ヘッダ固定・コードブロック出力）を作成する。

---

## 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-06-08 | v1.0 | S-4 発注連携を確定。D1〜D6 + 必須固定タスク無しの不変条件 + (あ)(い) フロー検証。B-035/B-036 起票 | 慎太郎さん + Claude |
