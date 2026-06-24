# SESSION_HANDOVER.md — shunya-pms 引き継ぎメモ（Session 12）

最終更新: 2026-06-24 / 作成: Claude.ai（Session 12 締め）

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
- Session 12 は「実装（B-067）→ B-065 方向転換 → フロー全体の棚卸し協議 → 元設計との照合」まで。
- **次セッションの大テーマ = ID体系・番号・紐付けの全体棚卸し**（下記⑤）。

## ② 未マージPR・検証状態
- **PR #93（B-067 D4ア・資材所要量セクション）= マージ済み**（commit 082f5fd・本番反映済み・feature ブランチ削除済み）。
- **PR #94（B-065・PO→BOM 取り込みカラーウェイ指定）= OPEN のまま保留**。
  - 破棄せず残す方針（現実装は「全くダメではない」ので作り直しの参考にする）。
  - branch: `feat/b-065-po-import-colorway`。tsc/lint/build クリーン。
  - ただし「主従が逆」と判明済みで、作り直し前提。

## ③ dev DB 状態
- dev DB: `hopper.proxy.rlwy.net:12921`（安全・db push 運用）。Session 12 で dev DB スキーマ変更なし（#93 は schema/migration なしの client 計算のみ）。
- 本番 DB: `shuttle.proxy.rlwy.net:16099`（明示承認＋トリプルゲート必須）。Session 12 で本番DB書き込みなし。

## ④ 直近の spec ファイル名
- `docs/specs/b-067-quantity-usage-po-spec-confirmation-v1_0-2026-06-23.md`（#93 の確定仕様・D1〜D6）
- `docs/specs/b-065-po-import-colorway-spec-confirmation-v1_0-2026-06-23.md`（B-065 v1.0・E1〜E6。ただし方向転換で作り直し対象）
- 元設計（project knowledge・2026-05-16 スナップショット、参照用）: Part1〜4 / quotation_engine / invoice_system_and_fta 他

## ⑤ 次セッションの優先順位（順序つき）
着手順は **(い) 棚卸し → (あ) 見積もり** で確定。

1. **【最優先】ID体系・番号・紐付けの全体棚卸し**
   - 目的: 「発注が品番に確実に紐づかない」「番号体系が脆い」を根本から整理。B-065/B-069 の上流土台。
   - 段取り（協議済み）:
     - 範囲 = **(中) 生産フロー全体**（Product/ModelCode/SampleProduction/ProgressTask/PO/WO/PoItem/WoItem ＋ BOM/Sku/ProductColorway/Material/Collection）
     - 粒度 = **1モデル1ブロック ＋ 論点付箋（問いの形・結論は出さない）**
     - 提出 = **docs に Markdown 本体（例 `id-map-and-linkage-audit-v0_1`）＋ チャットに論点サマリ**
     - **動線も含める**（主要導線の searchParams/props で ID がどう渡る/落ちるか）
   - 入口 = Claude.ai が read-only 抽出ブリーフを出す（schema の ID マップ＋採番箇所＋FK＋脆い紐付け＋主要動線の ID 受け渡し）。慎太郎さんは整理済みを判断するだけ（負荷最小化）。
   - ⚠ Claude 単独で完結させない（実務事実に依存・慎太郎さんのチェックが安全弁）。半日自走は不可（1ターン応答のため）。

2. **【次】見積もり（QE-1）**
   - 元設計 `quotation_engine.md` に詳細設計済み（BOM→原価自動集計 QuotationCostBreakdown・QuotationType SAMPLE/MASS/FINAL・4階層マージン・為替±5%再見積）。今日の「仕入コスト×個数＋工賃＝発注dataから自動算出」とほぼ一致。#93（資材所要量）の自然な続き。

3. B-065 作り直し（発注側にカラーウェイを持たせる方向。下記⑥参照）→ その後 B-069。

## ⑥ メモ・残課題

### B-065 方向転換の経緯（重要）
- 当初 v1.0（#94）は「取り込みダイアログで PO 明細ごとに ITEM/COLORWAY モード選択」。
- 慎太郎さんレビューで **主従が逆**と判明。正: 資材（品目）を先に立て、その下に各色の C/# がぶら下がる。
- さらに発展 → 「**発注の際にカラーウェイ（マスターカラー）を入力すれば、取り込みは区分選択だけで済む**」。費目（CostCategory）はコスト体系のマスターなので**触らない**。
- recon で判明した土台の問題:
  - **発注フォームは品番（productId）を選んでいない**。`productId` は `sampleProductionId` 経由でサーバ導出のみ（`progressTaskId` 単独だと `primaryProductId` は null）。
  - カラーウェイ（`listColorways` は productId 必須）を発注フォームで出すには、先に「品番を確定する経路」が要る。
  - PoItem に `productColorwayId` 列が無い（色は colorCode 文字列のみ）。
