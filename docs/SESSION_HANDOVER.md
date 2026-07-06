# shunya-pms セッション引き継ぎメモ（2026-07-06 / QE-1R 見積書PDF Part A〜D 実装完了・ただし実務と不一致が判明→PDF構造作り直し＝道A確定）

## ⓪ プロジェクト棲み分け（毎回先頭・要目視確認）
対象: shunya-pms（repo: github.com/shintarokoenuma/shunya-pms / local: ~/shunya-production-system / 本番: shunya-pms-web-production.up.railway.app）。saagara-v2 とは別物。Claude Code 着手前に VS Code が ~/shunya-production-system を指しているか目視確認。

## 1. 本セッションの位置づけ（重要な転換があった日）
実装は進んだが、それ以上に「見積書PDFの spec が慎太郎さんの実務と食い違っていた」ことを発見し、正しい見積書の姿と次フェーズ設計（道A）を固めたセッション。手を動かした成果より、設計判断の記録が主。

本日やったこと:
- QE-1R 本体を本番反映（PR #96 マージ・triple-gate A方式）。
- USD 行の明細UIに $ 小計併記を実装・本番反映（PR #96 に同梱）。
- 見積書PDF出力・横断一覧・見積コピー（Part A〜D）を実装・push（未マージ）。
- ★実PDFを慎太郎さんに見せた結果、「明細ベース・合計なし」の見せ方が実務と違うと判明。見積書の正しい構造を再定義し、1枚単価/初期費用の手打ちを入れる「道A」を次フェーズとして確定。

## 2. 本日 main にマージ/反映されたもの
- PR #96（QE-1R 本体・squash `8af85d8`）を本番マージ。Railway 自動デプロイで migration 39本目 `20260701000000_rough_estimate` が本番DBへ適用済み（ログ確認・純増非破壊）。
  - マージ前チェック（本番 host=shuttle:16099 照合・rough_estimates 不在・38本目まで）→ マージ→ デプロイログで適用確認、のA方式で実施。本番接続はDBパスワードを会話に残さない運用（Claude Codeにその場で聞かせる方式）で実施。
- 本番接続文字列は「慎太郎さんが人手で渡す・railway CLI 自己解決しない」運用を継続（教訓どおり）。
- docs: 実装ブリーフ `docs/specs/quotation-pdf-and-list-implementation-brief-2026-07-06.md`（`5c920de`）を main 保存。

## 3. Part A〜D の状態（★未マージ・温存）
- ブランチ `feat/qe1r-quotation-pdf`（origin/main `5c920de` から分岐）・先頭 `f5d8f48`・origin push 済み・未マージ。
  - `0a010d7` A: nav有効化＋横断一覧（listRoughEstimatesForCompany・/quotations・選択/宛先ソート/混在警告）
  - `8c863e1` B: PDF生成層（quotation-data.ts・quotation-document.tsx・render追記・POST /api/quotations/pdf）
  - `0cf5628` C: 選択→出力の配線（download-quotation-pdf.ts・横断一覧/カルテ内テーブルの選択→PDF）
  - `f5d8f48` D: 見積コピー（duplicateRoughEstimate・複製モード）
- feature↔main 差分: 10ファイル・+1,032/−35・migration/schema 差分なし。
- ★マージしない理由: 現状のPDFは「材料/工賃の明細を客に見せる・合計なし」で、慎太郎さんの実務（1枚単価に集約・初期費用は項目別に売り立て・総合計を出す）と食い違う。PDF構造を作り直すまで本番に出さない。
- ★次フェーズ方針: このブランチを温存し、道A（下記）を同一ブランチに積んでから1本のPRにする。Part A/C/D は道Aでも生きる。作り直すのは Part B（quotation-data.ts / quotation-document.tsx）の中身のみ。

