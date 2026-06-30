# shunya-pms セッション引き継ぎメモ（2026-07-01）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
- 対象: shunya-pms（repo: github.com/shintarokoenuma/shunya-pms / local: ~/shunya-production-system / 本番: shunya-pms-web-production.up.railway.app）
- saagara-v2 とは別物。Claude Code 着手前に VS Code が ~/shunya-production-system を指しているか目視確認。

## 1. 本セッションの最重要事項（見積もりの框の組み直し）
今日の核心は「(あ)(い) という文字ラベルで見積もりを組んでいたのが誤りで、サンプルと量産は別軸だと確定したこと」。
旧構想メモ v0.1 の前提（サンプル見積の2段階＝(あ)概算/(い)納品金額）は誤り。実体は別軸が2つ並んでいた。最終的に業界標準形に着地:

- サンプル軸（サンプル請求）= サンプルを作って納める代金。実際に作るので金額は固い。初期費用（パターン代・版代・パンチ代・サンプル代）が別項目で乗る＝1枚原価に溶かさない（絶対防衛線）。概算段階は持たない。サンプルの概算見積は不要。
- 量産軸（量産見積：概算→確定）=
  - 概算: 仕様・素材確定前に「単価・MOQ・条件」を出して交渉に乗せる。発行履歴として保存する（いつ・いくら・MOQ・どの条件で出したか）＝保存型。
  - 確定: 仕様確定後の正式見積。QE-1 v1.0（取り切り・数量別単価・確定原価）が確定計算の本体。概算は QE-1 確定見積の前段。

決定事項:
- (あ)(い) の文字ラベルは廃止。今後は「サンプル請求」「量産見積（概算/確定）」という現実の名前で呼ぶ（文字ラベルは中身が空で何度も裏返ったため）。
- 旧構想メモ v0.1（sample-quotation-concept-v0_1-2026-06-30.md）の §0/§2 は框ごと組み直し対象。次セッションで改訂 or 後継メモ。

## 2. 完了状態・本セッションのコミット
- 直近マイルストーン（前セッション）: QE-1 量産見積計算 仕様確認書 v1.0（43cf194・量産・確定計算・計算ビューのみ・スキーマ変更なし）
- 本セッションのコミット（いずれも docs 単独・main 直 push）:
  - edcd47a: サンプル見積 構想メモ v0.1（docs/specs/sample-quotation-concept-v0_1-2026-06-30.md）※ 框は旧前提。記録として残置、内容は組み直し対象。
  - 89af2b0: QE-1 v1.0 §0 末尾にサンプル見積との相互リンク1行追記（量産/サンプル取り違え再発防止）
- main 先頭: 89af2b0

## 3. 未マージ PR
- 本セッションでの未マージ PR は無し（docs 単独・main 直 push のみ）。

## 4. DB 状態
- 本セッションで DB 書き込みは一切無し（docs のみ・migration 無し）。
- dev=hopper.proxy.rlwy.net:12921（postgres-7492）/ 本番=shuttle.proxy.rlwy.net:16099（postgres-ab6d）。残置データ変更なし。