- → これらは **ID体系棚卸し（⑤-1）の後**に B-069（発注にカラーウェイを構造で持たせる）として設計。

### フロー全体マップ（Session 12 で作成・3分割）
- 前半（引き合い→品番→サンプル）／中盤（カラー/BOM/SKU→発注）／後半（受注[将来]→納品請求＋横断マスター）。
- マップ上の赤=Claude の記憶ベース推測（番号採番式・FK 任意/必須）。**次段で実スキーマ read-only 裏取りが必要**。

### 元設計との照合結果（6項目・Session 12 で確定）
- **#1 サンプル/量産の2周構造・都度請求** = ほぼ一致（QT-SAMPLE/QT-MASS で2見積は spec 想定済み。サンプル"請求"独立の明記は薄く要補強）。
- **#2 見積もりフェーズ（発注data→自動算出）** = 一致（quotation_engine.md に詳細設計済み）。
- **#3 貿易書類=量産前の素材輸出・免税製造** = **spec の穴（欠落）**。元 spec の貿易は「製品輸出の FTA/原産地証明」のみ。「生地・素材をベトナムに無償支給し免税で製造させる書類（無償支給・賃加工）」は概念ごと無い。慎太郎さん「一番必要・量産前に要る」。
- **#4 買側の請求×発注照合・不備検出** = **spec に無い新規**。
- **#5 パターン/仕様書=用尺・付属規格の源泉** = 部分的。DesignVersion（パタンナー受領）構造はあるが「仕様書から用尺・ボタン数等を読み取って発注欄へ自動投入」は spec を超える。まず「仕様書・パターンから用尺を読み込む設定」を検討。入力経路2案=(あ)メール添付の自動読込/(い)パタンナーがログインして登録。
- **#6 議事録→タスク化・メール読取（AI入力層）** = 部分的。Part3 に「文字起こしツール（Claude製）iframe統合」あり。議事録→タスク自動起票・メール→カレンダー/タスク一元管理は今日の拡張。

### サンプル製作=ハブという認識（Session 12 で言語化）
- サンプルで手配する資材は全て**その品番のコストに紐づく**。
- サンプル段は **BOM × コスト × 用尺が交差する複雑なハブ**。サンプル SKU は議事録/手入力で進行。
- 工場発注は**仕様書（パタンナー由来・絵型含む）ベース**。
- 「サンプル作成から**帳票**が紐づく」（※「長表」は誤り→「帳票」が正）。

### AI連動（やりたいこと整理・後段テーマ）
- Gmail / Google カレンダー / Slack / Notion 連携。
- 会議文字起こし→システム登録候補・タスク候補を一覧→タスク漏れ防止の一元管理。
- メールの請求書・納品連絡を読み取ってカレンダー/タスクに追加。

### 未取得の参考資料
- 慎太郎さんのドライブ（仕様書・パターン）共有リンクは **Claude から直接開けない**。仕様書を設計に反映するには、代表的な1枚を**会話に直接アップロード**が必要（次段で #5 に着手するとき）。

## ⑦ 本日マージしたPR
- **#93**（B-067 D4ア・資材所要量セクション）commit 082f5fd。

---

## 【継続指示】（慎太郎さんより・最優先）
- **このログ（Session 12 の議論）は都度読み直す**: セッションをまたいでも conversation_search / recent_chats でこの一連（フロー全体・追加6項目・訂正・照合結果）を復元してから進める。
- **元々の設計と照らして異なる所を比較し、良い方で進める**: 今日の照合（⑥）を起点に、新規/欠落（#3#4）は設計から、設計済み（#2）は spec を読んで着手判断。

## 環境メモ（再掲）
- main 先頭: 082f5fd（#93）
- dev start: lsof -ti:3000,3001 | xargs kill -9 → npx prisma generate → rm -rf .next → npm run dev
- git: 明示パスのみ（add -A 禁止）。docs単独→main直push可。コード→featureブランチ+PR（squash）。
- PR 3ゲート: ①ローカル目視(localhost:3000/dev DB) ②GitHub merge=Railway自動デプロイ=本番(不可逆) ③本番確認。
