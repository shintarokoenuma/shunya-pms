# 仕様確認議事録 — QE-0d（B-058）PO→BOM コスト引き当て v1.0

- 作成日: 2026-06-13 / Claude.ai
- 作成者: 慎太郎さん + Claude
- バージョン: **v1.0（確定・実装ブリーフ着手可）**
- 位置づけ: B-058 の実装単位。BOM→PO（B-057・量産方向）と対の**片方向**。自動同期なし。サンプル段階の二重入力解消が狙い。
- 上位: QE-0 仕様書 v1.2 / QE-0c（用尺軸・MarkingRecord・PR #80）
- grep 実態確認済み（2026-06-13・read-only）:
  - BomItem の `usagePerUnit` / `unitPrice` は **QE-0a で既に nullable**（DROP NOT NULL 不要）
  - 用尺軸の既存構造: `usageSource UsageSource @default(MANUAL)`（MANUAL/MARKING_SHEET/CAD）＋ `markingRecordId String?`（scalar FK・@relation なし）＋ `procurementMode FabricProcurementMode?`（ROLL/METER・生地行のみ）
  - 削除ガード: `src/lib/actions/markings.ts` の `deleteMarkingRecord`（211行〜・`bomItem.count({where:{markingRecordId:id}})` で参照>0なら拒否）
  - migration 本数=30（QE-0c 適用後）

## 1. 設計の軸（確定）
慎太郎さん定義（2026-06-13）: **「仕様書（用尺）はマーキングから／見積もり・コストは発注（PO）から／引き当てる」**
- BomItem 1 行は**出所2軸**を独立に保持する:
  - **用尺軸** = 着用尺(usagePerUnit)。出所=マーキング（QE-0c 既存・MANUAL/MARKING_SHEET/CAD）
  - **コスト軸** = 単価・見積もり(unitPrice)。出所=発注（QE-0d 新設・MANUAL/PURCHASE_ORDER）
- 1 行が「用尺=マーキング由来／コスト=PO由来」を同時に持てる。

## 2. 引き当て構造（用尺軸の鏡写し・確定）
| 軸 | source enum | 参照FK | 削除ガード | 状態 |
|---|---|---|---|---|
| 用尺 | usageSource (MANUAL/MARKING_SHEET/CAD) | markingRecordId | markings.ts:deleteMarkingRecord | 既存 |
| コスト | **costSource (MANUAL/PURCHASE_ORDER)** | **poItemId** | **PO/PoItem 削除時にガード新設** | QE-0d |
- 引き当て = PoItem 参照保持＋**引き当て時点で値コピー**（自動同期なし）。
- costSource を明示 enum で持つ理由: 用尺軸との構造対称・バッジ表示の明示性・将来出所拡張（見積書等）の余地。

## 3. 動線（確定）
1. BOM セクション（products/[id]）に「発注から取り込む」を配置
2. **同一品番（Product）に紐づく PO のみ**を候補表示（C1。PO は progressTask 経由で Product に紐づく）
3. **1操作=1PO**（C2）。PoItem を複数チェック可。複数 PO は操作を繰り返す
4. チェックした PoItem を **BomItem 新規行として起票**:
   - 素性＋単価をコピー（**コスト軸引き当て**・costSource=PURCHASE_ORDER・poItemId 記録）
   - 用尺は空（usageSource=MANUAL のまま・usagePerUnit=null）
5. 起票後、用尺は QE-0c の機能でマーキングから引き当て（MARKING_SHEET）→ 1行2軸が完成

## 4. フィールドマッピング（PoItem → BomItem）
- **名前一致・直接コピー**: supplierItemCode / designCode / sizeValue / sizeUnit / colorCode / specification / unitPrice / unit
- **名前差異**: customItemName→customMaterialName / customItemNameEn→customMaterialNameEn / color→colorName
- **親 PO 由来**: PurchaseOrder.supplierId → BomItem.supplierId
- **既定マッピング後に人が修正（C5）**: PO タスク種別 → BomItemCategory
  - FABRIC → MAIN_FABRIC（既定。裏地/芯地は人が修正）
  - TRIM → ACCESSORY（既定。ZIPPER/BUTTON 等へ人が修正）
  - BODY → 実装ブリーフで取り込み対象か確認（資材でなければ対象外）
