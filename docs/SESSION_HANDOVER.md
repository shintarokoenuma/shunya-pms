# shunya-pms セッション引き継ぎメモ（2026-07-01 / QE-1R v0.1 確定まで）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
- 対象: shunya-pms（repo: github.com/shintarokoenuma/shunya-pms / local: ~/shunya-production-system / 本番: shunya-pms-web-production.up.railway.app）
- saagara-v2 とは別物。Claude Code 着手前に VS Code が ~/shunya-production-system を指しているか目視確認。

## 1. 本セッションの最重要事項（見積もりの框の組み直し＝確定済み）
(あ)(い) の文字ラベルは廃止。サンプルと量産は別軸。量産軸の中を「概算レーン」と「確定計算レーン」に分ける、で確定:

- サンプル軸（サンプル請求）= サンプルを作って納める代金。初期費用が別項目。概算段階は持たない。サンプルの概算見積は不要。
- 量産軸 =
  - 概算レーン（QE-1R・本セッションで v0.1 確定）: 仕様確定前に提示価格・MOQ・条件を出して交渉。保存型（発行履歴）。
  - 確定計算レーン（QE-1 v1.0）: 仕様確定後の原価計算（取り切り・数量別単価）。
- 今後は「サンプル請求」「量産見積（概算=QE-1R / 確定=QE-1）」の現実の名前で呼ぶ。

## 2. 完了状態・本セッションのコミット
- 本セッションのコミット（すべて docs 単独・main 直 push）:
  - 89af2b0: QE-1 v1.0 §0 にサンプル見積との相互リンク追記
  - afd92b9: 引き継ぎメモ更新（框をサンプル/量産の別軸へ組み直し）
  - ed73e18: 概算量産見積(QE-1R) 仕様確認書 v0.1 ← 本セッションの主成果
- main 先頭: ed73e18

## 3. QE-1R v0.1 で確定した框（実装ブリーフの前提）
- 位置づけ: 量産軸の独立レーン。確定計算 QE-1 とは時間軸でのみ接続・別系統。客に見せるのは提示価格（利益込み）。
- 保存箱: 概算専用の軽量モデルを新設（仮称 RoughEstimate ＋ RoughEstimateItem）。既存 Quotation には相乗りしない（Quotation は確定見積書=QE-2 前提の重い箱・必須列 quotationNumber/versionNumber/clientId/validUntil・型値に量産概算なし）。→ migration＝本番スキーマ変更を伴う。triple-gate 対象。
- 価格の作り方: 提示価格＝原価×(1＋利益率)。利益率＝1件1率・デフォルト値入り変更可・出どころ Brand.defaultMarginRate（schema:517・Decimal(5,2)・実在確認済み）。利益率は材料費・工賃・初期費用の全費目に掛ける（初期費用も価格化）。
- 絶対防衛線: 初期費用は価格化はするが1枚原価には混ぜない（別枠計上維持）。「利益を乗せる（価格）」と「1枚原価に混ぜない（原価集計）」は別レイヤーで両立。
- 手打ちレイヤー: 最終見積/納品額は手打ちで整える。自動計算値をデフォルト表示。自動値と手打ち最終値を別列で両方保存（自動値＝根拠の再現性／手打ち最終値＝実際に客へ出した数字）。
- source: 過去 PoItem（materialId）＋ WoItem（costCategoryId）のスナップショットコピー（参照リンクにしない）。
- 論点2〜5 確定: 「条件」＝通貨前提/想定数量帯/前提メモ・有効期限は任意参考列／手入力と過去引き当ては混在OK・行ごと source enum（MANUAL/PAST_PO/PAST_WO）／MOQ は単純1値（階段は QE-3+）／v0.1 は保存＋表示まで・確定見積への引き継ぎ動線は後回し。
- スコープ外: サンプル概算（不要）／候補提案 B-038／粗BOM／マージン4階層・費目別率・厳密売価 QE-3+／初期費用の1枚単価インクルーズ切替（将来フェーズ・§6 バックログ）／QE-1 の取り切り計算・ROLL/METER vs 指定数2本立て（量産側の宿題・引き込まない）。

## 4. DB 状態
- 本セッションで DB 書き込みは一切無し（docs のみ・migration 無し）。
- dev=hopper.proxy.rlwy.net:12921（postgres-7492）/ 本番=shuttle.proxy.rlwy.net:16099（postgres-ab6d）。残置データ変更なし。
- ※ QE-1R 実装ブリーフ→実装段では初の migration が発生する。triple-gate（dev 確認→本番 dry-run ROLLBACK＋件数→本番 commit）必須。

## 5. 次セッションで最初にやること（優先順）
1. STEP 0: git log origin/main で実態確認（main 先頭が ed73e18 か）。
2. QE-1R 実装ブリーフの起草。ただし着手前に read-only recon を1往復する（記憶で列を埋めない）:
   - QuotationCostBreakdown の全列（明細の器の作りを流用/参照するため）。
   - BomItem の costSource/usageSource enum の定義値（行 source enum の house style 踏襲のため）。
   - 採番関数の現状（generatePoNumber 等・B-048 リトライ論点）。QE-1R の採番規則を決めるため。
   - Brand.defaultMarginRate の型・nullable 再確認（デフォルト利益率の供給）。
3. recon 後、実装ブリーフに落とす: 新設モデルの列定義（自動値列/手打ち最終値列の分離・source enum・利益率列・初期費用別枠・MOQ 単一値・条件フィールド群）・採番・UI 設置場所・引き当てクエリ・migration/triple-gate 手順・P1/P2/P3 停止点。

## 6. 注意点・残課題・教訓
- 【解消済み】design-reread スキルの Step 0「対象確定ゲート」: 本セッションで zip 編集＋claude.ai へアップロード上書き済み。次回発動時に先頭で Step 0 が出れば反映確認完了。skill/shunya-design-reread.zip.bak（旧版）は反映確認後に削除可。
- 【教訓・本セッションで実証】見積もりを (あ)(い) の文字ラベルで組むと裏返る。本セッションでも設計中にラベルが複数回反転し、最終的に「サンプル軸/量産軸は別物」で決着。現実の名前で呼ぶことで解消。design-reread Step 0 はこの再発防止。
- 【プロセス】spec 保存時、Claude.ai→Claude Code の heredoc にはプレースホルダを絶対に残さない（本セッションで1度プレースホルダのまま渡し往復が発生。Claude Code が検知し停止＝正しい挙動）。本文全文を埋めて渡す。
- 【業界標準形】サンプルと量産は別軸／量産だけ概算→確定の段階を持つ／初期費用はサンプル側別項目かつ量産側でも別枠、が標準。慎太郎さんの商売と合致確認済み。

## 7. 本日マージされたコミット一覧
- 89af2b0 docs: QE-1 v1.0 冒頭にサンプル見積との相互リンク追記
- afd92b9 docs: セッション引き継ぎメモ更新（框をサンプル/量産の別軸へ組み直し）
- ed73e18 docs: 概算量産見積(QE-1R) 仕様確認書 v0.1

## 8. open PR
- #94（B-065・保留）のみ。本セッションでの新規 PR なし。

## 9. 次セッション冒頭の手順
1. このメモで状態復元。
2. git log origin/main --oneline -8 で実態確認（先頭 ed73e18 か）。
3. design-reread スキル発動（Step 0 対象確定ゲート→該当 spec 読み直し）。QE-1R v0.1（ed73e18）を親仕様として読む。
4. §5 のとおり QE-1R 実装ブリーフの recon から着手。
