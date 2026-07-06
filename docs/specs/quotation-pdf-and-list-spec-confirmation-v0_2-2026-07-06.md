# QE-1R 見積書PDF出力・横断見積一覧 仕様確認書 v0.2 (2026-07-06)

## 対象プロジェクト
- リポジトリ: shintarokoenuma/shunya-pms
- ローカルパス: ~/shunya-production-system
- 本番URL: shunya-pms-web-production.up.railway.app
- saagara-v2とは完全に別プロジェクト

## 改訂の経緯（v0.1 → v0.2・道A転換）
v0.1 の「材料/工賃の明細を客に見せる・合計なし」構造で実装した実PDFを慎太郎さんが確認した結果、
実務（明細は客に見せない・1枚単価に集約・初期費用は項目別に売り立て・総合計を出す）と
食い違うことが判明（2026-07-06）。本 v0.2 は PDF 構造・金額の正・スキーマ方針を全面改訂する。
§0〜§2（入口・一覧・選択と出力経路）・§6（コピー）の骨格は v0.1 を踏襲。

## 0. 対象の確定（design-reread Step 0）
- 設計対象＝QE-1R の見積書PDF出力（道A構造）、会社横断の見積一覧、見積コピー。
- 束ね方式は(あ) 束ねて出力。「1品番＝1 RoughEstimate」構造は不変。
- 器の位置づけ＝(甲) 見積もり全体の入口（/quotations・将来 QE-1/QE-2 同居余地）。
- ★v0.2 はスキーマ変更あり（§5・純増2列・migration 1本）。v0.1 の「migration なし」を撤回。

## 1. 入口：サイドバー「見積もり」の有効化と横断一覧
（v0.1 から変更なし・実装済み Part A を正とする）
- nav-items.ts の「見積もり」を enabled: true に。
- /quotations ＝会社横断見積一覧。listRoughEstimatesForCompany（companyId・deletedAt: null・
  issuedAt desc・Product/Client を id 集合一括引き）。
- 最小列: チェックボックス／品番／タイトル／宛先／提示MOQ／発行日／RE番号。
- 宛先（clientName）の client-side ソートトグル。ページング/検索は初版なし。

## 2. 選択とPDF出力（起点2つ・経路共有）
（v0.1 から骨格変更なし・実装済み Part A/C を正とする）
- 起点A＝横断一覧（複数品番・1クライアント限定・混在は警告＋出力 disable）。
  起点B＝品番カルテ内。
- 両起点とも POST /api/quotations/pdf（body: { ids: string[] }）。サーバ側でも
  MIXED_CLIENT を弾く（二重の砦）。
- ★v0.2 追加: presentedMoq 未入力の見積は PDF 出力対象にできない。
  道Aでは製品行の金額＝1枚単価×数量（=MOQ）であり、MOQ なしでは行が成立しないため。
  UI は選択時に「提示MOQ 未入力の見積が含まれています」と警告し出力ボタンを disable。
  サーバ側も { error: "MOQ_REQUIRED" } で弾く（対象 RE 番号を返す）。

## 3. PDF構造（★v0.2 全面改訂・2セクション＋総合計）
「材料/工賃の明細は客に見せない。1枚単価に集約。初期費用は項目別に詳細を出して売り立てる。」

- ヘッダ（PDF全体で1つ）: 発行元＝COMPANY_PROFILE／宛先＝Client.companyName + " 御中"／発行日。

- 【製品セクション】選択した全見積を1つの表に集約。1見積(RoughEstimate)＝1行。
  - 列＝品名（productName＋productCode。タイトルがあれば併記し複数案を判別可能に）／
    数量（presentedMoq）／1枚単価／金額（＝1枚単価×数量）。
  - 1枚単価の正: finalUnitPriceManualJpy（手打ち）?? 自動参考単価。
    自動参考単価＝SEPARATE: productionPricePerUnitJpy（初期費用抜き）／
    INCLUDED: includedPerUnitPriceJpy（初期費用込み・単価に「（初期費用込）」付記）。
  - 金額は「表示された1枚単価 × 数量」で必ず一致させる（電卓で合う）。
    単価の丸め規則（円未満の扱い）の細部は実装ブリーフ段で確定。
  - 表の末尾に【製品合計】行（各行金額の積み上げ）。

- 【初期費用セクション】項目別に表示（別途請求・売り立て）。
  - 行＝SEPARATE の見積の INITIAL_COST 明細行。項目名にどの製品かを明示
    （例「版代（ワイドパンツ）」＝itemName＋productName 付記）。
  - 金額の正: presentedPriceManualJpy（行別手打ち）?? 自動提示額
    （subtotalJpy ×(1＋marginRate)。marginRate はヘッダの1件1率）。
  - ★INCLUDED の見積の初期費用はこのセクションに出さない（1枚単価に配賦済み・
    二重計上回避）。製品行の「（初期費用込）」付記が断り書きを兼ねる。
    必要に応じ脚注1行（「※（初期費用込）表記の製品は初期費用を単価に含みます」）。
  - 表の末尾に【初期費用合計】行。
- 【総合計】製品合計＋初期費用合計。PDF 末尾に明記。

- 非表示: 材料費・工賃の明細行／原価（autoCostTotalJpy・subtotalJpy 等の原価内訳）／
  利益率（marginRate）。いずれも PDF に一切出さない。