- **取り込まない**: usagePerUnit（用尺軸）/ quantity（発注量≠用尺）/ procurementMode（用尺軸・QE-1領分）/ usageSource / markingRecordId

## 5. 重複（C4）
仕入先品番一致の既存 BomItem があれば取り込みダイアログに「BOM に既存」フラグ表示のみ。自動マージ・自動スキップなし（自動同期なし原則）。転記後の重複は人が削除。

## 6. トレーサビリティ（C7）
poItemId 参照で達成。専用の由来テキスト・notes 補記は不要。

## 7. schema 影響（grep 反映・確定・非破壊）
- ~~usage_per_unit DROP NOT NULL~~ → **不要**（QE-0a 済み）
- ~~unit_price DROP NOT NULL~~ → **不要**（QE-0a 済み）
- **新規 enum**: `CostSource { MANUAL, PURCHASE_ORDER }`
- **ADD COLUMN** `cost_source CostSource @default(MANUAL)`（NOT NULL DEFAULT・既存行に MANUAL・非破壊）
- **ADD COLUMN** `po_item_id String?`（scalar FK・nullable・@relation なし＝markingRecordId と同方式）
- migration **31本目**（ADD のみ・非破壊）。段階停止プロトコル順守（dev db push→差分目視→本番投入前に Claude.ai で一旦停止→承認後マージ=migrate deploy）

## 8. 影響ファイル（grep 実パス）
- schema: prisma/schema.prisma（BomItem に cost_source/po_item_id・新 enum CostSource）
- actions: src/lib/actions/boms.ts（PO 取り込み action 追加）/ src/lib/actions/purchase-orders.ts（**PO/PoItem 削除ガード新設**: poItemId 参照中の BomItem チェック・markings.ts を鏡写し）
- validators: src/lib/validators/bom.ts
- UI: src/app/(app)/products/_components/bom-section.tsx（「発注から取り込む」動線）/ bom-labels.ts（CostSource ラベル追加）
- 削除ガード参考実装: src/lib/actions/markings.ts:deleteMarkingRecord

## 9. 実装ブリーフ時の追加 grep（小項目・骨格に影響なし）
- PoItem に currency があるか（unitPrice コピー時に通貨を揃えるため）
- PO/PoItem の削除 action の現状（ガードを差し込む箇所の特定）
- PO のタスク種別に BODY が来るケースの有無（取り込み対象判定）

## 10. 確定状況
| # | 論点 | 確定 |
|---|---|---|
| 軸 | 出所2軸 | 用尺=マーキング(既存)/コスト=PO(新設)。1行独立保持 |
| 構造 | 引き当て | costSource+poItemId+PO削除ガード。参照保持＋値コピー・自動同期なし |
| C1 | PO 絞り込み | 同一品番の PO のみ |
| C2 | 複数PO | 1操作1PO・繰り返し |
| C3 | 用尺 | 取り込まない（マーキング領分）。usagePerUnit は QE-0a で nullable 済 |
| C4 | 重複 | 既存フラグ表示のみ・自動マージなし |
| C5 | category | タスク種別→既定マッピング後に人が修正 |
| C6 | 単価 | PO から引き当て。unitPrice は QE-0a で nullable 済 |
| C7 | トレース | poItemId 参照 |

→ 本書 v1.0 確定。次は **migration 込み実装ブリーフ**（Claude Code 向け・段階停止・PO 削除ガード同梱）。

## 改訂履歴
| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-06-13 | v1.0 | QE-0d（B-058）PO→BOM コスト引き当て確定。出所2軸（用尺=マーキング/コスト=PO）・costSource+poItemId 鏡写し・migration 31本目(ADD のみ)・grep 実態反映 | 慎太郎さん + Claude |
