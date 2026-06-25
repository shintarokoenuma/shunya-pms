# SESSION_HANDOVER.md — shunya-pms 引き継ぎメモ（Session 13）

最終更新: 2026-06-25 / 作成: Claude.ai（Session 13 締め）

---

## 【プロジェクト棲み分けルール】（最優先・毎回確認）
- 本プロジェクト = **shunya-pms**
  - repo: `shintarokoenuma/shunya-pms` / local: `~/shunya-production-system`
  - 本番: `shunya-pms-web-production.up.railway.app`
- **saagara-v2 とは完全に別物**（別repo・別本番 `saagara-v2-production.up.railway.app`）。過去に Claude Code ウィンドウで混線事故あり。
- Claude Code 向け実装ブリーフには必ず `【対象プロジェクト】` ヘッダ（repo/local/本番URL ＋「saagara-v2 とは別物」）を付す。実行前に VS Code が `~/shunya-production-system` を開いているか目視確認。

---

## ① アクティブフェーズと到達状態
- フェーズ: 業務トランザクション期。北極星（品番ワンページ）5要素は実装済み・本番反映済み。
- Session 13 は **ID体系・番号・紐付けの全体棚卸し（⑤-1）を完了**し、`id-map-and-linkage-audit-v0_1` を docs 保存。要件A/B を §5 に確定。
- コード・schema・DB は未変更（本日は read-only 抽出＋docs 保存のみ）。

## ② 未マージPR・検証状態
- **PR #94（B-065・PO→BOM 取り込みカラーウェイ指定）= OPEN のまま保留**（変化なし）。
  - branch: `feat/b-065-po-import-colorway`。主従が逆と判明済みで作り直し前提。
  - 作り直しは ID体系棚卸し（完了）→ B-069 設計の流れに吸収される見込み。
- 本日マージ＝docs 単独の main 直 push のみ（PR なし）。

## ③ dev DB 状態
- dev DB: `hopper.proxy.rlwy.net:12921`（安全・db push 運用）。Session 13 で dev DB 変更なし。
- 本番 DB: `shuttle.proxy.rlwy.net:16099`（明示承認＋トリプルゲート必須）。Session 13 で本番DB書き込みなし。

## ④ 直近の spec ファイル名
- **`docs/specs/id-map-and-linkage-audit-v0_1-2026-06-25.md`（本日確定・棚卸し v0.1・144行）** ← 次の設計の土台
- `docs/specs/b-067-quantity-usage-po-spec-confirmation-v1_0-2026-06-23.md`（#93 確定仕様）
- `docs/specs/b-065-po-import-colorway-spec-confirmation-v1_0-2026-06-23.md`（B-065 v1.0・作り直し対象）
- 元設計（project knowledge・2026-05-16 スナップショット、参照用）: Part1〜4 / quotation_engine / invoice_system_and_fta 他

## ⑤ 次セッションの優先順位（順序つき）

1. **【最有力】B-069 本体設計（発注にカラーウェイ＝実際は「品番」を構造で持たせる）**
   - 棚卸し §5 の確定方針＝**案α'**: 通常は `PoItem.productId` を1列持たせ要件A（productCode→1STサンプル素材を `where:{productId}` で直接辿る）を解決。按分は休眠 `PoAllocation` を起こす（本体は Phase2/3）。
   - B-069 本体の核（§3・§7）= **PO↔品番の解決一本化**: 既存3経路（primaryProductId / progressTaskId / sampleProductionId・すべて scalar/optional）と新設 `PoItem.productId` の関係をどう締めるか。〔Q4〕作成時に品番解決を強制するか〔Q6〕@relation 化するか validator 止まりか。
   - 着手前に必ず棚卸し v0.1 を読み直す（設計根拠は §5・§3 に宿る）。

2. **【次】見積もり（QE-1）**
   - 元設計 `quotation_engine.md` に詳細設計済み（BOM→原価自動集計・1枚あたり原価＝Σ用尺×ロス×単価・QuotationType SAMPLE/MASS/FINAL）。
   - 棚卸しで確定した要件A（1枚単価＝製品単価インクルード費目÷枚数・色粒度不要）と地続き。#93（資材所要量）の自然な続き。