## 4. DB状態
- dev = hopper.proxy.rlwy.net:12921: RE 1件（RE-2026-0001「ワイドパンツ100枚見積もり」のみ・検証データ後始末済み・無傷）。
- 本番 = shuttle.proxy.rlwy.net:16099: migration 39本目まで適用済み（QE-1R本体テーブルあり）。Part A〜Dはコードのみ・本番未反映（migrationなし）。

## 5. ★見積書PDFの正しい構造（本日確定・次フェーズで実装）
「材料/工賃の明細は客に見せない。1枚単価に集約。初期費用は項目別に詳細を出して売り立てる。」

2セクション構成:
- 【製品セクション】選択した全見積を1つの表に集約。列＝品名/数量/1枚単価/金額（=1枚単価×数量）。1見積(RE)=1行。製品合計を出す（積み上げ）。
- 【初期費用セクション】項目別（例「版代（ワイドパンツ）」＝どの製品か明示）。金額は項目ごとに原価×(1+利益率)。
- 【総合計】製品合計＋初期費用の全部を足した総合計を出す（★解釈Q確定）。
- 材料/工賃明細・原価・利益率は非表示。金額の丸めは1枚単価×数量（電卓で合う）。
- INCLUDED は初期費用を1枚単価に配賦済み→初期費用セクションに二重で出さない（表示ルールは次フェーズ確定）。

## 6. ★道A（次フェーズ・migration あり）— 貫く原則と設計
原則: 量産分の1枚単価も、初期費用の各項目も、すべて手打ちできる。自動計算がデフォルト値として入り、慎太郎さんが上書きできる。見積書は手打ち後の金額で構成し総合計を出す。

- スキーマ拡張（migration 発生）:
  - RoughEstimate に手打ち1枚単価列を追加（例 finalUnitPriceManualJpy）。
  - 初期費用（RoughEstimateItem の INITIAL_COST 行）に手打ち提示額を持たせる（自動=原価×(1+利益率)がデフォルト・上書き可）。保存場所（item列 追加 か別持ち）は次フェーズで裏取り確定。
  - 総額手打ち finalPriceManualJpy は廃止方向（総額=1枚単価×MOQ で自動導出に一本化）。既存データ移行方針は次フェーズ判断。
- 自動参考1枚単価: SEPARATE=量産分÷MOQ／INCLUDED=量産分÷MOQ＋初期費用÷MOQ（=参考値）。手打ちで上書き、最終は手打ちが正。
- INCLUDED は「初期費用÷MOQを単価に足す自動参考値」に位置づけ降格（自動算出の参考。最終は手打ち）。
- 入力フォーム: 「1枚単価（手打ち）」欄＋各初期費用項目の手打ち欄。全部デフォルト自動・上書き可能。カルテ内社内サマリ（原価/利益率/自動単価）は維持しつつ手打ち欄を足す。

## 7. 次フェーズ着手時に裏取り・確定する論点（今日は未確定）
1. 初期費用の手打ち提示額をどこに保存するか（RoughEstimateItem に列追加 か別テーブルか）。項目単位の手打ち設計。
2. 総額手打ち finalPriceManualJpy 廃止時の本番既存データ（RE-2026-0001）の移行（総額→単価逆算 or null化）。
3. INCLUDED で手打ち単価を入れたときの初期費用セクション表示ルール（二重計上回避の断り書き）。
4. カルテ内サマリUIに手打ち欄を足す位置・既存の総額手打ち欄の撤去/併存。
5. スキーマ変更を伴う→実装は triple-gate（本番は自動 migrate deploy・A方式の前後チェック・本番接続は人手渡し）。
6. spec/ブリーフの改訂: 現行 spec v0.1 §3「明細ベース」・§6-5「合計なし」を「2セクション・製品合計/総合計あり・1枚単価集約・初期費用項目別×利益率・手打ち」に改訂してから実装着手（design-reread Step 0）。

