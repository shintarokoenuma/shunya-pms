# 引き継ぎメモ (2026-06-07/08 セッション / S-3a・S-3マージ完了・dev ドリフト解消・本番PWローテ → 次はS-4)

## ⓪ 最重要・プロジェクト棲み分けルール（毎回必須）
- shunya-pms（リポジトリ shintarokoenuma/shunya-pms・ローカル ~/shunya-production-system・本番 shunya-pms-web-production.up.railway.app）と saagara-v2（別リポジトリ・本番 saagara-v2-production.up.railway.app）は完全に別物。
- VS Code の Claude Code 別ウィンドウで両者を混同した過去あり。実装指示書には毎回冒頭に【対象プロジェクト】ヘッダを固定。貼る前に ~/shunya-production-system を開いているか目視確認。
- 【裏付け】棚上げコミット 8f821f5（ProductPrice）は saagara 作業の混入と判明＝棲み分けルールの重要性が実証された（本セッションで完全破棄）。

## ⓪-2 PR URL 3点セット運用（shunya-pr-url-checklist スキル）
- ① マージ前の UI 確認 = ローカル（npm run dev → http://localhost:3000 / dev DB hopper:12921）
- ② マージ操作 = GitHub PR URL → マージ = Railway main 自動デプロイ = 本番反映（不可逆）
- ③ マージ後の本番確認 = 本番 URL（https://shunya-pms-web-production.up.railway.app / 本番 DB shuttle:16099）+ Railway デプロイログ目視

## ① 直近の完了マイルストーン
- S-3a（ProcessingType 加工種別マスター）完了・本番反映済み。PR #61 → merged d39097f。
  - model ProcessingType / enum ProcessingTypeStatus(ACTIVE/ARCHIVED) / table processing_types。採番 PRC-{連番3桁}（companyId 単位・保存時確定）。precedent: Buyer/DD。8操作+4重ガード物理削除。既存 enum AiProcessingType は無関係・不変更。
- S-3（ProgressTask 進行チェックリスト）完了・マージ済み。PR #62 → merged ec0b339（author shintaro・2026-06-08）。
  - model ProgressTask + enum 5本（ProgressTaskType/Phase/Status/EvidenceMode/AssigneeType）+ migration 20260607133904_add_progress_task_checklist。
  - SP（ラウンド）作成時に SAMPLE 定型8種を自動生成（A-2＝ラウンド単位）。PROCESSING 行は ProcessingType マスター参照で都度追加/削除（B-2・手入力不可）。
  - evidenceMode は MANUAL 固定・linked系FK持たない（伝票連携は S-4 で伝票側に progressTaskId? を足す方針）。status は全タスク手動チェック（DONE化で checkedByUserId/checkedAt 記録）。FABRIC/TRIM は入荷フラグ別持ち。
  - recomputeTaskStatus は空殻・発注書ボタンは位置のみ非活性（S-4 縫い代）。既存 SP 救済の generateTasksForRound（冪等ガード）。SP create フックが唯一の既存ロジック変更。物理削除は 4重ガード。UI: SP詳細に進行チェックリストセクション。9ファイル/+1262。
  - dev 反映済み（22 migrations・up to date・ドリフトなし）。本番は ec0b339 マージで Railway 自動 deploy 経路。【要確認】本番デプロイログ目視（Applying migration 20260607133904 → successfully applied）。
- B-033（dev ドリフト解消・currency-prices 完全破棄）完了。8f821f5 の product_prices テーブル・Incoterms 列2本・Incoterms 型・migration 記録(20260603092457)を dev で DROP（1トランザクション・破壊前カウント0確認）。migrate diff=empty ＝ dev↔main 一致。feat/currency-prices-incoterms ブランチ破棄。→ 今後 migrate dev が素直に使える。
  - shunya の価格設計：売価はテーブルに持たず見積もりエンジン（Phase 1B・BOM→原価集計→マージン4階層継承→売価算出）が都度計算。ProductPrice(上代/卸/原価ベタ持ち)は saagara 的発想で shunya 業態に不一致。
- 本番DBパスワードローテーション完了。Railway postgres-production(ab6d) Regenerate → 本番 Web Redeploy → 新PWで接続成功確認。.env.prod.local 削除済み（本番接続情報のローカル転記を解消・以後ローカルから本番DB直接接続は不可）。.gitignore にも .env.prod.local を明示追加（8017721）。

## ② dev / 本番 DB の状態
- dev（hopper:12921）：22 migrations・up to date・ドリフトなし。Product 2件温存。processing_types=0 / progress_tasks テーブルあり（S-3 検証データの有無は次セッション要確認・残っていれば掃除）。カテゴリ27件短縮形。
- 本番（shuttle:16099 / postgres-ab6d）：S-3a・S-3 migration がマージ経由で適用済み（見込み・要デプロイログ目視）。品番カルテ1件（IP-26AW-M-BT-001 / test 残置）。カテゴリ27件短縮形。パスワードはローテーション済み。本番DBへローカルから直接接続する手段は現在なし（必要時は .env.prod.local を再作成→使用後ローテ&削除）。

