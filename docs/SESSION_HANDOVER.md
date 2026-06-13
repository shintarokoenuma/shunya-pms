# 引き継ぎメモ (2026-06-14 セッション / QE-0d(B-058) 完了・本番反映・次は QE-0e(B,C)→QE-1)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト(shunya-ivr)の混入ファイル。無視。docs 整理（未追跡の docs/files 9〜12・*.zip 等含む）は B-037。git add は明示パスのみ（-A / . 禁止）。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)※プロジェクトroot で実行
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)
- ③ マージ後=本番URL + Railwayデプロイログ目視（migration入りPRはログの Applying migration 行が③の本体）

## ① 本セッションの完了マイルストーン
- PR #81 (squash a051688): QE-0d(B-058) PO→BOM コスト引き当て・main マージ済み（2026-06-13T15:33Z）
  - migration 31本目: bom_items に cost_source（enum CostSource{MANUAL,PURCHASE_ORDER}・NOT NULL DEFAULT 'MANUAL'）/ purchase_order_id（TEXT・nullable）ADD COLUMN（非破壊・ADD のみ）
  - 出所2軸: 用尺軸=マーキング(QE-0c 既存・usageSource/markingRecordId) ／ コスト軸=発注(本PR新設・costSource/purchaseOrderId)。1 BomItem が両軸を独立保持
  - actions: listPoItemsForBomImport(productId) / importPoItemsToBom({bomId,poItemIds})（boms.ts）・deletePurchaseOrder に削除ガード（purchase-orders.ts・purchaseOrderId 参照 count>0 で拒否・markings.ts 鏡写し）
  - UI: 資材表に「発注から取り込む」専用モーダル（PO単位グループ＋PoItem チェックボックス一括起票・単価未定は「未定」・既存重複は「BOM に既存」バッジ）・単価セルに「発注から引き当て」バッジ
  - dev(hopper) で a〜e 全PASS / tsc 0 errors / lint 0 errors（form.watch 警告は既存同様で無害）
- docs: 仕様 v1.1（コミット 61e848c・引き当て参照を poItemId→purchaseOrderId に確定）

## ② 本セッションの仕様確定（重要・QE-0e/QE-1 の前提）
- 引き当て参照は PoItem.id でなく PurchaseOrder.id（不変）。理由: updatePurchaseOrder（purchase-orders.ts:687）が PoItem を deleteMany→再作成するため PO 編集のたびに PoItem.id が変わる。PO は soft-delete で id 不変→削除ガードが成立。updatePurchaseOrder は触らない（PoItem 再作成は PO.id に無影響）
- 値はスナップショットコピー・自動同期なし（用尺軸の転記原則と同じ）。BOM⇔PO は双方向だが自動連動しない
- PoItem→BomItem マッピング: customItemName→customMaterialName / customItemNameEn / color→colorName / supplierItemCode/designCode/sizeValue/sizeUnit/specification/unit/unitPrice/currency 同名 / supplierId←親PO。itemCategory は taskType 既定（FABRIC→MAIN_FABRIC / TRIM→ACCESSORY / 他(BODY含む)→OTHER）後に人が修正。usagePerUnit/quantity/procurementMode/usageSource/markingRecordId は取り込まない
- 同一品番 PO 絞り込み: PO に productId 直結なし→ ProgressTask.productId=productId のタスク群→その progressTaskId を持つ PO、OR primaryProductId=productId
- A（BOM→PO 逆方向転記）は不要に確定（運用は「サンプル→発注が先」のため）。次は B / C（= QE-0e として束ねる）
  - B: SP番号→タイトル表示・タイトル必須化
  - C: BOM⇔サンプル製作セット紐付けの可視化

