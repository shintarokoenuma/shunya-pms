# 引き継ぎメモ (2026-06-06 セッション / 仕様v1.0確定・currency-prices棚上げ・S-1完了 → 次はS-2)

## ⓪ 最重要・プロジェクト棲み分けルール（毎回必須）
- shunya-pms（リポジトリ shintarokoenuma/shunya-pms・ローカル ~/shunya-production-system・本番 shunya-pms-web-production.up.railway.app）と saagara-v2（別リポジトリ・本番 saagara-v2-production.up.railway.app）は完全に別物。
- 過去に VS Code の Claude Code 別ウィンドウで両者を混同した経緯あり（最悪 saagara 本番に shunya 変更が乗る事故リスク）。
- 対策：(1) Claude Code 向け実装指示書には毎回冒頭に【対象プロジェクト】ヘッダを固定で入れる。(2) 貼る前に VS Code のそのウィンドウが ~/shunya-production-system か目視確認。

## ① 本セッションの成果（完了）
- **仕様議事録 v1.0 確定**：`docs/specs/product-sample-spec-confirmation-v1_0-2026-06-06.md`（main `e0a3130`）。§9 の6論点すべて確定。これが唯一の正（古い 06-03 版は別物）。
- **S-1（品番カルテ基本CRUD）完了・本番反映済み**。PR #59 マージ（merged commit `53c0da5`）→ Railway 本番デプロイ Success（本番DB postgres-ab6d、No pending migrations＝schema 無変更）→ 本番 smoke test 問題なし。
- **currency-prices-incoterms を保全棚上げ**：`8f821f5`（feat/currency-prices-incoterms 上・未 push・ローカルのみ）。記憶曖昧の未コミット作業を消さず A案で保全。正式採用は「PR化→dev dry-run backfill→マージ」。

## ② S-1 で実装したもの（本番稼働中）
- 社内品番採番 `{brandCode}-{season}-{categoryCode}-{連番3桁}`（全大文字。season も大文字正規化＝コミット `d75da87`）。保存時確定・選択時プレビュー。
- ModelCode 自動発番（A案）：createProduct の同一 tx で `M-{brandCode}-{4桁}` を裏で発番し modelCodeId 充填（NOT NULL を schema 無変更で満たす）。UI 非表示。modelName=productName。
- clientId は Brand.clientId から導出（フォーム非表示）。categoryId は Zod 必須（schema は optional 据え置き）。
- clientProductCode 常設。品番表示の主従ヘルパー（clientProductCode||productCode）。
- status は ProductStatusHistory に記録。archive→ARCHIVED、restore は履歴ベースで直前 status に復元。
- 8関数＋採番プレビュー。update の AuditLog snapshot は B-015 型保険（全42スカラ satisfies）。物理削除は MASTER_ADMIN・ARCHIVED・確認名・参照0の4重ガード。checkUsage は skus+collectionLinks。
- 1A-12 撤去（案2・可逆）：型番ナビ hidden＋model-codes 各ページに MASTER_ADMIN ガード。ファイル温存。

## ③ dev / 本番 DB の状態
- dev（hopper:12921）：S-1 検証データ（PA-26SS-K-OT-001 / PA-26ss-M-OT-001 ＋ ModelCode M-PA-0002/0003）は検証後に物理削除で掃除済み。クリーン。
- 本番（ab6d/shuttle:16099）：smoke test で1件作成（残置か削除かは要判断。smoke 用なら後で archive→物理削除可）。schema 無変更。
- 孤児 ModelCode（Product 物理削除時に自動発番 ModelCode が残る件）は現状のまま＝B-025 申し送りで確定。

## ④ 次セッションで最初にやること（優先順）
1. main 最新化（`git checkout main && git pull origin main`／最新は `53c0da5`）。
2. **S-2（SampleProduction 骨格）の実装指示書を作成**。SP採番 `SP-2026-0042`・ラウンド管理（parentSampleId 系譜）・既存 status enum・チェックリスト連動は初期手動。schema 無変更見込み（既存 SampleProduction 利用）。S-1 と同じく master-patterns 準拠・PR 必須・dev 検証→本番 smoke。
3. S-1 の実装指示書（`s-1-product-crud-implementation-brief-2026-06-06`）は docs 未保存のままなら docs/ に保存しておくと参照しやすい（docs 単独=main 直push 可）。
4. 本番 smoke データの後始末（残すか消すか）。

## ⑤ バックログ（新規・本セッション起票／S-1 dev検証で発生）
- **B-023**：版類（型・版・パターン・刺繍パンチ）の在庫管理・再利用判定。保管期限つき現物資産、生地/付属（消費型）と別カテゴリ。最初の山では PO 受け皿のみ。
- **B-024**：自社ブランドの生地・付属・織りネーム在庫。OEM=消費型/自社=在庫型の区別を在庫設計の前提に組む申し送り。
- **B-025**：量産パターン管理（型・版・品番の3層／パターン番号=型の幹で不変・洗い等の縮率違い=同番号の別版・品番=版を使う各量産案件）。ModelCode を型の串に活用。リピート導線もここ。三位一体の中身に踏み込むため後続。
- **B-026**：シーズンのプルダウン化（大文字のみ・26SS/26AW 等）＋年度との重複解消（年度をシーズンから導出 or 統合するか要設計）。
- **B-027**：品番カルテにサムネイル画像（画像アップロード基盤が必要・後続）。
- **B-028**：品番カルテ一覧にカテゴリ検索追加（軽量・次の小改修で B-026 と一緒に入れられる）。

## ⑥ 既存バックログ（継続・未着手）
- B-016 Color 拡張(PANTONE/DIC) / B-017 参照データ系の監査方針 / B-018 出荷・貸出伝票ページ / B-019 CSVインポート / B-020 quality-label-app 統合（品質表示タスクと連携）/ B-021 全マスター監査スナップショット網羅強制 / B-022 外部パートナー開放（進行チェックの受け皿は v1.0 §7 に反映済）。

## ⑦ 実装シーケンス（v1.0 §8 確定）
- S-1（完了）→ **S-2（SampleProduction）** → S-3a（ProcessingType マスター）→ S-3（進行チェックリスト ProgressTask）→ S-4（発注 WO/PO 連携）。
- S-1・S-2 は schema 無変更見込み。S-3a 以降は migration あり＝dev 検証→本番は別途明示指示＋host照合（本番 ab6d/shuttle:16099, dev 7492/hopper:12921）＋三重ガード全面適用。

## ⑧ 本日コミット/マージ一覧
- `e0a3130`（main）：仕様議事録 v1.0 を docs/specs/ に追加。
- `f7e87e7`（main）：引き継ぎメモ更新（前セッション分）。
- `8f821f5`（feat/currency-prices-incoterms・未push）：currency-prices 保全棚上げ。
- PR #59 → merged `53c0da5`（main）：S-1 品番カルテ基本CRUD＋ModelCode自動発番＋1A-12導線撤去＋シーズン大文字化。ブランチ削除済み。

## ⑨ 注意点
- Git運用：docs単独=main直push可 / コード含む=PR必須（shunya-git-workflow）。
- 業務トランザクションは S-3a 以降 migration を伴う。safety-check 全面適用。
- currency-prices（8f821f5）は良いタイミングで PR 化。S-1 とは独立。

## ⑩ 次セッション冒頭の手順
1. このメモを貼り付け → 状態復元。
2. main 最新化（53c0da5）。
3. S-2 実装指示書づくりへ（必要なら既存 SampleProduction schema を横断 grep で真値確認してから）。