## 8. 次セッションで最初にやること（優先順）
1. このメモで状態復元。git log origin/main -3 と git log origin/feat/qe1r-quotation-pdf -6 で実態確認（feature 先頭 f5d8f48 か）。
2. design-reread 発動 → 現行 spec v0.1（2e24a17）と実装ブリーフ（5c920de）を再読し、§5(道A構造)・§6(道A原則) で spec を改訂（新 spec バージョン）。改訂は docs 単独＝main 直（feature上なら worktree 方式）。
3. §7 の裏取り論点を live schema/実データで確認（特に 1・2）。
4. スキーマ設計（手打ち1枚単価列・初期費用手打ち）を確定→migration 実装（triple-gate）→入力フォーム→PDF作り直し（quotation-data / quotation-document）の順で道Aを feat/qe1r-quotation-pdf に積む。
5. 全部揃ったら PR を1本にまとめて出す（open/マージは慎太郎さん）。

## 9. その他バックログ（QE-1Rの道Aとは別・優先度中）
- 初期費用の過去引き当て（INITIAL_COST 行で過去実額を引けない・引き当てキー設計の再検討が要る。材料=仕入先/工賃=費目 と別軸で、版屋/パンチ屋等の外注先ベースか費目マスターか未決。source が PoItem か WoItem か両方かも未決。現状 UI で初期費用行に「過去発注」ボタンが出ていないのが仕様か実装漏れかを live 確認してから設計）。
- WorkOrder DRAFT 時の編集許可。
- PO を品番カルテから作成時、保存後に一覧へ飛ばさずカルテ内に留まる。
- PO明細行の複製（色/サイズ違い）。
- 全体的な入力UX見直し。

## 10. 本日の教訓
- spec は実装の正だが、spec 自体が実務とズレていることがある。実物（実PDF）を早めに慎太郎さんに見せることで、机上のspecでは見えないズレが出る。今回「明細を客に見せる」設計が実務と真逆だった。次からは PDF等の客向け成果物は早い段階でサンプルを見せて実務照合する。
- 本番DB接続はパスワードを会話ログに残さない（Claude Codeにその場で聞かせる方式が最も安全。export 変数はClaude Codeの別プロセスに引き継がれず不発）。
- 本番スキーマ変更のマージ=自動 migrate deploy（start の prisma migrate deploy）。手動 triple-gate は挟めないので、純増非破壊 migration は A方式（マージ前後の read-only 確認）で担保。
- 検証データは一意タイトル作成→title一致＋保護ガードで削除（RE-2026-0001 を絶対除外）を徹底し、今回は誤削除なし。

## 11. Part A〜D の実装詳細（道Aで Part B を作り直す際の参考。A/C/D は流用）
- A: listRoughEstimatesForCompany（productId→Product→Client 2段一括引き・原価/利益率非搭載）／/quotations page＋quotations-list.tsx（選択Set・宛先clientNameソート・混在disable）。
- B（★作り直し対象）: quotation-data.ts（getQuotationPdfData・MIXED_CLIENT/NOT_FOUND/EMPTY・現状は材料/工賃/初期費用を明細で返す）／quotation-document.tsx（現状は品番ブロック縦積み・明細テーブル）。→ 道Aで「製品行集約＋初期費用項目別＋総合計・手打ち単価」に再構成。
- C（流用）: download-quotation-pdf.ts（POST→blob→DL）／横断一覧・カルテ内の選択→出力配線。
- D（流用）: duplicateRoughEstimate（getRoughEstimateForEdit 相乗り・title「のコピー」・引き当て焼き込み保持）／FormDialog 複製モード。
- calc.ts（無変更で流用可）: computePriceBreakdownFromTotals が productionPricePerUnitJpy（SEPARATE単価）/ includedPerUnitPriceJpy（INCLUDED単価）を返す。道Aの自動参考単価はこれ。初期費用の項目別×利益率は新規の薄い純関数を calc に足すのが筋。
