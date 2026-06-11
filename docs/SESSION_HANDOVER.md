# 引き継ぎメモ (2026-06-10〜11 セッション / S-4 発注連携 一巡完了・発注書PDF v1.2 まで本番反映)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト(shunya-ivr)の混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)※プロジェクトroot で実行
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)
- ③ マージ後=本番URL + Railwayデプロイログ目視

## ① 本セッションの完了マイルストーン（PR #68〜#75・全て本番反映済み）
- PR #68: dev サンプルマスター一括シード scripts/seed-dev-sample-data.ts（マスター15種・冪等・本番拒否ガード。dev消失復旧手順が prisma/seed.ts→processing-types→本スクリプトで一本化）
- PR #69 (5cc5ed9): S-4b-2 WO系。WorkOrder/WoItem CRUD・採番WO-{年}-{4桁}(P2002のみリトライ)・チェックリスト起点(PATTERN/SEWING/PROCESSING/GRADING活性化)・PROCESSING起点は WO.workType=ProcessingType.workType コピー+processingTypeId引継ぎ(D2)・workCategory=taskType導出+変更可・workOrderCount実値化(E8)・nav「発注(作業WO)」/「発注(仕入PO)」改称
- PR #70 (bf3c735): S-4c-1。recomputeTaskStatus(forward-only・AUTO_FROM_DOC のみ・SKIPPED/BLOCKED不触・降格なし・FABRIC/TRIM/BODYの完了はisReceivedが正・WO系は全件COMPLETEDでDONE)+コスト集計(G3マッピング・denormalized・伝票create/update/delete/status変更で再計算)+PO/WO status変更action&select新設+SPコスト集計カード
- PR #71 (e45300e): S-4c-1.5+1.6。コスト内訳表示(セクション別明細・伝票リンク・集計対象外行はバッジ可視化)+実務語彙拡張(発注先名/品番=supplierItemCode→素材コード/C#色)。B-052起票
- PR #72 (41f6b2e): S-4c-2 発注書PDF v1.0(@react-pdf/renderer+NotoSansJP静的TTF同梱~4.7MB・serverExternalPackages設定・A4縦・社判ヘッダ・明細表・未定除外注記・自動改頁)。route /api/{purchase,work}-orders/[id]/pdf(auth+companyIdスコープ・未認証は307→/login前段遮断)。生成/出力分離(B-053のGCS差し込み構造)
- PR #73 (b793cd5): company-profile.ts 実値の main 取り込み(株式会社shunya / 〒150-0043 東京都渋谷区道玄坂1-22-10 見真ビル1F / TEL 03-5459-1177 / FAX 03-5459-1181 / MAIL info@shunya.cc)。★PR #72マージ後に差し替えた行き違いの修正(教訓⑦参照)
- PR #74 (dc54753): PDF v1.1。対象品番ブロック(「御中」直下にブランド/品名(season)/品番。経路: PO.sampleProductionId / WO.samplProductionId(B-035綴り温存)→SP.productId→Product(productName/品番=primaryProductCode[先方品番優先]/season)→Brand.brandName。未紐付けはnull非表示)+数量/単位の2列分離
- PR #75 (1af616a): PDF v1.2。数量/単位の間隔拡大(数量paddingRight 14pt/単位paddingLeft 12pt・列幅 数量単位各11%・品名26%)。慎太郎さん視認「完璧」
- docs直push: eeaa587(S-4c仕様v1.0)・aeeb9d0(S-4c-2仕様v1.0)
- ★本番で実運用データ入力開始（SP-2026-0003・天竺PO・VIVAN WO等）。コスト集計・発注書PDFが実データで稼働確認済み

