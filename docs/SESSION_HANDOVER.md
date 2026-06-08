# 引き継ぎメモ (2026-06-08 セッション / S-4a完了・本番反映 → S-4b仕様確定 → 次は S-4b-1 実装)

## ⓪ 最重要・プロジェクト棲み分けルール（毎回必須）
- shunya-pms（リポジトリ shintarokoenuma/shunya-pms・ローカル ~/shunya-production-system・本番 shunya-pms-web-production.up.railway.app）と saagara-v2（別リポジトリ・本番 saagara-v2-production.up.railway.app）は完全に別物。
- VS Code の Claude Code 別ウィンドウで両者を混同した過去あり。実装指示書には毎回冒頭に【対象プロジェクト】ヘッダを固定。貼る前に ~/shunya-production-system を開いているか目視確認。

## ⓪-2 PR URL 3点セット運用（shunya-pr-url-checklist スキル）
- ① マージ前の UI 確認 = ローカル（npm run dev → http://localhost:3000 / dev DB hopper:12921）
- ② マージ操作 = GitHub PR URL → マージ = Railway main 自動デプロイ = 本番反映（不可逆）
- ③ マージ後の本番確認 = 本番 URL（https://shunya-pms-web-production.up.railway.app / 本番 DB shuttle:16099）+ Railway デプロイログ目視

## ① 直近の完了マイルストーン
- S-4a（発注 WO/PO 連携の schema 受け皿）完了・本番反映済み。PR #63 → merged fdb7db8。migration 20260607181752_add_s4a_order_linkage_receptacles を本番（postgres-ab6d）に適用確認済み（Railway デプロイログで "All migrations have been successfully applied" 目視・23 migrations）。dev も 23 migrations・ドリフトなし。
  - 追加（すべて非破壊・nullable/default）: enum BillingClassification(INDIVIDUAL_BILLING/UNIT_PRICE_INCLUDED) 新規 / ProgressTaskType に BODY 追加。
  - WorkOrder: progressTaskId? / processingTypeId? + index。
  - PurchaseOrder: progressTaskId? / sampleProductionId? + index。
  - PoItem: costCategoryId? / billingClassification? / isPhysicalAsset(default false) / assetStorageStartDate? / assetStorageExpiryDate? + index。
  - WoItem: costCategoryId? / billingClassification? + index。
  - BODY enum 追従で progress-task-labels.ts に1行（BODY: "ボディ仕入"）のみ追加。他 UI/ロジック不変更。
  - WorkOrder.samplProductionId（綴りミス・"e"抜け）は温存・不変更（リネームは B-035）。
- S-4 仕様確認書 v1.0 確定: docs/specs/s-4-order-linkage-spec-confirmation-v1_0-2026-06-08.md（D1〜D6・必須固定タスク無しの不変条件・(あ)(い)フロー検証）。
- S-4b 仕様確認書 v1.0 確定: docs/specs/s-4b-order-creation-spec-confirmation-v1_0-2026-06-08.md（E1〜E8・S-4b-1 PO系詳述・S-4b-2 WO系方針）。

## ② dev / 本番 DB の状態
- dev（hopper:12921）: 23 migrations・up to date・ドリフトなし。progress_tasks=10（S-3 検証データ・温存中。掃除は S-4c 直前）/ processing_types=2。Product 2件。カテゴリ27件短縮形。
- 本番（shuttle:16099 / postgres-ab6d）: 23 migrations 適用済み（S-4a 含む・デプロイログ確認済み）。品番カルテ1件（IP-26AW-M-BT-001 / test 残置）。カテゴリ27件短縮形。パスワードはローテーション済み（ローカルから本番DB直接接続は不可）。
- 本番ログに単発の手動クエリエラー（2026-06-06 "column name does not exist" on product_categories）あり=カテゴリ是正中の手動 psql タイポと判断・実害なし。

## ③ 次セッションで最初にやること（優先順）
1. main 最新化（git pull origin main）。git log origin/main --oneline -8 で実態確認。
2. S-4b-1（PO 系）の実装ブリーフ作成 → Claude Code 実装。仕様は docs/specs/s-4b-order-creation-spec-confirmation-v1_0-2026-06-08.md §3。
   - PurchaseOrder + PoItem の採番(PO-{年}-{4桁}・保存時確定)・CRUD actions(list/get/create/update/soft-delete)・最小フォーム。
   - 起点=進行チェックリストのタスク行(FABRIC/TRIM/BODY)の「発注を作成」ボタン(S-3 非活性ボタンを活性化)→ progressTaskId/sampleProductionId 紐付け。
   - 費目(costCategoryId)・売り立て区分(billingClassification)・現物資産(isPhysicalAsset/保管期限)を PoItem フォームで入力。
   - suppliers.ts の purchaseOrderCount を実値化(E8)。
   - migration 見込み無し(S-4a で受け皿投入済み)。着手時に横断 grep で受け皿列が main に揃っているか確認。PR 必須。
