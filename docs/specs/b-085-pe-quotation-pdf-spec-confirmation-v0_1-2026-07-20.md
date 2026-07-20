# B-085 量産見積 見積書PDF出力 仕様確認書 v0.1（2026-07-20）

## 対象プロジェクト
- リポジトリ: shintarokoenuma/shunya-pms
- ローカルパス: ~/shunya-production-system
- 本番URL: shunya-pms-web-production.up.railway.app
- saagara-v2 とは完全に別プロジェクト

## 0. 対象の確定（design-reread Step 0）
- 設計対象＝量産見積（ProductionEstimate）の複数選択→見積書PDF一括出力。
- QE-1R 見積書PDF（v0.2 道A・quotation-pdf-and-list-spec-confirmation-v0_2）と
  同型構造・資産最大流用。
- ★migration なし（宛先は導出・金額は保存済み列のみ使用）。
  live 確認済み（2026-07-20 レポート・PE スキーマ/導出式/PDF 資産所在）。
- 概算（QE-1R）との混載は不可。PDF は概算・量産で別々（チャット確定 2026-07-20）。

## 1. 入口・選択
- 起点A＝/quotations 量産見積セクション。チェックボックス列＋「選択をPDF出力」
  ボタンを QE-1R セクションと同 UI で追加。
- 起点B＝品番カルテ内の量産見積セクション（同経路・実装コスト小のため同時実装）。
- 束ね制約: 1クライアント限定。宛先は PE.productId → Product.clientId →
  Client.companyName の2段一括引きで導出（listRoughEstimatesForCompany 作法流用・
  N+1 回避）。混在選択は UI 警告＋出力 disable、サーバ側も MIXED_CLIENT で弾く
  （二重の砦・QE-1R 踏襲）。

## 2. 出力ガード（PE_NOT_READY）
- 以下のいずれかに該当する PE は出力対象にできない:
  - estimateQuantity ≦ 0
  - 最終1枚単価が null（finalUnitPriceManualJpy も autoUnitPriceJpy も未保存）
- UI は選択時に警告＋出力ボタン disable。サーバ側も { error: "PE_NOT_READY" } で
  対象 PE 番号を返して弾く（QE-1R の MOQ_REQUIRED と同作法）。

## 3. PDF構造（QE-1R 道A と同型・2セクション＋総合計）
- ヘッダ（PDF全体で1つ）: 発行元＝COMPANY_PROFILE／宛先＝Client.companyName＋
  「御中」／発行日。
- 【製品セクション】1 PE＝1行。
  - 列＝品名（productName＋productCode。title があれば併記し複数案判別）／
    数量（estimateQuantity）／1枚単価／金額（＝1枚単価×数量）。
  - 1枚単価の正: finalUnitPriceManualJpy ?? autoUnitPriceJpy
    （DB 保存済み列からの読み出しのみ・PDF 生成時の再計算はしない）。
  - 金額は「表示された1枚単価×数量」で必ず一致（電卓で合う）。
    丸め細部は実装ブリーフ段。
  - 末尾に【製品合計】行。
- 【別枠（初期費用）セクション】
  - 行＝isSeparateBilling=true かつ presentedPriceManualJpy 非 null の明細行のみ。
    presentedPriceManualJpy が null の別枠行は PDF に出さない
    （PE 本体 spec の「既定非計上」思想そのまま・二重請求防止）。
  - 項目名＝itemName＋productName 付記（どの品番の費用か明示）。
  - 金額の正＝presentedPriceManualJpy（手打ち値そのもの。自動フォールバックなし
    ＝QE-1R と異なる点。PE の別枠は既定非計上のため）。
  - 末尾に【別枠合計】行。
- 【総合計】＝製品合計＋別枠合計（computeGrandTotalJpy と同思想の複数 PE 束ね版）。
- 備考: PE.notes を見積単位で表示（配置は実装ブリーフ段）。

## 4. 非表示ライン（絶対線・QE-1R §4 踏襲）
- 材料/工賃の明細行・原価（autoUnitCostJpy・subtotalJpy 等）・利益率（marginRate）は
  PDF に一切出さない。PDF データ型にも載せない（型レベルで漏れ防止）。
- 通貨は JPY 前提（finalUnitPriceJpy・presentedPriceManualJpy とも JPY 列）。
  USD 提示 PDF はスコープ外。

## 5. initialCostBillingMode の扱い
- v0.1 は SEPARATE 前提。列は @default(SEPARATE) で UI 露出前（B-077）のため
  全件 SEPARATE。
- INCLUDED 対応（別枠を単価込みにして本セクション非表示＋「（初期費用込）」付記）は
  B-077 と同時設計に送る。本書では「SEPARATE 以外の値が来たら 500 ではなく
  SEPARATE 同等で出力＋ログ警告」程度の防御に留める（細部は実装ブリーフ段）。

## 6. 実装構成（migration なし）
- 新 POST route: /api/production-estimates/pdf（body: { ids: string[] }）。
- PDF データ整形: pe-quotation-data.ts 新設（quotation-data.ts 作法踏襲）。
- ドキュメント定義: quotation-document.tsx を共通化 or PE 用新設
  （実装ブリーフ段で判断。render.tsx・fonts.ts は流用）。
- 一覧 UI: production-estimates-list.tsx にチェックボックス＋PDF ボタン
  （quotations-list.tsx 作法流用）。DL ハンドラは download-quotation-pdf.ts 作法流用。

## 7. スコープ外
- 概算と量産の混載 PDF／USD・海外インボイス PDF／版管理・PDF 発行履歴の DB 保存
  （QE-1R 踏襲）。
- INCLUDED モードの提示（→B-077）。
- PE コピー機能への波及なし（手打ち単価のコピー時リセットは既存仕様のまま）。

## 8. 次ステップ
- 本書確定 → docs/specs 保存＋ project knowledge 追加 → 実装ブリーフ
  （PR 1本・feat/b085-pe-quotation-pdf）→ 実装は B-080 より先行
  （チャット確定 2026-07-20）。

## 改訂履歴
| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-07-20 | v0.1 | 初版確定。QE-1R 道A 同型・migration なし・宛先2段導出・PE_NOT_READY ガード・別枠は presentedPriceManualJpy 非 null のみ計上 |
