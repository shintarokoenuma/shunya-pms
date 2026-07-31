# SESSION_HANDOVER.md（2026-07-28 締め / B-081・B-080・B-083 本番リリース＋(B) PR #113 Part1-8 完成）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（github.com/shintarokoenuma/shunya-pms / ~/shunya-production-system /
本番 shunya-pms-web-production.up.railway.app）。saagara-v2 とは完全に別物。
★localhost:3000 は saagara-rebuild が使用中。shunya-pms の dev は PORT=3001。

## ① 現在フェーズと完了状態
- フェーズ: 業務トランザクション期・量産軸 (B) 量産発注生成。
- 本セッション完了（本番リリース済み3本）:
  - **PR #110（3c5d661）**: B-081 サイドバー並び順。本番目視確認済み。
  - **PR #111（0283a38）**: B-080 PE 明細マスターピッカー＋QE-1R SearchableSelect 化。
    BOM は乖離のため停止→B-087 起票。本番確認済み。
  - **PR #112（754f8f3）**: B-083 調達区分。migration 43本目
    （20260726000000_procurement_route_colorway）を triple-gate 完走
    （dev db push→本番 dry-run 合格 pe_items 3/3・po_items 4・colorway 0→
    マージ→migrate deploy 適用・deploy ログ検収済み）。
    enum ProcurementRoute＋PE item.procurementRoute＋PoItem.productColorwayId。
    分子計上は COMPANY_ARRANGED のみ（calc コア単一点・test 12/12）。
- **(B) 仕様確認書 v0.1 確定・保存済み**（230e9ef・
  docs/specs/production-order-generation-spec-confirmation-v0_1-2026-07-26.md・
  project knowledge 登録済み）。R-a〜R-f 全確定。
- 慎太郎さんが dev で初生成を実機確認済み（PE-2026-0001 → PO/WO-2026-0005）。
  「生成後の所在が見えない」フィードバック → Part 6-8 で第一弾対応済み。

## ② 未マージ PR（2本 open・どちらも migration なし）
- **PR #113** feat/b-production-order-generation（8コミット・HEAD 0adce80）:
  Part1 PoItem.productColorwayId 配管＋PO DRAFT 編集ゲート／Part2 B-074／
  Part3 生成コンテキスト／Part4 生成画面／Part5 生成パイプライン／
  **Part6 品番カルテ「発注（PO/WO）」セクション（id="orders"・DRAFT amber・
  量産タグ）／Part7 PO 詳細カラーウェイ名表示／Part8 生成後 #orders 着地**。
  Playwright 27/27＋11/11。PR 本文に Part6-8 追記済み。
- **PR #114** fix/b088-checkbox-click-area（12ea444）: B-088 チェックボックス
  クリック範囲修正。8/8 PASS。独立・いつでもマージ可。

## ③ dev DB の状態
- 接続先 dev = hopper.proxy.rlwy.net:12921。本番 = shuttle:16099（Claude Code 接続禁止）。
- **PO-2026-0005・WO-2026-0005「量産発注（PE-2026-0001）」が dev に現存**
  （慎太郎さんの確認用・削除しないこと）。
- PE-2026-0001（分母100・最終4200）/ PE-2026-0002（300枚見積もり）現存。
- VERIFY 系残留 0（全検証データ物理削除済み・実データ無傷確認済み）。
- 本番 DB: migration 43本適用済み。

## ④ ナレッジ登録状況（鉄則4）
- production-order-generation-spec-confirmation-v0_1-2026-07-26.md 登録済み。
- 未同期の新規 spec なし。

## ⑤ 次セッションで最初にやること（優先順）
1. **慎太郎さんの UI/動線フィードバック**（2026-07-28 夜「使いづらい・
   わかりづらい。動線と UI を考える。私も考えるがクーも考えて」→ 一晩置いて
   詳細を聞く約束）。Part 6-8 のローカル再確認と合わせて改善方針を確定。
   議論待ちの案: 生成結果サマリ画面/ダイアログ・生成画面の2段構成化
   （数量入力→プレビュー確認→実行）等。
2. ローカル確認 → **#114 マージ → #113 マージ**（どちらも migration なし）→
   本番確認（#113 は本番での生成実行はせず表示確認まで）。
3. マージ後、(B) の残タスク整理（下記⑥）。

## ⑥ 申し送り・バックログ
- **B-088**: チェックボックスクリック範囲（PR #114・マージ待ち）。
- **B-089（新規起票）**: PO/WO update action 自体の DRAFT ガード
  （現状 edit ページのみゲート・直リクエストは全 status 更新可）。優先度中。
- **B-087**: BOM 素材 Select の SearchableSelect 化（個別設計・(B) の後）。
- (B) 後続の種: procurementRoute の PoItem/WoItem への値運搬・
  本番初生成の立ち会い手順・生成 UX 改善（フィードバック待ち）。
- 既存: B-072〜B-077・B-082a/b・B-084・B-086。

## ⑦ 本日マージした PR
- PR #110: feat/b081-sidebar-order → 3c5d661
- PR #111: feat/b080-pe-master-picker → 0283a38
- PR #112: feat/b083-procurement-route → 754f8f3（migration 43本目・本番適用済み）
- docs 直 push: 230e9ef（(B) 仕様確認書 v0.1）

## ⑧ 設計確定事項（本セッション）
- (B) R-a〜R-f 確定（spec v0.1 参照）。
- B-074: workOrderInputSchema の refine で PRODUCTION 全行数量一致
  （create/update 共通・items root エラーのインライン表示追加）。
- 生成は既存 createPurchaseOrder/createWorkOrder を再利用（採番複製禁止・
  文書間非アトミック）。calc から computeRequirement/computeMaterialProcurement
  export 抽出（挙動不変・test 9/9）。
- 品番カルテ発注セクション: 品番直結（PO.primaryProductId/WO.productId）を
  新しい順・DRAFT amber 強調・量産タグ emerald 強調。

## ⑨ 運用の教訓（本セッション追加）
- 複数 PR 並行時のローカル確認は git branch --show-current の案内から始める
  （「ボタンが無い」の原因は起動ブランチ違いだった）。
- spec の「一覧で見える状態にする」は受け皿 UI まで実装ブリーフに落とす
  （リダイレクトだけ実装し受け皿が無かった）。
- 列を新設したら保存配管だけでなく詳細画面の表示まで同 PR で通す
  （productColorwayId が PO 詳細で「カラー: —」のままだった）。
- page.waitForFunction の options は第3引数（第2引数に渡すと arg 扱いで
  timeout が既定 30s のまま）。Playwright の同型ミス2回目・要注意。
- git push がハングする一過性ネットワーク劣化あり。ls-remote で到達性を
  切り分け・間隔を空けたリトライで回復（バックグラウンド放置は不可）。
- .next はブランチ切替で stale になる → rm -rf .next で再検査。
