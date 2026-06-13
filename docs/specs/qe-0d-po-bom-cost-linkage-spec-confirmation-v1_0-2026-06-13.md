# 仕様確認議事録 — QE-0d（B-058）PO→BOM コスト引き当て v1.1

- 作成日: 2026-06-13 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v1.1（確定・実装ブリーフ着手可）**
- 改訂要点（v1.0→v1.1）: 引き当て参照を **poItemId → purchaseOrderId** に変更。理由は §2-1 の非対称性（PO 編集で PoItem が物理再作成され id が変わる）。
- 位置づけ: B-058 の実装単位。BOM→PO（B-057・量産方向）と対の**片方向**。自動同期なし。サンプル段階の二重入力解消が狙い。
- 上位: QE-0 仕様書 v1.2 / QE-0c（用尺軸・MarkingRecord・PR #80）
- grep 実態確認済み（2026-06-13・read-only）:
  - BomItem の `usagePerUnit` / `unitPrice` は **QE-0a で既に nullable**（DROP NOT NULL 不要）
  - 用尺軸の既存構造: `usageSource UsageSource @default(MANUAL)`（MANUAL/MARKING_SHEET/CAD）＋ `markingRecordId String?`（scalar FK・@relation なし）＋ `procurementMode FabricProcurementMode?`（ROLL/METER・生地行のみ）
  - 用尺軸 削除ガード: `src/lib/actions/markings.ts` の `deleteMarkingRecord`（197行〜・`bomItem.count({where:{markingRecordId:id}})` で参照>0なら拒否）。MarkingRecord は soft-delete のみ・再作成されないため id 不変＝ガード成立
  - PoItem に `currency Currency @default(JPY)` あり（unitPrice コピー時に通貨も揃える）
  - **PurchaseOrder は soft-delete（deletedAt）・PO の id は不変**
  - **updatePurchaseOrder（purchase-orders.ts:687）が `tx.poItem.deleteMany({where:{poId}})`→再作成。PO 編集のたびに PoItem.id が変わる**
  - migration 本数=30（QE-0c 適用後）

## 1. 設計の軸（確定）
慎太郎さん定義（2026-06-13）: **「仕様書（用尺）はマーキングから／見積もり・コストは発注（PO）から／引き当てる」**
- BomItem 1 行は**出所2軸**を独立に保持する:
  - **用尺軸** = 着用尺(usagePerUnit)。出所=マーキング（QE-0c 既存・MANUAL/MARKING_SHEET/CAD）
  - **コスト軸** = 単価・見積もり(unitPrice)。出所=発注（QE-0d 新設・MANUAL/PURCHASE_ORDER）
- 1 行が「用尺=マーキング由来／コスト=PO由来」を同時に持てる。

## 2. 引き当て構造（確定）
### 2-1. 参照は PoItem.id ではなく PurchaseOrder.id（v1.1 の核心）
- **非対称性の発見**: 用尺軸の鏡写し（markingRecordId 方式）は PoItem には適用できない。MarkingRecord は soft-delete のみで id 不変だが、**PoItem は updatePurchaseOrder が deleteMany→再作成するため、PO を編集するたびに id が変わる**。
- QE-0d がまさに想定する「単価未定で発注→後日 PO 編集で単価を入れる」操作で、poItemId 参照は確実に dangling 化する。
- よって参照は **purchaseOrderId（PO の id・不変）** とする。
  - 値は引き当て時点でスナップショットコピー（PoItem 再作成の影響を受けない＝確定済み「値コピー・自動同期なし」原則に合致）
  - トレーサビリティは発注書単位で安定。明細の素性（仕入先品番・色・サイズ）は BomItem へ値コピー済みのため人が照合可能
  - PO 削除ガードが実成立（PO soft-delete に対し purchaseOrderId 参照を count）
  - **updatePurchaseOrder へのガードは不要**（PoItem 再作成は PO の id に影響しない＝単価後入れ編集を一切塞がない）
- 不採用案: (A) PoItem.id 参照＝PO 編集で壊れる / (C) dangling 許容＝削除ガード空振り・トレース弱。いずれも確定原則と不整合。

### 2-2. 軸ごとの構造対照
| 軸 | source enum | 参照FK | 参照先のid安定性 | 削除ガード | 状態 |
|---|---|---|---|---|---|
| 用尺 | usageSource (MANUAL/MARKING_SHEET/CAD) | markingRecordId | 不変(soft-delete) | markings.ts:deleteMarkingRecord | 既存 |
| コスト | **costSource (MANUAL/PURCHASE_ORDER)** | **purchaseOrderId** | 不変(soft-delete) | **deletePurchaseOrder にガード新設** | QE-0d |

## 3. 動線（確定）
1. BOM セクション（products/[id]）に「発注から取り込む」を配置
2. **同一品番（Product）に紐づく PO のみ**を候補表示（C1。PO に productId 直結なし→progressTaskId→ProgressTask.productId 経由で絞る）
3. **1操作=1PO**（C2）。PoItem を複数チェック可。複数 PO は操作を繰り返す
4. チェックした PoItem を **BomItem 新規行として起票**:
   - 素性＋単価＋通貨をコピー（**コスト軸引き当て**・costSource=PURCHASE_ORDER・**purchaseOrderId 記録**）
   - 用尺は空（usageSource=MANUAL のまま・usagePerUnit=null）
5. 起票後、用尺は QE-0c の機能でマーキングから引き当て（MARKING_SHEET）→ 1行2軸が完成
- UI 形態: 用尺軸（1行内の出所切替＋単一参照）とは別物。**PO選択→PoItem 一覧チェックボックス→一括起票の専用モーダル**

