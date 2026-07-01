# shunya-pms セッション引き継ぎメモ（2026-07-01 / QE-1R 実装ブリーフ v1.0 完成まで）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
- 対象: shunya-pms（repo: github.com/shintarokoenuma/shunya-pms / local: ~/shunya-production-system / 本番: shunya-pms-web-production.up.railway.app）
- saagara-v2 とは別物。Claude Code 着手前に VS Code が ~/shunya-production-system を指しているか目視確認。

## 1. 本セッションの成果（設計フェーズ完了）
見積もりの框の組み直し（サンプル軸/量産軸の分離）から、QE-1R（概算量産見積）の仕様確認書・実装ブリーフまで、設計フェーズが一本で完結した。

- (あ)(い) の文字ラベルは廃止。サンプルと量産は別軸。量産軸の中を「概算レーン(QE-1R)」と「確定計算レーン(QE-1)」に分ける、で確定。
- サンプル軸（サンプル請求）= サンプルを作って納める代金。初期費用が別項目。概算段階は持たない。
- 量産軸 = 概算レーン(QE-1R・保存型・提示価格) / 確定計算レーン(QE-1 v1.0・原価計算のみ)。
- QE-1R の設計は v0.1（框）→ v1.0（実装ブリーフ・列定義まで）で完結。次は実装フェーズ（P1〜）。

## 2. 完了状態・本セッションのコミット
- 本セッションのコミット（すべて docs 単独・main 直 push）:
  - 89af2b0: QE-1 v1.0 §0 にサンプル見積との相互リンク追記
  - afd92b9: 引き継ぎメモ更新（框をサンプル/量産の別軸へ組み直し）
  - ed73e18: 概算量産見積(QE-1R) 仕様確認書 v0.1
  - 27d804f: 引き継ぎメモ更新（QE-1R v0.1 確定・次は実装ブリーフ）
  - f957788: 概算量産見積(QE-1R) 実装ブリーフ v1.0 ← 本セッションの最終成果
- main 先頭: f957788

## 3. QE-1R の設計内容（実装フェーズの前提・詳細は docs/specs/ 2ファイル参照）
- 仕様確認書: docs/specs/quotation-rough-estimate-spec-confirmation-v0_1-2026-07-01.md（框）
- 実装ブリーフ: docs/specs/quotation-rough-estimate-implementation-brief-2026-07-01.md（列定義・P1/P2/P3）
- 要点:
  - 位置づけ: 量産軸の独立レーン。確定計算 QE-1 とは時間軸でのみ接続・別系統。客に見せるのは提示価格（利益込み）。
  - 保存箱: 新設2モデル RoughEstimate（ヘッダ）＋ RoughEstimateItem（明細）。既存 Quotation には相乗りしない（必須列が重すぎる・型値に量産概算なし）。→ migration＝初の本番スキーマ変更。triple-gate 対象。
  - 価格: 提示価格＝原価×(1＋利益率)。利益率＝1件1率・デフォルトは Brand.defaultMarginRate（null時は0%開始）・変更可・材料費/工賃/初期費用の全費目に適用。
  - 絶対防衛線: 初期費用は価格化するが1枚原価には混ぜない（別枠計上維持）。将来フェーズで「初期費用を1枚単価にインクルーズする切替」をバックログ化済み（客要望対応・§6）。
  - 赤字警告: marginRate=0 は理由を問わず一律で赤字警告（未設定と明示入力を区別しない・見落とし防止優先で確定）。
  - 手打ちレイヤー: 最終見積/納品額は人が手打ちで整える。自動計算値をデフォルト表示。自動値と手打ち最終値を別列で両方保存。
  - source: 過去 PoItem（materialId）＋ WoItem（costCategoryId）のスナップショットコピー（参照リンクにしない）。
  - 費目区分: 単層3区分 enum（MATERIAL/LABOR/INITIAL_COST）。確定見積のような2階層(external/internal)は持たない。
  - 採番: RE-{year}-NNNN（既存5関数と同作法・P2002 retry）。
  - UI設置場所: 未確定・実装 P3 着手時に products/[id] 配下を1回 recon してから確定（唯一の遅延事項）。