- 備考欄: RoughEstimate.notes（前提メモ）を見積単位で出す（配置は実装ブリーフ段）。

## 4. 金額の正・非表示ライン（客向け・絶対線）
- ★v0.2 転換: 金額の正は「1枚単価」に一本化する。
  - 製品行: finalUnitPriceManualJpy（手打ち1枚単価）が正。null なら自動参考単価。
  - 初期費用行: presentedPriceManualJpy（手打ち提示額）が正。null なら 原価×(1＋利益率)。
  - 総額（金額・製品合計・総合計）はすべて上記からの導出値。総額の直接手打ちは廃止
    （finalPriceManualJpy は非推奨化・§5）。
- 原価・利益率は全セクションで非表示（PDF データ型にも載せない・型レベルで漏れ防止）。
- 通貨は JPY 前提。USD提示は海外用インボイスベースで別途（スコープ外）。
  行別通貨混在の原価は subtotalJpy 換算済み値が自動計算の母数（v0.1 踏襲・ただし明細自体は非表示）。

## 5. スキーマ・実装構成（★v0.2 改訂・純増2列＋既存4層流用）
- スキーマ変更（migration 1本・純増・非破壊）:
  - RoughEstimate に finalUnitPriceManualJpy Decimal(15,2)? を追加（手打ち1枚単価）。
  - RoughEstimateItem に presentedPriceManualJpy Decimal(15,2)? を追加
    （初期費用行の手打ち提示額。MATERIAL/LABOR 行では常に null＝UI が INITIAL_COST 行のみ露出）。
  - finalPriceManualJpy（総額手打ち）は非推奨化。列は残す（DROP しない＝A方式で安全に
    マージ可能な非破壊 migration を維持）。UI から総額手打ち欄を撤去し、読み書きしない。
    DROP は後日のクリーンアップ migration に送る。
  - 既存データ移行: バックフィルしない。dev の RE-2026-0001 は finalManual＝autoPrice
    （実質手打ちなし）のため、新列 null → 自動参考単価表示で情報欠落なし。
    本番の RE 有無は 2026-07-06 時点で未確認 → マージ前 A方式チェックで件数確認し、
    存在しても純増・バックフィルなしのため影響なし。
- 自動参考単価は保存しない（calc.ts computePriceBreakdownFromTotals から都度導出・v0.1 踏襲）。
  初期費用の項目別自動提示額（行 subtotalJpy×(1＋率)）は calc.ts に薄い純関数を新設して導出。
- 入力フォーム: 「1枚単価（手打ち）」欄＋INITIAL_COST 各行の手打ち欄を追加。いずれも
  自動参考値がデフォルト表示され上書き可能。総額手打ち欄は撤去（総額は導出表示に置換）。
  カルテ内の社内サマリ（原価・利益率・自動単価）は維持。配置詳細は実装ブリーフ段。
- PDF 層: quotation-data.ts / quotation-document.tsx を道A構造で作り直し（Part B 相当）。
  render.tsx 追記・POST route・DL ハンドラ・一覧・コピー（Part A/C/D）は実装済みを流用。
- 実装は triple-gate 対象（本番は自動 migrate deploy ＝ A方式：マージ前後の read-only 確認）。

## 6. 見積のコピー（複製）機能
（v0.1 §6 を踏襲・実装済み Part D を正とする。v0.2 での追記は以下のみ）
- ★コピーしない値に新列を追加: finalUnitPriceManualJpy・presentedPriceManualJpy は
  複製先でリセット（手打ち値は各発行に固有＝v0.1 §6-4／本体 spec §5-3 の思想を新列に適用）。
  複製先では自動参考値がデフォルト表示される。
- finalPriceManualJpy は非推奨化に伴いコピー対象から外れる（そもそも読み書きしない）。

## 7. スコープ外（非引き込み）
- 確定見積（QE-1/QE-2）の同居実装／USD・海外インボイスPDF／版管理・PDF発行履歴のDB保存
  （v0.1 踏襲）。
- 初期費用の過去引き当て（別バックログ・引き当てキー再設計）。
- finalPriceManualJpy 列の物理 DROP（後日クリーンアップ）。

## 8. 次ステップ
- 本書確定 → 本体 spec v0.1 への addendum（総額手打ち→単価手打ち転換の記録）→
  実装ブリーフ改訂（migration 手順・フォーム改修・quotation-data/document 作り直し・
  MOQ_REQUIRED ガード・検証項目）→ feat/qe1r-quotation-pdf に道Aを積む → PR 1本。

## 改訂履歴
| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-07-05 | v0.1 | 框確定（明細ベース・合計なし・migration なし） |
| 2026-07-06 | v0.2 | 道A転換。PDF＝製品セクション（1見積1行・品名/数量/1枚単価/金額・製品合計）＋初期費用セクション（項目別×利益率・INCLUDED は非表示）＋総合計の2セクション構成へ全面改訂。金額の正を1枚単価手打ち（finalUnitPriceManualJpy）と初期費用行手打ち（presentedPriceManualJpy）に一本化・総額は導出。finalPriceManualJpy 非推奨化（列は残す・非破壊）。純増2列の migration あり。MOQ 未入力は出力不可。複製時は手打ち新列をリセット。材料/工賃明細・原価・利益率は非表示 |
