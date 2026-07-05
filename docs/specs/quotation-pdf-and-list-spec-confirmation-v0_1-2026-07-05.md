# QE-1R 見積書PDF出力・横断見積一覧 仕様確認書 v0.1 (2026-07-05)

## 対象プロジェクト
- リポジトリ: shintarokoenuma/shunya-pms
- ローカルパス: ~/shunya-production-system
- 本番URL: shunya-pms-web-production.up.railway.app
- saagara-v2とは完全に別プロジェクト

## 0. 対象の確定（design-reread Step 0）
- 設計対象＝QE-1R の見積書PDF出力、およびその入口となる会社横断の見積一覧。加えて見積のコピー（複製）機能。
- 束ね方式は(あ) 束ねて出力（既存「1品番＝1 RoughEstimate」構造は不変・スキーマ変更なし）。単発は「1件だけ選ぶ」特殊ケースとして同一経路。
- 器の位置づけ＝(甲) 見積もり全体の入口。/quotations は将来 QE-1（確定計算）/QE-2（確定見積書）をタブ等で同居可能な設計余地を残す。今回の中身は概算(QE-1R)のみ。

## 1. 入口：サイドバー「見積もり」の有効化と横断一覧
- nav-items.ts の { label: "見積もり", href: "/quotations", enabled: false } を enabled: true に（1行）。
- 新設ルート src/app/(app)/quotations/page.tsx＝会社横断の見積一覧。
- 新設 action listRoughEstimatesForCompany(...)（productId 非依存・where: { companyId, deletedAt: null }・issuedAt desc）。各行に品番名・宛先を出すため productId → Product(productName/productCode/clientId) → Client(companyName) を join（N+1 回避のため id 集合で一括引き）。
- 一覧の各行に出す最小列: チェックボックス／品番（productName＋productCode）／タイトル／宛先（Client.companyName）／提示MOQ／発行日／RE番号。品番＋タイトルで判別可能にする。

## 2. 選択とPDF出力（起点は2つ・生成経路は共有）
- 起点A：横断一覧（/quotations）— 複数品番を跨いで選択。1クライアント限定。
- 起点B：品番カルテ内（products/[id] の概算見積セクション）— その品番の見積（2〜3パターン）をチェックして出力。同一品番なのでクライアント混在は起きない。
- 両起点とも同一の POST /api/quotations/pdf（body: { ids: string[] }）を呼ぶ。生成層・レイアウトは完全共有。既存PO/WOは GET /[id]/pdf だが、複数選択のため本件は ids を渡す POST とする。
- 横断一覧では、選択に別クライアントの見積が混じったら出力を弾く（宛先が1つに定まらないため）。UIで「宛先が異なる見積が含まれています」と警告。カルテ内起点は同一品番のため自動的に単一クライアント。

## 3. PDF構造（★合計は一切置かない）
- ヘッダ（PDF全体で1つ）: 発行元＝既存 COMPANY_PROFILE 流用／宛先＝Client.companyName + " 御中"（Client に敬称列なし・固定付与）／発行日。
- 品番ブロック（選択見積ごとに縦に並べる。ブロック間に区切り）:
  - ブロック見出し: 品番（productName＋productCode）／タイトル／RE番号併記／提示MOQ。
  - 明細: 費目順 材料費 → 工賃 → 初期費用（別枠セクション）。列＝品目名・数量・単位・単価・小計（JPY）。
  - 初期費用は別枠明示（1枚原価に混ぜない・§6 絶対防衛線をPDF上でも維持）。ブロック内で別枠セクションとして分離表示。
  - 1枚あたり提示単価をブロックに明記（タイトルに対する1枚単価）。SEPARATE=量産提示分÷MOQ（初期費用を含めない）／INCLUDED=提示価格合計÷MOQ。calc.ts の computePriceBreakdownFromTotals を流用。MOQ未入力なら1枚単価は非表示。
  - 備考欄: 前提メモ（RoughEstimate.notes＝素材グレード仮定・色数・納期前提等）をブロック内備考へ。
- 合計行は一切なし: 全体総額・末尾初期費用一括合計・ブロック横断の小計、いずれも置かない。見積を2〜3通り並べる運用で代替案どうしを足すと無意味な数字になるため。各ブロックが独立した提示として完結。

## 4. 金額の正・非表示ライン（客向け・絶対線）
- 出す金額は手打ち最終値 finalPriceManualJpy を正とする（§5-3・実際に客へ出した数字）。finalPriceManualJpy が null の見積は自動提示価格 autoPriceTotalJpy にフォールバック。
- 原価（autoCostTotalJpy）・利益率（marginRate）は全ブロックで非表示（客向けのため伏せる・崩さない）。
- 通貨は JPY 前提。USD提示は海外用インボイスベースで別途（今回スコープ外・後日）。行別通貨が混在する見積は、JPY換算済み subtotalJpy で表示。

