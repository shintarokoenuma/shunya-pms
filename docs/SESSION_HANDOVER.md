# 引き継ぎメモ (2026-06-12 セッション / B-053・B-055 完了・QE-0a/0b 本番反映・次は QE-0c→QE-1)

## ⓪ プロジェクト棲み分け（毎回必須）
- shunya-pms（shintarokoenuma/shunya-pms・~/shunya-production-system・shunya-pms-web-production.up.railway.app）と saagara-v2 は完全に別物。実装指示書は冒頭に【対象プロジェクト】ヘッダ固定。貼る前に ~/shunya-production-system を開いているか目視。
- docs/CLAUDE.md は別プロジェクト(shunya-ivr)の混入ファイル。無視。docs 整理は B-037。

## ⓪-2 PR URL 3点セット
- ① マージ前UI確認=ローカル(npm run dev→localhost:3000 / dev hopper:12921)※プロジェクトroot で実行
- ② マージ=GitHub PR→Railway自動デプロイ=本番反映(不可逆)
- ③ マージ後=本番URL + Railwayデプロイログ目視

## ① 本セッションの完了マイルストーン（全て本番反映済み・PR番号順）
- PR #76 (317d2df): B-053 発注書PDF の GCS 控え保存。src/lib/gcs.ts 新設（@google-cloud/storage・
  serverExternalPackages 追加）。uploadOrderPdf(kind/orderNumber/buffer/timestamp?)・パス規約
  {kind}/{orderNumber}/{yyyyMMdd-HHmmss}.pdf（履歴保持・上書きなし）。env3つ(GCP_PROJECT_ID/
  GCS_BUCKET_NAME/GCP_SERVICE_ACCOUNT_KEY_BASE64)を Base64→JSON 復号して credentials 直渡し。
  ★graceful degradation: 未設定/失敗は console.error(キー非表示)で null・例外投げず PDF 返却を阻害しない。
  PO/WO の pdf route に結線。生成/出力分離（H2）。
- PR #77 (c367f4a): B-055 タイムスタンプ JST 化。gcs.ts の timestampJst()（UTCエポック+9h→getUTC*・
  コンテナTZ非依存）。さらに DL ファイル名を {orderNumber}_{yyyyMMdd-HHmmss}.pdf にし、route で
  stamp を1回生成して GCS 控えと DL名のタイムスタンプを一致（突合可能）。
- QE-0 仕様確定（docs 直push）: a912b0d 含む。qe-0-quotation-foundation-spec-confirmation-v1_0-2026-06-12.md
  （Q1〜Q6 + 用尺入力2系統 + 正誤 + v1.1追補）。
- PR #78 (01d629a): QE-0a 見積基盤 schema。★着手時に Specification/Bom/BomItem(+enum)が既存
  （元設計20260516由来・休眠・データ0件）と判明 → 案A=既存 Bom を Product 直結へ拡張で確定:
  - Bom: specificationId 必須→nullable@unique 緩和 / productId(scalar)追加 / @@index([companyId,productId])
  - BomItem: usagePerUnit・unitPrice を必須→nullable 緩和 / procurementMode・usageSource(@default MANUAL)・
    markingRecordId 追加（itemCategory 既存必須維持・deletedAt は無し=cascade管理）
  - Material: rollLength/rollPrice 追加（fabricWidth/standardLossRate/standardUsage は既存流用）
  - MarkingRecord 新設 + enum FabricProcurementMode{ROLL,METER}/UsageSource{MANUAL,MARKING_SHEET,CAD}
  - migration 1本(非破壊: CREATE TYPE/TABLE/INDEX + ADD COLUMN群 + DROP NOT NULL×2)。dev は db push。
- PR #79 (2844f21): QE-0b BOM(資材表) CRUD。品番カルテ詳細に「資材表（BOM）」カード。
  validators/bom.ts(materialId XOR custom / 数値範囲) / actions/boms.ts(createBom 冪等・getBomByProductId・
  addBomItem/updateBomItem/deleteBomItem 物理削除 + select補助) / bom-section.tsx(追加/編集モーダル+削除)。
  素材選択で 単位/ロス率/単価/仕入先 を初期表示・ロス込み用尺/1着概算を参考表示(非保存)。usageSource は
  MANUAL 固定・markingRecordId は UI 非対象(QE-0c)。
- docs 直push: B-056(マーキングAI読み取り)・B-057(資材表→PO下書き生成) 起票。QE-0 v1.1追補
  (BOM役割定義=品番直結の現時点の正・BomItem3項目追加方針)。

## ② B-053 GCS の確認状況（重要）
- SA = shunya-pms-storage@shunya-pms.iam.gserviceaccount.com（project shunya-pms）。
- dev バケット shunya-pms-documents-dev: 書き込みOK（uploadOrderPdf 単体 + ブラウザ DL で確認済み）。
- 本番バケット shunya-pms-documents-prod: 当初 403(storage.objects.create 権限なし)→慎太郎さんが権限付与→
  再診断で write→delete OK 確認済み。
- Railway 本番に env3つ設定済み（本番は GCS_BUCKET_NAME=shunya-pms-documents-prod）。
  ローカル .env は dev バケット（GCS変数も設定済み）。

## ③ Railway環境マッピング（本ファイル§③が唯一の正）
- 本番DB: postgres-production / postgres-ab6d / shuttle.proxy.rlwy.net:16099
  （本セッション read-only 確認時点で _prisma_migrations=44・finished_at is null=0 で健全。
   QE-0a #78 マージ後に +1 適用される）。本番URLはローカル .env に無し→ Railway CLI の
   DATABASE_PUBLIC_URL から取得（PWは表示しない運用）。