## ② 仕様確定（本セッション）
- S-4c v1.0 (docs/specs/s-4c-auto-recompute-spec-confirmation-v1_0-2026-06-10.md): G1 forward-only / G2 evidenceMode(6種生成時AUTO_FROM_DOC・既存MANUALは対象外放置) / G3 集計マッピング(資材=PO全部・パターン=PATTERN|GRADING・縫製加工=SAMPLE合算・やり直し=REWORK・PRODUCTION/ADDITIONALは集計外・未定/非JPY除外) / G4 同一トリガー / G5 S-4c-1/2分割
- S-4c-2 v1.0 (docs/specs/s-4c-2-order-pdf-spec-confirmation-v1_0-2026-06-11.md): H1 react-pdf+NotoSansJP / H2 オンデマンド生成→GCS保存はB-053(運営前必須・レイアウト確定後) / H3 最小レイアウト→実物レビューで調整(v1.1/v1.2で実施済み) / H4 送付=B-049・縫製仕様書帳票=B-054(最終フェーズ)
- 実Excel縫製仕様書を原本参照として記録(社判ブロック・資材表語彙[仕入先/品番/C#/数量/単価]・付属表/サイズ表/詳細図タブ構造はB-054の設計材料)

## ③ Railway環境マッピング（本ファイル§③が唯一の正）
- 本番DB: postgres-production / postgres-ab6d / shuttle.proxy.rlwy.net:16099（27 migrations・本セッション migration 追加なし）
- dev DB: postgres-development / hopper.proxy.rlwy.net:12921（db push運用・_prisma_migrations無し）
- dev は db push / 本番は Railway migrate deploy の二系統。dev に migrate dev は打たない。

## ④ dev DB 状態
- マスター: seed-dev-sample-data.ts 投入済み120件(Client/Brand/Supplier/Factory/Contractor/Buyer/DD/ModelCode/Material/カテゴリ2種/Color51/CostCategory39/TextilePatternType9)+processing_types 10
- SP-2026-0001(タスクはevidenceMode=MANUAL=自動算出対象外・PO/WO検証データぶら下がり)・SP-VERIFY-S4C1(AUTOタスク・PO-VERIFY-*/WO-VERIFY-*・コスト¥42,000)・[S4B2-VERIFY] WO3件
- 検証データは温存中。掃除は任意(UIのsoft-deleteで可)

## ⑤ 次セッションの優先順
1. B-053: 発注書PDFのGCS保存統合(運営開始前・必須)。レイアウトはv1.2で確定済みのため着手可。GCPコンソール手順書(バケット+サービスアカウント+Railway環境変数)を Claude が用意してから実装ブリーフ
2. ★次の山 = 見積もりエンジン(Phase 1B 最重要)の仕様確認開始。入口で B-039(規格・サイズ構造化=用尺数値化)+B-052(量産見積・原反取り切り: 必要量=用尺×数量×(1+ロス率)→反数=切り上げ(必要量÷原反長)→反数×反単価。原反長列はMaterial未存在で設計時追加)+原反長マスター項目を一緒に設計。実績原価(S-4c-1)との「見積vs実績」突合がB-044オーナー指標に直結
3. ついで回収候補: B-048(PO採番リトライのP2002限定修正・WO側は適用済み)
4. ローカル古ブランチ掃除(マージ済み約20本: phase1a系・S-1/S-2系・s4c系等。git branch -d で安全に)

## ⑥ バックログ（本セッション起票/更新）
- B-048: generatePoNumber リトライのエラー分類(P2002のみリトライ・他は伝播)。WO側は#69で適用済み・PO側未対応
- B-052: 量産見積・原反取り切り計算(docs/phase1a-improvement-backlog.md に詳細記載済み)
- B-053: 発注書PDFのGCS保存統合(運営前必須・レイアウト確定済みで着手可)
- B-054: 縫製仕様書の帳票出力(最終フェーズ・実Excel構造が原本)
- (S-4c仕様書内) B-049: 送付フロー / B-050: totalProcessingCost専用列 / B-051: 非JPY換算集計
- 継続: B-020/B-023〜028/B-031(dev消失実例追記未了)/B-034/B-035(samplProductionId綴り温存中)/B-036/B-037/B-038〜041/B-043〜047

## ⑦ 注意点・教訓（本セッション）
- ★マージとブランチ作業の順序行き違い: PR #72 を慎太郎さんがマージ+ブランチ削除した後に Claude Code が同ブランチへ実値差し替えを積み、孤立ブランチ化(main未反映・本番はプレースホルダのまま)。push出力の「* [new branch]」が再作成のサイン。fd9c013をcherry-pickしてPR #73で回収。教訓: マージ前に「差し替え系の追加コミットが全て済んでいるか」を確認してからマージ依頼を出す。Claude(.ai)側も「マージしてください」を出すタイミングを差し替え完了報告の後にする
- 古いNextAuth JWT: dev DB再seed後はブラウザの旧ユーザーIDが audit_logs FK違反を起こす→ログアウト/再ログインで解消(6/10実例)
- 採番リトライがFK違反を「採番衝突」に偽装してデバッグを妨げた(B-048の動機)。新規採番実装はP2002のみリトライが標準
- recomputeTaskStatus検証で「効かない」と見えたらまず対象タスクの deletedAt/evidenceMode を疑う(soft-delete済みタスクを掴んでいた実例)
- ProgressTaskStatus には仕様書未記載の BLOCKED があり「不触」で実装(SKIPPED同様・調整余地)
- PO/WO の status 変更手段は S-4c-1 で新設(それまでDRAFT固定)。status変更も再計算トリガー
- react-pdf: serverExternalPackages 必須・フォントはfontsource静的TTF(japanese subset・各2.3MB)・CJK改行はregisterHyphenationCallbackで文字単位・帳票の品番表示はprimaryProductCode(先方品番優先)を踏襲
- 未認証APIはアプリauth層が307→/loginで前段遮断(route側401はfallback)。アプリ共通挙動
- npm run dev はプロジェクトroot で。git log のページャは q で抜ける
- 引き継ぎメモ: ①2箇所出力 ②保存指示は本文cat<<'EOF'埋め込み ③保存前にgit log origin/mainで実態確認

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元
2. git log origin/main --oneline -5 で先頭確認(1af616a=PR#75 か、その後のdocsコミット)
3. main最新化・ローカルブランチ掃除(feat/s4c2-pdf-v1_1, feat/s4c2-pdf-v1_2, chore/s4c2-company-profile-real 等)
4. ⑤の優先順で着手(B-053 GCS手順書 → 見積もりエンジン仕様確認)
