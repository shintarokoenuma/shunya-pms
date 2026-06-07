# 引き継ぎメモ (2026-06-07 セッション / S-3aマージ完了・dev ドリフト解消・本番PWローテ → 次はS-3)

## ⓪ 最重要・プロジェクト棲み分けルール（毎回必須）
- shunya-pms（リポジトリ shintarokoenuma/shunya-pms・ローカル ~/shunya-production-system・本番 shunya-pms-web-production.up.railway.app）と saagara-v2（別リポジトリ・本番 saagara-v2-production.up.railway.app）は完全に別物。
- VS Code の Claude Code 別ウィンドウで両者を混同した過去あり。Claude Code 向け実装指示書には毎回冒頭に【対象プロジェクト】ヘッダを固定。貼る前に ~/shunya-production-system を開いているか目視確認。
- 【本セッションの裏付け】棚上げコミット 8f821f5（ProductPrice）は saagara 作業の混入と判明＝この棲み分けルールの重要性が実証された。

## ⓪-2 PR URL 3点セット運用（shunya-pr-url-checklist スキル）
- ① マージ前の UI 確認 = ローカル（npm run dev → http://localhost:3000 / dev DB hopper:12921）
- ② マージ操作 = GitHub PR URL（https://github.com/shintarokoenuma/shunya-pms/pull/<番号>）→ マージ = Railway main 自動デプロイ = 本番反映（不可逆）
- ③ マージ後の本番確認 = 本番 URL（https://shunya-pms-web-production.up.railway.app / 本番 DB shuttle:16099）

## ① 本セッションの成果（完了）
- S-3a（ProcessingType 加工種別マスター）完了・本番反映済み。PR #61 → merged d39097f（main）。
  - 初の migration 山。本番デプロイログで Applying migration 20260607021614_add_processing_type_master → successfully applied 確認。
  - model ProcessingType / enum ProcessingTypeStatus(ACTIVE/ARCHIVED) / table processing_types。採番 PRC-{連番3桁}（companyId 単位・保存時確定・プレビューあり）。
  - precedent: Buyer/DeliveryDestination（2値ステータス軽量マスター）。Company 逆リレーション無し（companyId は文字列フィールドのみ）。
  - 8操作（list/get/create/update/archive/restore/checkUsage/deletePermanently）+ 4重ガード物理削除。
  - 既存 enum AiProcessingType（AI処理種別・無関係）には一切触れず。
  - コミット内訳：734c764（論理層+migration）/ 15dd4ad（UI+nav）。
- B-033（dev ドリフト解消・currency-prices 完全破棄）完了。
  - 正体：8f821f5 の migration 20260603092457 が dev DB に適用されていたが対応ファイルが main に無い状態（dev に product_prices テーブル・Incoterms 列2本・Incoterms 型・migration 記録が浮いていた）。
  - 方式B完全破棄：ProductPrice（上代/卸/原価を product×通貨で持つ＝saagara的発想・shunya 業態に不一致）も Incoterms も採用せず、dev ドリフトのみ削除。
  - shunya の正しい価格設計：売価はテーブルに持たず「見積もりエンジン（Phase 1B・BOM→原価集計→マージン4階層継承→売価算出）」が都度計算。原価から売値を出す機能は QuotationEngine が担う。仕様 Part4 §11 の棲み分け表でも「saagara=シンプル単価・原価管理なし / shunya=詳細な原価計算」と明記。
  - 1トランザクションで DROP TABLE product_prices / DROP COLUMN clients.default_incoterms・sales_orders.incoterms / DROP TYPE Incoterms / DELETE _prisma_migrations。破壊前カウント3つとも0（手入力データ無し）確認済み。
  - 検証：migrate diff（schema↔dev）= empty migration ＝ dev と main schema 完全一致＝ドリフト解消の証明。feat/currency-prices-incoterms ブランチ破棄（8f821f5 は到達不能・GC待ち）。
  - 効果：今後 migrate dev が素直に使える（S-3a で deploy 回避が必要だった根本原因が解消）。
- 本番DBパスワードローテーション完了。
  - Railway postgres-production（ab6d/shuttle:16099）の Config → Regenerate Password 実行 → 本番 Web を Redeploy。
  - デプロイログで新パスワードによる DB 接続成功（No pending migrations / Ready）確認。本番 HA 構成（レプリカ2・etcd）でも問題なく反映。
  - 手元 .env.prod.local 削除済み（旧パスワードは無効化済み）。本番認証情報のローカル転記が解消。

## ② dev / 本番 DB の状態
- dev（hopper:12921）：ドリフト解消済み（21 migrations・up to date・schema↔DB 差分なし）。Product 2件（PA-27SS-M-BT-001 / IP-26SS-M-TS-001）温存。processing_types=0（S-3a 検証データ掃除済み）。カテゴリ27件短縮形。
- 本番（shuttle:16099 / postgres-ab6d）：21 migrations 適用済み（S-3a 含む）。品番カルテ1件（IP-26AW-M-BT-001 / test ※採番確認用に残置）・サンプル0件。カテゴリ27件短縮形。processing_types テーブルあり（0件想定）。schema は dev と一致。パスワードはローテーション済み（新パスワードで稼働中）。

