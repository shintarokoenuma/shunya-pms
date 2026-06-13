# 引き継ぎメモ (2026-06-13 セッション / QE-0c 完了・本番反映済み・次は QE-0d(B-058)→QE-1)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト(shunya-ivr)の混入ファイル。無視。docs 整理（未追跡の docs/files 9〜12 等含む）は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)※プロジェクトroot で実行
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)
- ③ マージ後=本番URL + Railwayデプロイログ目視（migration入りPRはログの Applying migration 行が③の本体）

## ① 本セッションの完了マイルストーン
- PR #80 (2e0b27e): QE-0c 完了・本番反映済み（三点チェック完了・Applying migration 2行確認済み・本番 smoke OK）
  - migration 29本目: bom_items に supplier_item_code/design_code/size_value/size_unit（ADD COLUMN×4・PoItem v1.1/v1.2 と命名構造統一）
  - migration 30本目: marking_records の usage_per_unit_derived→usage_per_unit RENAME+SET NOT NULL / total_units・total_length DROP NOT NULL（CAD用温存）/ roll_length ADD COLUMN
  - MarkingRecord CRUD UI（A案=着用尺の根拠台帳・着用尺直接入力・換算機能なし）+ 原本PDF GCS添付（marking/{productId}/{JST}.pdf・15分署名URL閲覧・bodySizeLimit 10mb）
  - BOM 明細: 実務4カラム + 用尺の出所切替（MANUAL/MARKING_SHEET・転記時点コピー・読み取り専用・実測バッジ・削除ガード）
- docs: QE-0 仕様書 v1.2 追補（同 PR 同梱）/ backlog に B-058・B-059 起票

## ② 本セッションの仕様確定（重要・QE-1 以降の前提）
- 用語確定: 着用尺=1着あたりの用尺 / 総用尺=着数×着用尺（発注に必要な総量・QE-1出力）/ 取り切り枚数=1反で取り切れる枚数（QE-1出力）。「マーカー長」「総着数」「1着用尺」は画面用語に使わない
- 着用尺はアプリが計算しない: ①直接指定 / ②図面から人が読み取り入力 / ③将来CAD（B-047/B-056）の3択の入力値。PDF上の総用尺（2人取り合算等）はアプリ概念に持ち込まない
- 規格: 生地幅=変更不可。巻きメーター数=唯一こちらが変更可（マスターは標準値・計算時上書き対象は巻きmのみ。MarkingRecord.rollLength にロット実規格を記録）
- 転記ファースト原則: ゼロ入力でなく前段階から転記して直すのが基本動作。量産時は大きな変更はなく、修正・用尺調整・数量（+取り切り/指定数チョイス）あたりが中心
- QE-1 設計論点（次回仕様確認の冒頭）: ①計算モード2本立て（取り切り=巻きm→取り切り枚数 / 指定数=着数→総用尺。デフォルト指定数）②規格上書きは巻きmのみ ③Excel 2点読み解き ④計算モードは量産フロー(B-059)の数量入力としても使われる
- B-058（QE-0d・次の実装単位）: PO→BOM 取り込み。資材表に「発注から取り込む」→PO選択→明細チェックボックス転記・修正。サンプル段階の二重入力解消。B-057(BOM→PO・量産方向)と対で双方向・自動同期なし
- B-059: 品番カルテの量産転記（サンプル→量産複製・BOM/マーキング引き継ぎ）。B-025 と仕様確認セット。実装は部品（BOM/PO/QE-1）が揃ってから

## ③ Railway環境マッピング（本ファイル§③が唯一の正）
- 本番DB: postgres-production / postgres-ab6d / shuttle.proxy.rlwy.net:16099
- dev DB: postgres-development / hopper.proxy.rlwy.net:12921（db push運用・_prisma_migrations無し）
- リポジトリの migration ファイル=30本（QE-0c 適用後）。dev は db push / 本番は migrate deploy。dev に migrate dev は打たない
- GCS: dev=shunya-pms-documents-dev / prod=shunya-pms-documents-prod。発注書控え={kind}/{orderNumber}/・マーキング原本=marking/{productId}/

## ④ dev DB 状態
- marking_records: [QE0C-VERIFY]表地 1件（着用尺2.1m・巻きm50・PDF添付済み・MT-001 紐付け）が残存（掃除任意）
- bom_items: QE-0c 検証明細（MANUAL に戻した状態）が残存（掃除任意）
- マスター類: seed-dev-sample-data.ts 投入分120件 + processing_types 10 は従来どおり
- SP-2026-0001 / SP-VERIFY-S4C1 / [S4B2-VERIFY] WO3件は温存中（掃除任意）

## ⑤ 次セッションの優先順
1. QE-0d（B-058: PO→BOM 取り込み）仕様確認→実装ブリーフ→実装（schema 変更なし見込み。論点: 重複行の扱い・PO数量→用尺の変換・複数POからの取り込み）
2. QE-1（量産見積・取り切り計算）仕様確認: 冒頭で Excel 2点（27SS各プラント_サンプル品番.xlsx / INSONNIA_SMASHING_25SS_コスト.xlsx）を読み解き参照資料化（チャット再添付を依頼）→ §②の4論点を確定
3. B-057（BOM→PO 下書き生成）は QE-1 完了後
4. ついで回収候補: B-048（PO採番リトライのP2002限定・WO側適用済みPO側未対応）/ WorkOrder 編集UI

## ⑥ 注意点・残課題
- 本番 smoke のマーキング検証データ: 削除済みのはずだが、次セッション冒頭に本番UIで残存確認（残っていればゴミ箱から削除）
- 教訓: UI文言の削除指示は「一覧の脚注」「フォーム内 FormDescription」など箇所を明示的に列挙する（今回フォーム内が1回漏れた）
- 教訓: 業務用語は慎太郎さんの定義が正。専門概念（マーキングの何人取り等）を画面に持ち込む前に用語と役割を確認する
- 教訓: migrate diff の自動生成は RENAME を DROP+ADD にする。値保持が必要な migration は手書きで RENAME COLUMN を使う（master-patterns §14）
- sizeCombination カラムは UI 撤去済みだが DB に温存（非破壊原則）。totalUnits/totalLength も CAD 連携(B-047/B-056)用に温存
- QE-0b/0c の lint 警告（form.watch の React Compiler スキップ）は既存 PO フォームと同様で無害
- ~/Downloads の GCS SA JSON 原本は鍵の原本として保管場所を意識（漏れたら GCP で再発行+旧キー無効化）

## ⑦ 本日マージされた PR
#80（QE-0c: MarkingRecord 着用尺台帳+原本PDF GCS添付+BomItem実務4カラム+マーキング転記・migration 29/30本目）

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. git log origin/main --oneline -3 で先頭確認（2e0b27e=PR#80 またはその後の docs コミット）
3. git branch で main のみか確認
4. 本番のマーキング smoke
