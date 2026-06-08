# 引き継ぎメモ (2026-06-08 セッション / S-4b-1 完了・本番反映 → 次は S-4b-2 WO系)

## ⓪ 最重要・プロジェクト棲み分けルール（毎回必須）
- shunya-pms（リポジトリ shintarokoenuma/shunya-pms・ローカル ~/shunya-production-system・本番 shunya-pms-web-production.up.railway.app）と saagara-v2（別リポジトリ・本番 saagara-v2-production.up.railway.app）は完全に別物。
- VS Code の Claude Code 別ウィンドウで両者を混同した過去あり。実装指示書には毎回冒頭に【対象プロジェクト】ヘッダを固定。貼る前に ~/shunya-production-system を開いているか目視確認。

## ⓪-2 PR URL 3点セット運用（shunya-pr-url-checklist スキル）
- ① マージ前の UI 確認 = ローカル（npm run dev → http://localhost:3000 / dev DB hopper:12921）
- ② マージ操作 = GitHub PR URL → マージ = Railway main 自動デプロイ = 本番反映（不可逆）
- ③ マージ後の本番確認 = 本番 URL（https://shunya-pms-web-production.up.railway.app / 本番 DB shuttle:16099）+ Railway デプロイログ目視

## ① 直近の完了マイルストーン
- S-4b-1（仕入先発注 PurchaseOrder/PoItem CRUD・進行チェックリスト紐付け）完了・本番反映済み。PR #64 → squash merged b31fef0。
  - 本番 migration 2本適用済み（Railway デプロイログ "All migrations have been successfully applied"・25 migrations・postgres-ab6d 目視）:
    - 20260608070416_s4b1_po_item_practical_fields（ADD supplier_item_code/design_code ×2 + 単価/小計 DROP NOT NULL ×2 ※v1.1）
    - 20260608133328_s4b1_size_value_unit（DROP COLUMN size_spec + ADD size_value Decimal(15,4)/size_unit VarChar(10) ※v1.2）
  - 中身: 骨格(list/get/create/update/soft-delete・採番 PO-{年}-{4桁}保存時確定・poType=STANDARD/allocationType=DIRECT 固定・progressTaskId/sampleProductionId 紐付け・sampleProductionId→primaryProductId 導出・1タスク複数PO/1PO1タスク・E8 suppliers.purchaseOrderCount 実値化・nav発注 enabled) + 実務化v1.1(明細に仕入先品番/デザイン番号/カラー(colorCode)/仕様(specification)/メモ(notes)・金額未定=unitPrice/subtotal nullable・行subtotal=quantity×unitPrice・単位プルダウン+自由入力・カット代は明細行で表現) + tx timeout(create/update の $transaction に {timeout:15000}) + v1.2(サイズを数値sizeValue+単位sizeUnit(cm/mm/m/inch・L不使用)に分解・数量単位に g 追加)。
  - 起点UI: 進行チェックリストの FABRIC/TRIM/BODY タスク行「発注を作成」活性化→PO新規(progressTaskId/sampleProductionId 引き継ぎ)。PATTERN/SEWING/PROCESSING は「S-4b-2 で実装予定」で非活性のまま。
- 仕様確定文書（すべて docs/specs・main 反映済み）:
  - s-4b-order-creation-spec-confirmation-v1_0-2026-06-08.md（§3=PO系骨格 E1〜E8）
  - s-4b-1-purchase-order-spec-addendum-v1_1-2026-06-08.md（実務化 F1〜F8）
  - s-4b-1-purchase-order-spec-addendum-v1_2-2026-06-08.md（サイズ数値化 G1〜G3）

## ② dev / 本番 DB の状態
- dev（hopper:12921）: 25 migrations・up to date。po_items に慎太郎さんのローカルテスト PO「PO-2026-0001 生地」（ブロード/カット代の2明細・v1.1時代作成のため size_spec→sizeValue/sizeUnit は未入力）が残置。掃除は任意。progress_tasks=10（S-3検証データ温存）/ processing_types=2 / Product 2件。
- 本番（shuttle:16099 / postgres-ab6d）: 25 migrations 適用済み（S-4b-1 含む・デプロイログ確認済み）。purchase_orders は本番ではまだ0想定（smoke で作れば増える）。品番カルテ1件（IP-26AW-M-BT-001 / test 残置）。パスワードはローテーション済み（ローカルから本番DB直接接続は不可）。