## ③ Railway環境マッピング（本ファイル§③が唯一の正）
- 本番DB: postgres-production / postgres-ab6d / shuttle.proxy.rlwy.net:16099
- dev DB: postgres-development / hopper.proxy.rlwy.net:12921（db push運用・_prisma_migrations 無し）
- ★教訓(QE-0d): dev は _prisma_migrations が無いため `migrate dev` を打つと全リセット（All data will be lost）を要求してくる。dev に migrate dev / migrate deploy は打たない。migration ファイルは手書き（master-patterns §14）→ dev↔schema を `migrate diff --from-url <dev> --to-schema-datamodel` の空差分で裏取り → 本番は merge→Railway 自動 migrate deploy
- リポジトリの migration ファイル=31本（QE-0d 適用後）。dev は db push / 本番は migrate deploy
- GCS: dev=shunya-pms-documents-dev / prod=shunya-pms-documents-prod。発注書控え={kind}/{orderNumber}/・マーキング原本=marking/{productId}/

## ④ dev DB 状態（hopper）
- bom_items: 5件（うち4件は QE-0d a〜e 検証で PO-2026-0001/0002 から取り込んだ PURCHASE_ORDER 行・1件は従来 MANUAL）。掃除任意
- po_items: 5件。PO-2026-0001 / PO-2026-0002 が品番 AOI-26AW-CUT_SEWN-001「Test Tシャツ」(7671eb90…) に primaryProductId 紐付け（QE-0d 検証データ）
- marking_records: [QE0C-VERIFY]表地 1件（着用尺2.1m・巻きm50・PDF添付済み・MT-001 紐付け）残存（掃除任意）
- マスター類: seed-dev-sample-data.ts 投入分120件 + processing_types 10 は従来どおり
- SP-2026-0001 / SP-VERIFY-S4C1 / [S4B2-VERIFY] WO3件は温存中（掃除任意）

## ⑤ 次セッションの優先順
1. ③デプロイログ確認: PR#81 の本番 migrate deploy（Applying migration 20260614000000_qe0d_bom_cost_source）と本番 smoke を冒頭で確認
2. QE-0e（B: SP番号→タイトル表示・必須化 / C: BOM⇔サンプル製作セット紐付け可視化）仕様確認→実装ブリーフ→実装
3. QE-1（量産見積・取り切り計算）仕様確認: 冒頭で Excel 2点（27SS各プラント_サンプル品番.xlsx / INSONNIA_SMASHING_25SS_コスト.xlsx）を読み解き参照資料化（チャット再添付を依頼）→ §②論点（計算モード2本立て・規格上書きは巻きmのみ・Excel 2点読み解き・量産フロー B-059 数量入力）を確定
4. B-057（BOM→PO 下書き生成）は QE-1 完了後
5. ついで回収候補: B-048（PO採番リトライのP2002限定・WO側適用済みPO側未対応）/ WorkOrder 編集UI

## ⑥ 注意点・残課題
- 教訓(QE-0d・最重要): dev で `migrate dev` 禁止（全リセット要求）。migration は手書き＋diff 空差分で裏取り。§③参照
- 教訓: UI文言の削除指示は「一覧の脚注」「フォーム内 FormDescription」など箇所を明示的に列挙する
- 教訓: 業務用語は慎太郎さんの定義が正。専門概念を画面に持ち込む前に用語と役割を確認
- 教訓: migrate diff の自動生成は RENAME を DROP+ADD にする。値保持が必要な migration は手書きで RENAME COLUMN（master-patterns §14）
- sizeCombination カラムは UI 撤去済みだが DB 温存（非破壊）。totalUnits/totalLength も CAD 連携(B-047/B-056)用に温存
- QE-0b/0c/0d の lint 警告（form.watch の React Compiler スキップ）は既存 PO フォームと同様で無害
- 未追跡の docs/files */・*.zip・docs/CLAUDE.md は触れない（gh の「29 uncommitted changes」警告はこれら。PR には未混入）
- ~/Downloads の GCS SA JSON 原本は鍵の原本として保管場所を意識（漏れたら GCP で再発行+旧キー無効化）。~/Downloads は本環境からアクセス不可（Operation not permitted）

## ⑦ 本日マージされた PR
#81（QE-0d: PO→BOM コスト引き当て・costSource+purchaseOrderId・PO削除ガード・取り込みモーダル・migration 31本目）

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. git log origin/main --oneline -3 で先頭確認（a051688=PR#81 またはその後の docs コミット）
3. git branch で main のみか確認
4. 本番のデプロイログ（migration 31本目）＋本番 smoke 確認