3. その後 S-4b-2（WO 系）→ S-4c（自動算出 recomputeTaskStatus + 発注書ボタン活性化 + コスト集計）。

## ④ 実装シーケンス（更新）
- S-1〜S-3a・S-3（完了）→ S-4a（完了・本番反映）→ S-4b-1（PO系・次）→ S-4b-2（WO系）→ S-4c（自動算出/発注書/集計）。
- S-4b/S-4c は migration 見込み無し（schema は S-4a で投入済み）。schema 不足が判明したら実装前に報告。

## ⑤ 本セッション起票のバックログ
- B-035: WorkOrder.samplProductionId の綴りミス("e"抜け)を sampleProductionId にリネーム。@map は sample_production_id のままで migration 不要だが参照箇所修正が要る。優先度: 低（実害なし・整合性のみ）。
- B-036: 案件タイプ別のタスク生成テンプレート出し分け（加工のみ/フル制作/ありボディ/ボディ仕入+加工 等で SP 作成時の初期生成を変える）。仕様 v1.0 §3-3「商品カテゴリ等での出し分けは要望が出たら段階拡張」の具体化。優先度: 中。
- B-037: docs 直下の未追跡ファイル整理（docs/CLAUDE.md・各種zip・"docs/files 9〜12/"・docs/package-lock.json・HANDOFF-*.md 等が未追跡で堆積）。誤生成・一時物の整理（削除 or .gitignore or 正しい場所へ）。優先度: 低。

## ⑥ 既存バックログ（継続・未着手）
- B-016 Color拡張(PANTONE/DIC) / B-017 参照データ監査方針 / B-018 出荷・貸出伝票 / B-019 CSVインポート / B-020 quality-label-app統合 / B-021 全マスター監査網羅 / B-022 外部パートナー開放 / B-023 版類在庫(現物資産・再利用判定UI。S-4a で受け皿=PoItem.isPhysicalAsset/保管期限は投入済み) / B-024 自社ブランド在庫 / B-025 量産パターン管理 / B-026 シーズンプルダウン化 / B-027 サムネイル画像 / B-028 品番一覧カテゴリ検索 / B-029 サンプル材料セクション / B-030 数量モデル整理(SKU確定後) / B-031 本番/dev手動投入ズレリスク記録 / B-032 ProductCategory標準シードを seed.ts に追加 / B-034 FactoryProcessingType中間テーブル。
- B-033（dev ドリフト解消）は完了クローズ済み。

## ⑦ コミット/マージ一覧（本セッション）
- 582343c: docs: S-4 仕様確認書 v1.0 + S-4a 実装ブリーフを docs/specs へ保存。
- PR #63 → merged fdb7db8: S-4a 発注連携 schema 受け皿（非破壊・3ファイル/+81）。
- docs: S-4b 仕様確認書 v1.0 保存（本締めで push。次回 git log で確認）。
- docs: 本引き継ぎメモ（SESSION_HANDOVER.md 更新）。

## ⑧ 注意点・教訓
- 並行作業の注意: claude.ai 側で「次は〜」と書いた後、別経路で実装・マージされ得る。セッション開始時は必ず git log origin/main で実態確認してからメモを信頼する。
- Claude.ai 側で作成したファイルは、慎太郎さんがダウンロード→配置→push する方式で docs に入れた（cat <<'EOF' 巨大埋め込みを避けた）。実装ブリーフは Claude Code に本文貼り付けが必要。
- migration 非破壊の確認: ADD COLUMN(nullable/default)/CREATE TYPE/ADD VALUE/CREATE INDEX のみ＝非破壊。DROP/型変更/既存NOT NULL化が出たら止める。新規列の NOT NULL DEFAULT は安全（既存行は default 埋め）。
- enum に値を足すと網羅型(Record<enum,string>)のラベル定義が追従必須＝ビルドが落ちる。enum 追加 PR では対応ラベル1行をセットで入れる。
- WO/PO は業務トランザクションでありマスターパターン(shunya-master-patterns §1 非適用)。8関数構成・住所4分割は当てはめない。伝票独自構成(list/get/create/update/soft-delete)。
- 本番DB操作の鉄則: host 照合(shuttle:16099)→破壊前カウント→1トランザクション→検証。本番PWは Railway Regenerate→必ず Web Redeploy。
- Git運用: docs単独=main直push可 / コード含む=PR必須。docs はファイル add を明示指定し未追跡物の巻き込みを防ぐ。
- 引き継ぎメモ保存の鉄則(shunya-session-handover): ①2箇所出力 ②保存指示は本文を cat <<'EOF' に埋め込む ③保存前に git log origin/main で実態確認。

## ⑨ 次セッション冒頭の手順
1. このメモを貼り付け → 状態復元。
2. git log origin/main --oneline -8 で実態確認。main 最新化。
3. S-4b-1（PO系）実装ブリーフ作成へ。仕様 docs/specs/s-4b-order-creation-spec-confirmation-v1_0-2026-06-08.md §3 を出発点に、schema 真値の横断 grep（S-4a 受け皿列が main にあるか）から開始。