## ③ 次セッションで最初にやること（優先順）
1. main 最新化（git pull origin main）。git log origin/main --oneline -8 で実態確認（先頭 b31fef0 のはず）。
2. S-4b-2（WO 系）の実装ブリーフ作成 → Claude Code 実装。仕様は s-4b-order-creation-spec-confirmation-v1_0 §4（方針確定のみ・詳細は着手時に詰める）。
   - WorkOrder + WoItem の採番(WO-{年}-{4桁}・保存時確定)・CRUD actions(list/get/create/update/soft-delete)・最小フォーム。
   - 起点=進行チェックリストの PATTERN/SEWING/PROCESSING タスク行「発注を作成」(現在「S-4b-2 で実装予定」で非活性)を活性化→ progressTaskId/processingTypeId 紐付け。
   - 発注先: PATTERN→contractor(パタンナー) / SEWING→factory / PROCESSING→factory or contractor。刺繍(D社=factory登録)も WO 側。
   - PROCESSING タスク起票時はそのタスクの processingTypeId を WO の processingTypeId に引き継ぐ(S-4a 受け皿)。
   - factories.ts/contractors.ts の workOrderCount を実値化(E8)。
   - WoItem の実務化(PO で入れた supplierItemCode/designCode/colorCode/sizeValue/sizeUnit/specification 相当)が要るか着手時に判断。要るなら migration（WoItem は現状これらを持たない＝PoItem と違い未拡張。schema 真値 grep 必須）。PO は v1.1/v1.2 で拡張済みだが WoItem は別テーブルで未拡張な点に注意。
   - 既存 patternWoId/sewingWoId（SampleProduction）は別系統として温存。S-4 の正は progressTaskId 経由。
3. その後 S-4c（自動算出 recomputeTaskStatus + 発注書ボタン本実装 + コスト集計）。発注書PDFもこの段（v1.1 §F8: 項目は構造で持つまで完了済み）。

## ④ 実装シーケンス（更新）
- S-1〜S-3a・S-3（完了）→ S-4a（完了・本番反映）→ S-4b-1（PO系・完了・本番反映）→ **S-4b-2（WO系・次）** → S-4c（自動算出/発注書/集計）。

## ⑤ 本セッション起票のバックログ
- B-038: 見積もり→量産マスター化→候補提示（サンプル時の見積もり単価を素材マスターの標準単価候補として自動で育てる。AI 費目マッピングと地続き）。PO に費目/素材/単価/詳細を構造化済み＝基盤。優先度: 中〜将来。
- B-039: 規格・サイズの構造化（数値統計・用尺計算・輸出）。sizeValue/sizeUnit は v1.2 で長さ系を構造化済み。生地幅・巻き/反の数値化や用尺式はここ。優先度: 将来。
- B-040: ファスナーの軸分解（スライダー/エレメント/テープ/長さ/仕様）。現状は colorCode/sizeValue/specification に集約。優先度: 将来。
- B-041: 製品サイズ展開（S/M/L）を Product 側で扱う（SKU・数量モデル B-030 と統合検討）。優先度: 将来。
- B-042: （欠番・tx timeout は v1.2 PR に同梱済みのため起票せず）
- B-043: マルチペルソナ・ビュー構想。同一データ基盤上に立場別ビュー（デザイナー=デザインマップ/工場背景・MD=納品スケジュール/売上実績・オーナー=資金管理/前年対比/今後の展開）。デザイナーは「サンプル作成より前段階」のツール（企画・ムードボード・工場背景・素材見当）が要る＝営業時にデザイナー/オーナーへプレゼンする入口になる。実装は業務トランザクション一巡後。当面は各機能設計時に「このデータは将来どのペルソナのビューに出るか」を意識して構造化。優先度: 将来（構想）。
- B-044: 事業構想。主たる将来の売り先は10名以下の小規模アパレルブランドへのサブスク導入。営業はまず自社で完成・運用してから。利用形態が2分岐: (1)OEM生産管理目線=サンプル売り立て中心(現在構築中) (2)自社ブランド向けサブスク=売り立て無し・在庫管理/Shopify連動必須・サンプル代/初期費用/版・パターン代を初期コスト＝原価として按分・版/パターンの資産管理。オーナーに刺さる指標=サンプル費用対売上/継続品番バランス/アイテム別受注率/オンライン消化率。B-020/B-024/B-043 と地続き。設計指針: OEM目線と自社ブランド目線で「売り立ての有無・在庫の型・原価按分」が分岐することを各機能設計時に意識。優先度: 将来（構想）。