## 5. 実装構成（既存PDFスタック4層を踏襲）
- src/lib/pdf/quotation-data.ts（新）: getQuotationPdfData(ids, companyId)。各 RoughEstimate を getRoughEstimate 相当で引き、productId→Product/Client で品番名・宛先を解決、1枚単価等の派生値は calc.ts で導出（保存列は増やさない）。選択が全て同一 clientId か検証し、違えばエラーを返す（横断起点用）。
- src/lib/pdf/quotation-document.tsx（新）: レイアウト。フォントは registerPdfFonts()／PDF_FONT_FAMILY 流用。品番ブロックを map で縦積み。
- render.tsx: renderQuotationPdfBuffer(data) を追加。
- src/app/api/quotations/pdf/route.ts（新）: POST・auth → getQuotationPdfData → render → PDF Response。GCS控えは任意（PO route の uploadOrderPdf に倣うが本件は複数見積のためファイル名規則を別途・v0.1では控え保存を必須にしない）。
- UI改修は2箇所: (a) 横断一覧ページ（新設）にチェックボックス＋出力ボタン。(b) 既存 rough-estimate-section.tsx（カルテ内の見積一覧テーブル）にもチェックボックス＋「選択をPDF出力」ボタンを追加。テーブル自体は既存なので選択state と出力ボタンの追加のみ。

## 6. 見積のコピー（複製）機能
### 6-1. 目的
内容変更が少なく「数量のみ変更」「素材だけ差し替え」の派生見積を作る場面が多いため、既存見積を雛形として複製し差分のみ編集する動線を用意する。2〜3パターン提示（§3 で PDF に並べる代替案）の作成コストを下げる。
### 6-2. 動線
- 見積一覧（カルテ内・横断一覧の両方）の各行に「複製」アクションを追加。
- 押すと元見積の内容をプレフィルした新規作成ダイアログが開く（＝既存の作成フォームを複製データで初期化）。保存で新規 RoughEstimate として確定。元見積は不変。
### 6-3. 採番（確定）
- 複製で作る見積は新しい RE 番号を採番する（RE-{year}-NNNN・既存の P2002 リトライ作法）。元番号は引き継がない。複製は独立した発行履歴のため。
### 6-4. コピーする値／しない値（確定）
- コピーする: タイトル（「〜のコピー」等を付与し編集を促す）／提示MOQ／利益率（marginRate・marginRateSource）／初期費用請求方式（initialCostBillingMode）／前提メモ（notes）／全明細（費目区分・品目名・数量・単位・単価・通貨・materialId/costCategoryId）。
- コピーしない（リセット）: estimateNumber（新規採番）／issuedAt（複製日）／finalPriceManualJpy（手打ち最終値は各発行に固有・複製先で自動値から入れ直す。§5-3 の思想）。
- 引き当て焼き込み値の扱い: 明細の sourcePoItemId/sourceWoItemId（引き当て元の記録）はコピーする。単価等は既にスナップショットとして焼き込み済みで、複製先でもその値を保持するのが自然（元PO/WOが変わっても複製見積は動かない、という§4の思想と一致）。複製後に数量だけ変えるケースでは単価はそのまま流用され小計が再計算される。
### 6-5. 実装
- 新設 action duplicateRoughEstimate(id)（read）: 元見積をプレフィル用の形（RoughEstimateEditData 相当）で返すだけ。実際の作成は既存の作成 action を通す（複製専用の書き込み経路を作らず、既存作成ロジックに相乗り。採番・バリデーション・calc を二重実装しない）。
- UI: 既存 rough-estimate-section.tsx の作成ダイアログを「複製データで開く」モードに対応（editingId とは別に duplicateFromId を持つ）。横断一覧にも同じ動線。

## 7. スコープ外（非引き込み）
- 確定見積（QE-1/QE-2）の同居実装（器だけ用意・中身は概算のみ）。
- USD/海外インボイスPDF（後日・別レーン）。
- 見積の版管理・PDF発行履歴のDB保存（今回は都度生成DL・GCS控えは任意）。
- 合計・小計ロジック全般（意図的に持たない）。

## 8. 次ステップ
- 本書確定 → 実装ブリーフで、横断list action のページング/検索、quotation-document のレイアウト詳細（ブロック区切り・改ページ制御）、clientId 混在チェックのUI/サーバ両側、PDF route の配線、コピー機能のプレフィル動線を詰める。
- 実装は既存4層流用のため migration なし。UI（一覧新設＋nav 1行＋カルテ内選択追加）とPDF層（新規3ファイル＋render追記＋route新設）＋コピー（read action 1本＋既存作成フォームの複製モード）。

## 改訂履歴
| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-07-05 | v0.1 | QE-1R 見積書PDF出力の框確定。束ねて出力方式（スキーマ変更なし）。入口＝サイドバー「見積もり」/quotations を(甲)見積もり全体の入口として有効化＋会社横断見積一覧を新設。出力起点は横断一覧とカルテ内の2つ・生成経路(POST /api/quotations/pdf)は共有。PDFは品番ブロックを縦積み・合計は一切なし・1枚単価をブロック明記・初期費用別枠・原価/利益率非表示・手打ち最終値が正・JPY前提・宛先はProduct.clientId→Client「御中」固定。既存PDFスタック4層流用でmigrationなし。見積コピー機能を追加（新規採番・手打ち最終値と番号/発行日はリセット・引き当て焼き込みは保持・既存作成ロジックに相乗り）。USD/確定見積/版管理はスコープ外 |