3. B-065 作り直し（B-069 に吸収 or その後）。

## ⑥ メモ・残課題

### 本日の確定事項（棚卸し v0.1 §5）
- **要件A**: productCode 起点で「1STサンプルに使った素材」を辿る粒度は **品番(productId)で確定・色(カラーウェイ)粒度は不要**。根拠＝1枚単価は「製品単価インクルード費目÷枚数」で出せる（product-sample-spec §6-2 売り立て区分）。素材は品番に1 BOM・色共通ベース・C/# のみ色別。色で素材が本質的に変わるものは別品番運用。
- **要件B（按分）**: OEM 発注は productCode を跨ぐ（1反を複数型で按分／裏地を複数品番共通）。`PoAllocation`（po_allocations）が**設計済みだが src 参照0件＝休眠**。`poItemId?`/`productId`(scalar)/`allocatedQuantity`(req)/`allocatedAmount?`/`allocationPercent?` で慎太郎さんの2例に構造対応。粒度は品番まで（色なし）＝要件A と一致。**採用＝案α'**。按分本体は **Phase 2 or 3**。今は「ベースを壊さない」のみ。

### 採番の現物事実（Q1 訂正済み）
- 5関数すべて「**最大番号 desc +1**」方式（count/max 不使用・deletedAt 除外なし）。soft-delete 含めても番号重複は起きない＝当初の「件数+1」懸念は否定。
- 残リスク: 〔Q1a〕並行レース（B-048 retry を Product/ModelCode/SP/WO へ横断適用候補）／〔Q1b〕文字列降順ソートの桁あふれ（実害は **Product 3桁=999/シーズン×カテゴリ**）／〔Q1c〕hard-delete 巻き戻り。

### §7 次段の宿題（棚卸しに記載・別起票候補）
- hard-delete 経路の有無（Q1c 判定）。
- Product 3桁=999 上限の扱い（Q1b）。
- 「色が変われば別品番」の**明文化**（品番設計 spec へ1行・小 B 起票候補）。
- 採番 retry の横断適用（B-048 拡張）。

### 触らないガード（轍ガード・棚卸し §6）
- ProductColorway.colorId（B-063）/ patternId（B-066-③・色×パターン爆発回避で意図的に @relation なし）。
- BomItem.purchaseOrderId / markingRecordId が scalar・FK なし（house style・安定参照は PO 本体 id）。
- Bom.productId が scalar（QE-0a house style）。
- WorkOrder.`samplProductionId` の綴り（B-035・意図的温存）。

### 元設計照合・フロー全体マップ（Session 12 から継続・未着手の追加項目）
- #3 貿易書類＝量産前の素材無償支給・免税製造（spec の穴・最優先で要る）／#4 買側の請求×発注照合・不備検出（spec に無い新規）／#5 仕様書・パターン→用尺自動投入（spec 超え・入力経路2案）／#6 議事録→タスク化・メール読取（AI入力層）。
- #5 に着手するときは代表仕様書1枚をこの会話に直接アップロードが必要（Claude はドライブ共有リンクを直接開けない）。

## ⑦ 本日マージしたPR
- PR なし。docs 単独の main 直 push 1件: **`30ee37e`**（ID体系棚卸し v0.1）。

---

## 【継続指示】（慎太郎さんより・最優先）
- **棚卸し v0.1 と Session 12/13 の議論は都度読み直す**: セッションをまたいでも `conversation_search` / `recent_chats` で復元してから進める。設計根拠は記憶でなく `id-map-and-linkage-audit-v0_1` と実スキーマに宿る（色マスターの轍ガード）。
- **元設計と照らして異なる所を比較し、良い方で進める**。

## 環境メモ（再掲）
- main 先頭: `30ee37e`（ID体系棚卸し v0.1）
- dev start: `lsof -ti:3000,3001 | xargs kill -9` → `npx prisma generate` → `rm -rf .next` → `npm run dev`
- git: 明示パスのみ（add -A 禁止）。docs単独→main直push可。コード→featureブランチ+PR（squash）。
- PR 3ゲート: ①ローカル目視(localhost:3000/dev DB) ②GitHub merge=Railway自動デプロイ=本番(不可逆) ③本番確認。