## ③ 次セッションで最初にやること（優先順）
1. main 最新化（最新は S-3a マージ d39097f + 本引き継ぎメモ push 後）。
2. 次の山＝S-3（ProgressTask＝進行チェックリスト）。仕様 v1.0 §3「核心・最重要」。慎太郎さんの「仕様書で加工を選ぶ→依頼先を選ぶ」フローの土台。
   - migration あり。ドリフト解消済みなので通常の migrate dev が使える（オフライン diff 回避はもう不要）。
   - schema 真値の横断 grep（ProgressTask は新規モデル）→ 仕様確認（taskType enum・自動生成ロジック・外部開放受け皿フィールド）→ 実装指示書 → PR必須 → dev検証 → 本番は host照合＋三重ガード。

## ④ バックログ（新規・本セッション起票）
- B-033：完了（dev ドリフト解消・currency-prices 完全破棄）。クローズ。
- B-034：FactoryProcessingType 中間テーブル（加工種別ごとの対応可能工場マスター）。WO 作成時の工場プルダウンを「対応工場だけ」に絞る最適化。工場が増えたら検討。※「加工→依頼先を選ぶフロー」自体は S-3→S-4 でカバー済み確認。候補自動絞り込みのみ別途。

## ⑤ 既存バックログ（継続・未着手）
- B-016 Color拡張(PANTONE/DIC) / B-017 参照データ監査方針 / B-018 出荷・貸出伝票 / B-019 CSVインポート / B-020 quality-label-app統合 / B-021 全マスター監査網羅 / B-022 外部パートナー開放 / B-023 版類在庫 / B-024 自社ブランド在庫(消費型/在庫型) / B-025 量産パターン管理 / B-026 シーズンプルダウン化 / B-027 サムネイル画像 / B-028 品番一覧カテゴリ検索 / B-029 サンプル材料セクション / B-030 数量モデル整理(SKU確定後に持つ) / B-031 本番/dev手動投入ズレリスク記録 / B-032 ProductCategory標準シードを seed.ts に追加。
- ※ currency-prices（8f821f5）は破棄済みのためバックログから除外。Incoterms が将来必要なら受注(SalesOrder)を本格実装する Phase で正しく入れ直す。

## ⑥ 実装シーケンス（v1.0 §8 確定）
- S-1（完了）→ S-2（完了）→ S-3a（完了）→ S-3（進行チェックリスト ProgressTask）→ S-4（発注 WO/PO 連携）。
- S-3 以降 migration あり＝dev 検証（migrate dev 使用可）→ 本番は別途明示指示＋host照合（本番 ab6d/shuttle:16099, dev 7492/hopper:12921）＋三重ガード。

## ⑦ 本日コミット/マージ一覧
- PR #61 → merged d39097f（main）：S-3a 加工種別マスター 基本CRUD + migration。内訳 734c764（論理層+migration）/ 15dd4ad（UI+nav）。ブランチ削除済み。
- データ操作（コミットではない）：
  - 本番：パスワードローテーション（Regenerate + Redeploy）。
  - dev：currency-prices ドリフト破棄（DROP TABLE/COLUMN/TYPE + DELETE migration record・1トランザクション）。
  - ローカル：feat/currency-prices-incoterms ブランチ破棄・.env.prod.local 削除。

## ⑧ 注意点・教訓
- 8f821f5 = saagara 混入の教訓：別プロジェクトの作業が紛れ込むと「業態に合わないモデル」が schema に残る。棲み分けルール（⓪）の徹底が再度重要と確認。混入物は「一部救済」より「白紙に戻して必要時に正しく作る」方が安全（Incoterms も今回は破棄）。
- migration ドリフトの判別：migrate status は repo migration の適用済み判定のみで「DB だけにある未追跡物」を警告しない。migrate dev は shadow 比較で検知し reset を促す。ドリフト調査は _prisma_migrations の記録 vs repo の migration ファイルを突合し、migrate diff（schema↔DB）で最終確認。
- 本番DB操作の鉄則（継続）：host 照合（shuttle:16099）→ 破壊前カウント確認 → 1トランザクション → 検証の順。本番パスワードは Railway Config の Regenerate を使い、必ず Web サービスを Redeploy（手動変数編集は認証ズレ事故の元）。
- Git運用：docs単独=main直push可 / コード含む=PR必須。

## ⑨ 次セッション冒頭の手順
1. このメモを貼り付け → 状態復元。
2. main 最新化。
3. S-3（ProgressTask）の仕様確認へ。仕様 v1.0 §3-3 のデータ構造（案C-1 タスク行モデル）を正本に、taskType enum・自動生成の出し分け（定型#1〜#5,#7,#8 は全生成／加工#6 は選択分のみ・processingTypeId 参照）・外部開放受け皿（assigneeType/checkedBy/checkedAt）を論点化。schema 真値の横断 grep から開始。migration は通常の migrate dev でOK。