- dev DB: postgres-development / hopper.proxy.rlwy.net:12921（db push運用・_prisma_migrations無し）。
- dev は db push / 本番は Railway migrate deploy の二系統。dev に migrate dev は打たない。

## ④ dev DB 状態
- QE-0a 反映済み（db push）: bom/bom_items/marking_records テーブルあり・全0件。materials に roll_length/roll_price。
- マスター: seed-dev-sample-data.ts 投入済み120件 + processing_types 10。
- 検証残置データ: SP-2026-0001 / SP-VERIFY-S4C1(PO-VERIFY-*/WO-VERIFY-*・コスト集計検証用) /
  [S4B2-VERIFY] WO。掃除は任意(UI の soft-delete)。QE 検証は新規 [QE0x-VERIFY] を作って都度後始末する流儀。

## ⑤ 次セッションの優先順
1. QE-0c: BomItem に supplierItemCode / designNumber / sizeSpec を追加（QE-0 v1.1 §Q2）+ BOM 編集UIへ反映。
   併せて MarkingRecord の UI（用尺入力系統B・1着用尺自動導出）+ 原本PDF の GCS 添付（B-053 基盤を流用）。
   ※ schema 変更（BomItem 3列・MarkingRecord.originalFileGcsPath は既存）あり→ migration 1本。
2. QE-1: 量産見積計算（原反取り切り）= B-052 本体。
   必要量=用尺×数量×(1+ロス率) → 反数=切り上げ(必要量÷原反長) → 反数×反単価。procurementMode ROLL/METER で分岐。
   実績原価(S-4c-1)との「見積 vs 実績」突合が B-044 オーナー指標に直結。
3. B-057: 資材表→PO 下書き生成（QE-0c/QE-1 の後）。
4. 回収候補: B-048(PO採番リトライのP2002限定・WO側は適用済み)。
5. ★現場Excel参照資料の格納（保留中）: docs/reference/ に 27SS各プラント管理表 / INSONNIA_SMASHING_25SS
   コスト表 / 裏地マーカー図(SY16-16SY-082).pdf + 構造メモ を入れる予定だったが、~/Downloads が
   アクセス不可(Operation not permitted)で原本コピー不可・メモ本文も未受領のため未着手。
   → 原本をアクセス可能な場所(Desktop 配下 or リポジトリ内)に置く or Downloads アクセス権付与が必要。
   QE-1 設計の原本資料。

## ⑥ バックログ（本セッション起票/更新・docs/phase1a-improvement-backlog.md）
- B-056: マーキング図PDF/パターンデータの AI 自動読み取り（Phase 1E・MarkingRecord+原本添付が基盤）。
- B-057: 資材表→PO 下書き生成（QE-0c/QE-1 後）。
- B-047: CAD連携の用尺見込み計算（東レCAD等・MarkingRecord.source=CAD 予約済み）。
- 継続: B-048 / B-049(発注書送付) / B-050(totalProcessingCost専用列) / B-051(非JPY換算) /
  B-052(量産見積=QE-1) / B-053(本番反映済・要バケット運用) / B-054(縫製仕様書帳票・最終フェーズ) /
  B-039(規格サイズ構造化) / B-020/B-023〜028/B-031/B-034/B-035(samplProductionId綴り温存中)/B-036/B-037/
  B-038/B-040/B-041/B-043〜046。

## ⑦ 注意点・教訓（本セッション）
- ★既存 schema の事前精査を必ず行う: QE-0a で Bom/BomItem/Specification が既存と判明（ブリーフは新設前提）。
  着手前 grep で衝突回避→案A(既存拡張)に切替えた。新規モデル作成系のブリーフは必ず同名/類似モデルの
  存在を schema で確認してから着手。
- Material 既存カラムの重複回避: fabricWidth/standardLossRate/standardUsage は既存。新規は roll系2列のみ。
  既存モデルにカラム追加すると audit snapshot の Record<...Field,unknown> が網羅エラーになる
  （materials.ts の beforeData/afterData に rollLength/rollPrice を追加して修復）。
- GCS 切り分け: dev で動いても本番バケットは別途権限が要る（403 storage.objects.create）。
  診断は使い捨てスクリプトで client_email/project_id のみ表示・private_key/Base64 は絶対に出さない。
- 本番DB read-only 確認は Railway CLI の DATABASE_PUBLIC_URL を変数に取り込み host 照合のうえ SELECT のみ。
  PW は表示しない。書き込み/ALTER/migration はしない。
- squash merge のため git branch --merged は0件になる。マージ済みローカルブランチ掃除は gh で PR state=MERGED
  を確認して git branch -D（feat/qe0a-bom-marking-schema が現在ローカル残存・#78マージ済みで削除可）。
- BomItem は deletedAt 無し=物理削除（削除は確認ダイアログ+AuditLog snapshot で痕跡）。
- ~/Downloads はこの環境からアクセス不可。原本ファイルはアクセス可能な場所に置いてもらう。
- 引き継ぎメモ: ①2箇所出力 ②保存指示は本文 cat<<'EOF' 埋め込み ③保存前に git log origin/main で実態確認。

## ⑧ 次セッション冒頭の手順
1. このメモを貼り付け→状態復元。
2. git log origin/main --oneline -5 で先頭確認（2844f21=PR#79、またはその後のdocsコミット）。main 最新化。
3. ローカル残ブランチ掃除（feat/qe0a-bom-marking-schema は #78マージ済み・git branch -D で削除可）。
4. ⑤の優先順で着手: QE-0c（BomItem 3項目 + MarkingRecord UI + PDF添付）→ QE-1（取り切り計算）。
   現場Excel参照資料の格納はアクセス可能な場所に原本が置かれ次第。