## 4. DB 状態
- 本セッションで DB 書き込みは一切無し（docs のみ・migration 無し）。
- dev=hopper.proxy.rlwy.net:12921（postgres-7492）/ 本番=shuttle.proxy.rlwy.net:16099（postgres-ab6d）。残置データ変更なし。
- 次フェーズで初の migration が発生する（RoughEstimate/RoughEstimateItem 純増テーブル＋enum3種）。triple-gate（dev db push確認→本番 dry-run ROLLBACK＋件数→本番 migrate deploy commit）必須。

## 5. 次セッションで最初にやること（優先順）
1. STEP 0: git log origin/main で実態確認（main 先頭が f957788 か）。
2. design-reread Step 0 発動 → docs/specs/quotation-rough-estimate-implementation-brief-2026-07-01.md（§8 記載の再確認リスト: 本ブリーフ＋v0.1＋QE-1 v1.0 §5/§7＋product-sample §6-2＋実スキーマ live grep）を読み直してから着手。
3. QE-1R 実装 P1 から開始（ブリーフ §7）:
   - schema.prisma に RoughEstimate/RoughEstimateItem 2モデル＋enum3種（RoughEstimateCategory/RoughEstimateItemSource/MarginRateSource）を追加。
   - enum ごとに co-located Record<enum,string> ラベル定義を同 PR に含める（house rule）。
   - prisma db push（dev: hopper:12921）→ prisma generate → tsc/lint/build クリーン。
   - P1完了でいったん停止。慎太郎さんが dev 反映を確認するまで P2 に進まない。
4. P1 の作業はコードを含むので feature ブランチ＋PR（docs 単独ではない・main 直 push 不可）。

## 6. 注意点・残課題・教訓
- 【解消済み】design-reread スキルの Step 0「対象確定ゲート」: claude.ai へアップロード上書き済み。次回発動時に先頭で Step 0 が出るか再確認。
- 【教訓】見積もりを (あ)(い) の文字ラベルで組むと裏返る。現実の名前（サンプル請求／量産見積の概算・確定）で呼ぶことで解消。今後も新規の層を扱う時はこの教訓を優先。
- 【プロセス】spec/ブリーフを Claude Code に保存させる際、heredoc にコードフェンスを含む本文を渡すと誤検知の恐れがあるため、フェンスは字下げブロックに置換して渡す（本セッションで実施・以後も踏襲）。
- 【プロセス】heredoc にプレースホルダを残さない。Claude Code は「file not read」等で検知して停止するのが正しい挙動（本セッションで2回発生・都度検知され事故なし）。
- 【業界標準形】サンプルと量産は別軸／量産だけ概算→確定の段階を持つ／初期費用はサンプル側別項目かつ量産側でも別枠、が標準。慎太郎さんの商売と合致確認済み。

## 7. 本日マージされたコミット一覧
- 89af2b0 docs: QE-1 v1.0 冒頭にサンプル見積との相互リンク追記
- afd92b9 docs: セッション引き継ぎメモ更新（框をサンプル/量産の別軸へ組み直し）
- ed73e18 docs: 概算量産見積(QE-1R) 仕様確認書 v0.1
- 27d804f docs: セッション引き継ぎメモ更新（QE-1R v0.1 確定・次は実装ブリーフ）
- f957788 docs: 概算量産見積(QE-1R) 実装ブリーフ v1.0

## 8. open PR
- #94（B-065・保留）のみ。本セッションでの新規 PR なし（すべて docs 単独・main 直 push）。

## 9. 次セッション冒頭の手順
1. このメモで状態復元。
2. git log origin/main --oneline -8 で実態確認（先頭 f957788 か）。
3. design-reread スキル発動（Step 0 対象確定ゲート→上記5-2の再確認リストを読み直し）。
4. QE-1R 実装 P1 着手（feature ブランチ作成 → schema.prisma 編集 → dev push → 停止）。