## ③ 次セッションで最初にやること（優先順）
1. main 最新化（git pull origin main）。git log origin/main --oneline -8 で実態確認（メモとのズレがないか）。
2. 【未実施なら】S-3 の本番デプロイログ目視（migration 20260607133904 が本番に successfully applied か）。S-3 の dev 検証データが残っていれば掃除。
3. 次の山＝S-4（発注 WO/PO 連携）。S-3 で開けた縫い代（伝票側 progressTaskId? / recomputeTaskStatus 空殻 / 発注書ボタン非活性）に中身を入れる。仕様 v1.0 §3 + docs/specs/s-3-progress-task-implementation-brief-2026-06-07.md の「S-4 縫い代」記述が出発点。migration あり＝通常の migrate dev でOK。PR必須・dev検証→本番は host照合+三重ガード。

## ④ バックログ（本セッション起票）
- B-033：完了（dev ドリフト解消・currency-prices 完全破棄）。クローズ。
- B-034：FactoryProcessingType 中間テーブル（加工種別ごとの対応可能工場マスター）。WO 作成時の工場プルダウンを「対応工場だけ」に絞る最適化。工場が増えたら検討。

## ⑤ 既存バックログ（継続・未着手）
- B-016 Color拡張(PANTONE/DIC) / B-017 参照データ監査方針 / B-018 出荷・貸出伝票 / B-019 CSVインポート / B-020 quality-label-app統合 / B-021 全マスター監査網羅 / B-022 外部パートナー開放 / B-023 版類在庫 / B-024 自社ブランド在庫 / B-025 量産パターン管理 / B-026 シーズンプルダウン化 / B-027 サムネイル画像 / B-028 品番一覧カテゴリ検索 / B-029 サンプル材料セクション / B-030 数量モデル整理(SKU確定後) / B-031 本番/dev手動投入ズレリスク記録 / B-032 ProductCategory標準シードを seed.ts に追加。
- ※ currency-prices(8f821f5)は破棄済み。Incoterms が将来必要なら受注(SalesOrder)を本格実装する Phase で正しく入れ直す。

## ⑥ 実装シーケンス（v1.0 §8 確定）
- S-1（完了）→ S-2（完了）→ S-3a（完了）→ S-3（完了）→ S-4（発注 WO/PO 連携）。
- S-4 以降 migration あり＝dev 検証（migrate dev 使用可）→ 本番は別途明示指示＋host照合（本番 ab6d/shuttle:16099, dev 7492/hopper:12921）＋三重ガード。

## ⑦ コミット/マージ一覧（本セッション周辺）
- PR #61 → merged d39097f：S-3a 加工種別マスター。
- 33f2a90：引き継ぎメモ更新（S-3a完了時点）。
- PR #62 → merged ec0b339：S-3 進行チェックリスト（author shintaro・2026-06-08）。
- 8017721：.gitignore に .env.prod.local 追加。
- 5450746：S-3 実装指示書を docs/specs へ保存。
- ba9025a：引き継ぎメモ微修正。
- （本コミット）：引き継ぎメモ更新（S-3完了・次はS-4）。
- データ操作（コミットではない）：本番PWローテ / dev currency-prices ドリフト破棄 / ローカル currency ブランチ破棄・.env.prod.local 削除。

## ⑧ 注意点・教訓
- 8f821f5 = saagara 混入の教訓：別プロジェクト作業が紛れ込むと業態に合わないモデルが schema に残る。混入物は「一部救済」より「白紙に戻して必要時に正しく作る」方が安全。
- migration ドリフトの判別：migrate status は repo migration の適用済み判定のみ。DB だけにある未追跡物は migrate diff（schema↔DB）で検知。
- 本番DB操作の鉄則：host 照合（shuttle:16099）→ 破壊前カウント → 1トランザクション → 検証。本番PWは Railway Config の Regenerate → 必ず Web を Redeploy。
- 並行作業の注意：本セッションは claude.ai 側で「次はS-3」とメモを書いた後、別経路で S-3 が実装・マージされた。引き継ぎメモと実態がずれ得るので、セッション開始時は必ず git log origin/main で実態を確認してからメモを信頼する。
- Git運用：docs単独=main直push可 / コード含む=PR必須。

## ⑨ 次セッション冒頭の手順
1. このメモを貼り付け → 状態復元。
2. git log origin/main --oneline -8 で実態確認。main 最新化。
3. S-3 本番デプロイログ目視（未実施なら）。
4. S-4（発注 WO/PO 連携）の仕様確認へ。S-3 指示書の「S-4 縫い代」を出発点に、schema 真値の横断 grep から開始。