## 4. フィールドマッピング（PoItem → BomItem）
- **名前一致・直接コピー**: supplierItemCode / designCode / sizeValue / sizeUnit / colorCode / specification / unitPrice / unit / currency
- **名前差異**: customItemName→customMaterialName / customItemNameEn→customMaterialNameEn / color→colorName
- **親 PO 由来**: PurchaseOrder.supplierId → BomItem.supplierId
- **既定マッピング後に人が修正（C5）**: PO タスク種別 → BomItemCategory
  - FABRIC → MAIN_FABRIC（既定。裏地/芯地は人が修正）
  - TRIM → ACCESSORY（既定。ZIPPER/BUTTON 等へ人が修正）
  - BODY → 実装ブリーフで取り込み対象か確認（資材でなければ対象外）
- **取り込まない**: usagePerUnit（用尺軸）/ quantity（発注量≠用尺）/ procurementMode（用尺軸・QE-1領分）/ usageSource / markingRecordId / poId・poItemId（PoItem.id は参照しない）

## 5. 重複（C4）
仕入先品番一致の既存 BomItem があれば取り込みダイアログに「BOM に既存」フラグ表示のみ。自動マージ・自動スキップなし（自動同期なし原則）。転記後の重複は人が削除。

## 6. トレーサビリティ（C7）
purchaseOrderId 参照で達成（発注書単位）。明細単位の素性は値コピーで照合可能。専用の由来テキスト・notes 補記は不要。

## 7. schema 影響（grep 反映・確定・非破壊）
- ~~usage_per_unit DROP NOT NULL~~ → **不要**（QE-0a 済み）
- ~~unit_price DROP NOT NULL~~ → **不要**（QE-0a 済み）
- **新規 enum**: `CostSource { MANUAL, PURCHASE_ORDER }`
- **ADD COLUMN** `cost_source CostSource @default(MANUAL)`（NOT NULL DEFAULT・既存行に MANUAL・非破壊）
- **ADD COLUMN** `purchase_order_id String?`（scalar FK・nullable・@relation なし＝markingRecordId と同方式）
- migration **31本目**（ADD のみ・非破壊）。段階停止プロトコル順守（dev db push→差分目視→本番投入前に Claude.ai で一旦停止→承認後マージ=migrate deploy）

## 8. 影響ファイル（grep 実パス）
- schema: prisma/schema.prisma（BomItem に cost_source/purchase_order_id・新 enum CostSource）
- actions:
  - src/lib/actions/boms.ts（**新規 action**: listPoItemsForBomImport(productId) ＋ importPoItemsToBom(bomId, poItemIds[])。既存 export: getBomByProductId/createBom/addBomItem/updateBomItem/deleteBomItem 等）
  - src/lib/actions/purchase-orders.ts（**deletePurchaseOrder（729行）に削除ガード新設**: purchaseOrderId 参照中の BomItem を count→拒否。markings.ts:deleteMarkingRecord を鏡写し）
- validators: src/lib/validators/bom.ts（CostSource・purchaseOrderId）
- UI: src/app/(app)/products/_components/bom-section.tsx（「発注から取り込む」モーダル）/ bom-labels.ts（COST_SOURCE_LABELS を USAGE_SOURCE_LABELS と同形式 Record で追加）
- 削除ガード参考実装: src/lib/actions/markings.ts:deleteMarkingRecord（197行〜）

## 9. 実装ブリーフ時の最終確認（小項目・骨格に影響なし）
- 同一品番 PO 絞り込みクエリの確定（progressTaskId 群→PO / primaryProductId 併用の要否）
- PO タスク種別に BODY が来るケースの取り込み対象判定
- dev(hopper:12921) の po_items / bom_items 件数（着手前ガード・migration 安全確認）

## 10. 確定状況
| # | 論点 | 確定 |
|---|---|---|
| 軸 | 出所2軸 | 用尺=マーキング(既存)/コスト=PO(新設)。1行独立保持 |
| 構造 | 引き当て | **costSource + purchaseOrderId（PoItem.id ではない）**＋PO削除ガード。値コピー・自動同期なし |
| C1 | PO 絞り込み | 同一品番の PO のみ（progressTaskId 経由） |
| C2 | 複数PO | 1操作1PO・繰り返し |
| C3 | 用尺 | 取り込まない（マーキング領分）。usagePerUnit は QE-0a で nullable 済 |
| C4 | 重複 | 既存フラグ表示のみ・自動マージなし |
| C5 | category | タスク種別→既定マッピング後に人が修正 |
| C6 | 単価 | PO から引き当て。unitPrice は QE-0a で nullable 済 |
| C7 | トレース | purchaseOrderId 参照（発注書単位） |

→ 本書 v1.1 確定。次は **migration 込み実装ブリーフ**（Claude Code 向け・段階停止・PO 削除ガード同梱）。

## 改訂履歴
| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-06-13 | v1.0 | QE-0d（B-058）PO→BOM コスト引き当て確定。出所2軸・costSource+poItemId・migration 31本目(ADD のみ)・grep 実態反映 | 慎太郎さん + Claude |
| 2026-06-13 | v1.1 | 引き当て参照を poItemId→**purchaseOrderId** に変更（PO 編集で PoItem が再作成され id が変わる非対称性のため）。PO 削除ガードは deletePurchaseOrder に・update ガード不要。currency コピー追記。取り込み UI は専用モーダルと明記 | 慎太郎さん + Claude |