## ⑥ 既存バックログ（継続・未着手）
- B-016 Color拡張(PANTONE/DIC) / B-017 参照データ監査方針 / B-018 出荷・貸出伝票 / B-019 CSVインポート / B-020 quality-label-app統合(自社ブランド向けで Shopify 連動と一体) / B-021 全マスター監査網羅 / B-022 外部パートナー開放 / B-023 版類在庫(現物資産・再利用判定UI。S-4a で受け皿=PoItem.isPhysicalAsset/保管期限は投入済み) / B-024 自社ブランド在庫(OEM=消費型/自社ブランド=在庫型) / B-025 量産パターン管理 / B-026 シーズンプルダウン化 / B-027 サムネイル画像 / B-028 品番一覧カテゴリ検索 / B-029 サンプル材料セクション / B-030 数量モデル整理(SKU確定後・製品サイズ展開 B-041 と関連) / B-031 本番/dev手動投入ズレリスク記録 / B-032 ProductCategory標準シードを seed.ts に追加 / B-034 FactoryProcessingType中間テーブル / B-035 WorkOrder.samplProductionId 綴りミス修正 / B-036 案件タイプ別タスク生成テンプレート出し分け / B-037 docs直下の未追跡ファイル整理。
- B-033（dev ドリフト解消）は完了クローズ済み。

## ⑦ コミット/マージ一覧（本セッション）
- PR #64 → squash merged b31fef0: S-4b-1 仕入先発注(PO) 一式（骨格 + v1.1実務化 + tx timeout + v1.2サイズ数値化・migration2本・非破壊）。
- a11a8d7: docs S-4b-1 仕様追補 v1.1。
- 333232d: docs S-4b-1 仕様追補 v1.2。
- docs: 本引き継ぎメモ（SESSION_HANDOVER.md 更新）。

## ⑧ 注意点・教訓
- migration の段階停止が有効だった: SQL 生成→Claude.ai に報告→承認→push の順を S-4b-1 v1.1/v1.2 で2回守った。特に v1.2 は DROP COLUMN size_spec を含んだが、本番未マージ+dev データ0(size_spec_not_null=0)で実害ゼロを確認してから進めた。DROP を含む migration は「本番に未リリースの中間カラムを作り替える」のか「本番データのある列を消す」のかを必ず切り分ける。
- 仕様は実機で触ると変わる: S-4b-1 は骨格→ローカル操作→実務化(v1.1)→さらにサイズ入力しづらい→数値分解(v1.2)と3段で育った。ローカル UI 確認を必ず挟む価値。
- WoItem は PoItem と別テーブル: PO は v1.1/v1.2 で明細を実務化拡張したが、WoItem は未拡張。S-4b-2 で同等の実務化が要るか着手時に判断（要るなら migration・schema 真値 grep 必須）。
- $transaction timeout: 遅延 remote DB で既定5秒超過→部分コミット孤児が出た実績。create/update に {timeout:15000} を入れた。WO 系(S-4b-2)の create/update tx も同様に入れる。
- npm run dev のポート取り合い: 古い next dev が 3000 を握っていると新起動が exit 1 で自己終了。lsof -ti :3000 | xargs kill で掃除してから起動。dev サーバは慎太郎さん自身のターミナルでフォアグラウンド起動が把握しやすい。
- 本番DB操作の鉄則: host 照合(shuttle:16099)→破壊前カウント→1トランザクション→検証。本番PWは Railway Regenerate→必ず Web Redeploy。
- Git運用: docs単独=main直push可 / コード含む=PR必須。docs はファイル add を明示指定し未追跡物の巻き込みを防ぐ。
- 引き継ぎメモ保存の鉄則(shunya-session-handover): ①2箇所出力 ②保存指示は本文を cat <<'EOF' に埋め込む ③保存前に git log origin/main で実態確認。

## ⑨ 次セッション冒頭の手順
1. このメモを貼り付け → 状態復元。
2. git log origin/main --oneline -8 で実態確認（先頭 b31fef0）。main 最新化。
3. S-4b-2（WO系）実装ブリーフ作成へ。仕様 s-4b-order-creation-spec-confirmation-v1_0 §4 を出発点に、WorkOrder/WoItem の schema 真値 横断 grep（WoItem が PoItem 相当の実務化列を持つか・採番 woNumber・S-4a 受け皿 progressTaskId/processingTypeId）から開始。