## 5. recon 済みの土台（次セッションの設計が乗る事実）
- qe-0 ファイル名: qe-0-quotation-foundation-spec-confirmation-v1_0-2026-06-12.md（本文内に v1.1/v1.2 追補を内包。「v1.2」は版表記でファイル名ではない）。関連 qe-0d-…-v1_0-2026-06-13.md。
- qe-0 §3 末尾の排他文: 用尺・取り切りは量産(QE-1)専用。「概算」という語は qe-0 に0件＝概算は新概念。
- 過去実額の引き元（概算見積の source 候補）: 過去 PoItem（materialId キーで unitPrice 検索）＋ WoItem（costCategoryId キー）。いずれも unitPrice nullable・currency 列が実在。引き当ては参照でなくスナップショットコピー方針（後で元 PO が変わっても概算は動かさない）。
- 初期費用の識別: PoItem.billingClassification=INDIVIDUAL_BILLING ＋ PoItem.isPhysicalAsset。product-sample §6-2 で個別売り立て＝パターン代/版代/型代/刺繍パンチ代/グレーディング代と確定。
- Quotation 系は箱が実在・ロジック休眠: Quotation / QuotationMoqTier / QuotationCostBreakdown / QuotationApprovalHistory / QuotationMultilingual / QuotationPdfOutput / QuotationConversion の7モデル。QuotationCostBreakdown は原価→マージン→売価・日英(itemNameEn)・多通貨換算(costAmountJpy/exchangeRateUsed)・BOM引用(bomItemId)まで列完備。ただし createQuotation 等の生成ロジックは前 recon で未ヒット＝休眠前提。
- マージン層: MarginSetting（4階層 = COMPANY_DEFAULT/BRAND_LEVEL/PRODUCT_LEVEL/ITEM_LEVEL）＋ MarginSource ＋ QuotationCostBreakdown.margin 列。元設計 quotation_engine の「マージン4階層」は実装済み。
- QuotationCostBreakdown は billingClassification 列を持たない → 初期費用を1枚原価から外す判定は PoItem/WoItem 側で行い、製品単価インクルード分のみを CostBreakdown へ流す設計になる。

## 6. 次セッションで最初にやること（優先順）
1. STEP 0: git log origin/main で実態確認（main 先頭が 89af2b0 か）。
2. design-reread の Step 0「対象確定ゲート」の実体確認（下記7の残課題）。
3. 「概算の量産見積（保存型・QE-1 前段）」の仕様確認書を起草する。
   - source: 過去 PoItem（materialId）＋ WoItem（costCategoryId）のスナップショットコピー。
   - 保存項目: 品番・発行日・単価・MOQ・条件。
   - スコープ外: サンプルの概算（不要）／品番候補提案（B-038）／粗BOM計算／マージン・売価／換算の永続化。
   - 着手前に qe-0 §1 staging と QE-1 v1.0 §0 を読み直す（記憶で書かない）。
   - 保存箱は既存 Quotation 流用 vs 軽量新設、が起草時の論点。

## 7. 注意点・残課題・教訓
- 【未解決】design-reread スキルに Step 0「対象確定ゲート」が入っていない。旧構想メモ v0.1 §7 は「本日スキル更新済み」と書くが、live の shunya-design-reread/SKILL.md はワークフローが 1〜5 のままで Step 0 が無い（2026-07-01 確認）。再発防止策の取りこぼし。次セッションで実体確認し、必要なら追記。
- 【教訓・最重要】見積もりを (あ)(い) の文字ラベルで設計すると裏返る。今日 §7 で「因果取り違え」を記録した直後、同セッションでさらにラベルが裏返った（(あ)=サンプル概算 と置いた後、(あ)=量産概算・(い)=サンプル納品 へ訂正）。対策: 文字ラベルを使わず現実の名前で呼ぶ。
- 【業界標準形】サンプルと量産は別軸／量産だけ概算→確定の段階を持つ／初期費用はサンプル側に別項目、が標準。慎太郎さんの商売と合致を確認済み。
- 【QE-1 側の宿題・引き込まない】qe-1 v1.0 §4 は ROLL/METER 止まりで、qe-0 §QE-1論点の「指定数 vs 取り切り 2本立て・サンプルは指定数」が未反映。これは量産(QE-1)側の論点。概算の量産見積には引き込まない（スコープ逆流防止）。QE-1 改訂時の宿題。

## 8. 本日マージされたコミット一覧
- edcd47a docs: サンプル見積 構想メモ v0.1
- 89af2b0 docs: QE-1 v1.0 冒頭にサンプル見積との相互リンク追記

## 9. 次セッション冒頭の手順
1. このメモで状態復元。
2. git log origin/main --oneline -8 で実態確認（先頭 89af2b0 か・ズレがないか）。
3. design-reread スキル発動（Step 0 対象確定ゲート→該当 spec 読み直し）。本セッションの框組み直し（サンプル/量産の別軸）を旧構想メモ v0.1 の古い框より優先。
4. 上記6の優先順で「概算の量産見積 仕様確認書」起草へ。
