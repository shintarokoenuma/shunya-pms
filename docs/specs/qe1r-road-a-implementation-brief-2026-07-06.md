# QE-1R 道A 実装ブリーフ — 手打ち単価・2セクションPDF (2026-07-06)

## 対象プロジェクト
- リポジトリ: shintarokoenuma/shunya-pms
- ローカルパス: ~/shunya-production-system
- 本番URL: shunya-pms-web-production.up.railway.app
- saagara-v2とは完全に別プロジェクト

土台 spec: `docs/specs/quotation-pdf-and-list-spec-confirmation-v0_2-2026-07-06.md`（@main・4e79508）
＋ `docs/specs/quotation-rough-estimate-spec-addendum-v0_2-2026-07-06.md`（同）。
旧ブリーフ（quotation-pdf-and-list-implementation-brief-2026-07-06.md）の Part A〜D 節は
実装済みコードの記録として残るが、Part B の表示規則（旧 §6）は本ブリーフが上書きする。
**spec と食い違う指示があれば spec を正とし、その場で止めて確認すること。**

---

## 0. 前提・ブランチ・実装順

### 0-1. ブランチ
- `feat/qe1r-quotation-pdf`（先頭 `f5d8f48`・Part A〜D 実装済み・未マージ）に**そのまま積む**。
  新ブランチは切らない。着手前に `git switch feat/qe1r-quotation-pdf` と
  `git log -1 --oneline`（f5d8f48 であること）を確認。
- main（4e79508）との差分は docs のみなので rebase は不要。必要になったら止めて相談。

### 0-2. migration（★今回はあり・純増2列・非破壊）
- dev = `db push`（hopper:12921・migration 履歴なし）／本番 = マージ時の自動 `migrate deploy`。
- 手順（正規手順どおり）:
  1. schema.prisma に §1 の2列を追加。
  2. migration SQL を手書きで作成:
     `prisma/migrations/20260706000000_road_a_manual_price_columns/migration.sql`
     内容は ALTER TABLE ... ADD COLUMN 2本のみ（NULL 許容・DEFAULT なし）。
  3. `prisma migrate diff --from-migrations --to-schema-datamodel` 相当で**空 diff を確認**
     （手書き SQL とスキーマの一致担保）。
  4. dev へ `prisma db push`（接続先が hopper:12921 であることを実行前に目視確認・
     shunya-environment-safety-check）。
  5. 本番へは**何もしない**（マージ時に自動適用・§7 A方式）。
- `finalPriceManualJpy` は**触らない**（列残置・DROP しない・DEFAULT 変更しない）。

### 0-3. 実装順（Part E→F→G→H・段階コミット）
- **Part E**: スキーマ＋migration＋dev db push
- **Part F**: calc.ts 純関数追加（初期費用の項目別自動提示額・単価解決）
- **Part G**: actions＋入力フォーム改修（手打ち欄追加・総額手打ち撤去・複製リセット）
- **Part H**: PDF 作り直し（quotation-data / quotation-document）＋MOQ_REQUIRED ガード
- 型・lint・build 0 → commit → push まで自走可。PR open は全 Part 完了後に1本
  （Part A〜D 込みの feature 全体）。**マージは慎太郎さんが握る。**
- `git add` は明示パスのみ（`-A`／`.`／`--all` 禁止）。

---

## 1. Part E — スキーマ（純増2列）

    // RoughEstimate に追加（finalPriceManualJpy の直後）
    finalUnitPriceManualJpy Decimal? @map("final_unit_price_manual_jpy") @db.Decimal(15, 2)
    // 手打ち1枚単価（道A・金額の正）。null なら自動参考単価にフォールバック

    // RoughEstimateItem に追加（subtotalJpy の直後）
    presentedPriceManualJpy Decimal? @map("presented_price_manual_jpy") @db.Decimal(15, 2)
    // 初期費用行の手打ち提示額（INITIAL_COST 行のみ UI 露出・他費目は常に null）

- コメントも上記の趣旨で付与。index 追加なし。enum 追加なし。

## 2. Part F — calc.ts（純関数の追加・既存関数は変更しない）

- `computeInitialCostPresentedJpy(subtotalJpy, marginRatePercent): number | null`
  … 行の自動提示額＝ `subtotalJpy × (1 + rate/100)` を**円未満切り上げ**。
  subtotalJpy か rate が null なら null。
- `resolveUnitPriceJpy(finalUnitPriceManualJpy, perUnit, billingMode): { valueJpy, isManual, includedBadge } | null`
  … 製品行の1枚単価解決。手打ちが非 null ならそれ（isManual=true）、null なら
  自動参考単価（SEPARATE=productionPricePerUnitJpy／INCLUDED=includedPerUnitPriceJpy を
  **円未満切り上げ**）。両方 null（=perUnit null）なら null。
  includedBadge = (billingMode===INCLUDED)。
- `resolveInitialCostPresentedJpy(presentedPriceManualJpy, subtotalJpy, marginRatePercent)`
  … 初期費用行の提示額解決（手打ち ?? 自動）。
- いずれも中立モジュール規約維持（@prisma/client からは enum のみ import）。
- **丸め規則（確定）**: 客に出す単価・提示額は整数円（円未満切り上げ・Math.ceil）。
  金額＝表示された整数円単価 × 数量、合計＝表示金額の積み上げ（電卓一致を最優先）。

## 3. Part G — actions・入力フォーム改修

### G-1. actions（`src/lib/actions/rough-estimates.ts`）
- create/update の Zod input に `finalUnitPriceManualJpy?`・明細行に
  `presentedPriceManualJpy?` を追加（整数円・正数・optional/null）。
  **INITIAL_COST 以外の行で presentedPriceManualJpy が来たら null に落とす**（サーバ側ガード）。
- `finalPriceManualJpy` を input schema から**削除**し、create/update で書かない
  （既存値は触らず放置）。読み取り系の型からも外す（getForEdit・list・PDF）。
- `getRoughEstimateForEdit` の返り値に新2列を追加。
- `duplicateRoughEstimate` のリセット対象に新2列を追加
  （タイトル「のコピー」・番号・issuedAt・手打ち値リセットの既存作法に合流）。

### G-2. フォーム（`RoughEstimateFormDialog`）
- 「1枚単価（手打ち・円）」欄を追加。placeholder/補助表示に自動参考単価
  （calc の resolveUnitPriceJpy の自動側）を出し、空なら自動値が使われる旨を明示。
- INITIAL_COST 明細行に「提示額（手打ち・円）」欄を追加。補助表示に自動提示額
  （subtotalJpy×(1+率)）。MATERIAL/LABOR 行にはこの欄を出さない。
- **総額手打ち欄（finalPriceManualJpy）を撤去**。跡地は導出表示に置換:
  「提示総額（導出）＝1枚単価×MOQ ＋ 初期費用提示合計（SEPARATE時）」。
- 社内サマリ（原価・利益率・自動単価）は維持。`DialogContent` を触る場合は
  `sm:max-w-*` プレフィックス必須（過去バグ・影響ダイアログを grep 網羅）。

## 4. Part H — PDF 作り直し＋MOQ ガード

### H-1. `quotation-data.ts`（型から作り直し）
- export 型（旧型は削除して置換）:
  - `QuotationPdfProductRow { estimateNumber, productLabel（productName＋productCode＋title併記）,
     quantity（presentedMoq）, unitPriceJpy, includedBadge, amountJpy（=unitPriceJpy×quantity）, notes }`
  - `QuotationPdfInitialCostRow { label（itemName＋productName付記）, amountJpy }`
  - `QuotationPdfData { issuedAt, clientName, productRows[], productTotalJpy,
     initialCostRows[], initialCostTotalJpy, grandTotalJpy, notesRows[] }`
  - ★原価（autoCostTotalJpy・subtotalJpy）・marginRate・材料/工賃明細は**型に載せない**。
    導出計算（率掛け）は data 層内部でのみ使用し、出力には提示額だけを出す。
- `getQuotationPdfData(ids, companyId)`:
  - 既存の取得・resolveTarget（productId 起点）・MIXED_CLIENT 検証は流用。
  - **MOQ_REQUIRED**: presentedMoq が null/0 の RE が1件でもあれば
    `{ error: "MOQ_REQUIRED", estimateNumbers: [...] }`。
  - 製品行: calc の resolveUnitPriceJpy で単価解決 → amount＝単価×MOQ。
  - 初期費用行: **SEPARATE の RE の INITIAL_COST 行のみ**対象。
    resolveInitialCostPresentedJpy で提示額解決。INCLUDED の RE の初期費用行は出さない。
  - 合計: productTotalJpy＝製品行 amount 積み上げ／initialCostTotalJpy＝初期費用行積み上げ／
    grandTotalJpy＝両者の和。
  - notesRows: notes が非 null の RE のみ `{ productLabel, notes }`。

### H-2. `quotation-document.tsx`（レイアウト作り直し）
- ヘッダ（発行元・宛先「御中」・発行日）は流用。
- 【製品】表: 品名／数量／1枚単価／金額。includedBadge の行は単価に「（初期費用込）」付記。
  末尾に「製品合計」行。
- 【初期費用（別途）】表: 項目（どの製品か明示）／金額。末尾に「初期費用合計」行。
  行が0件ならセクションごと非表示。
- 【総合計】を明記（強調）。
- INCLUDED を含む場合のみ脚注1行「※（初期費用込）表記の製品は初期費用を単価に含みます」。
- 備考枠: notesRows を「品名：メモ」で列挙（0件なら非表示）。
- 合計3行（製品合計・初期費用合計・総合計）以外の集計値を置かない。
  1つの表に集約するため旧「品番ブロック縦積み」構造は廃止。改ページは行単位で自然に。

### H-3. route（`/api/quotations/pdf`）
- `MOQ_REQUIRED` → 400（「提示MOQ 未入力の見積が含まれています: RE-...」）。
  既存 MIXED_CLIENT/404 は維持。
- UI 側（横断一覧・カルテ内）: 選択に MOQ 未入力 RE が含まれたら警告表示＋出力 disable
  （一覧行に presentedMoq は既にあるため client-side 判定可能）。

## 5. 表示規則（客向け・絶対線・検算ポイント）※旧ブリーフ §6 を置換
- 5-1 単価の正: finalUnitPriceManualJpy ?? 自動参考単価（整数円・円未満切り上げ）。
- 5-2 初期費用の正: presentedPriceManualJpy ?? subtotalJpy×(1＋率)（整数円・円未満切り上げ）。
- 5-3 総額はすべて導出（金額＝単価×数量・総合計＝製品合計＋初期費用合計）。電卓で合う。
- 5-4 非表示: 原価・利益率・材料/工賃明細（型レベルで遮断）。
- 5-5 INCLUDED: 初期費用セクションに出さない・単価に「（初期費用込）」・脚注。
- 5-6 MOQ 未入力は出力不可（UI disable＋サーバ 400）。
- 5-7 宛先「御中」固定・JPY 前提（v0.1 踏襲）。

## 6. 検証（完了報告の前提・Playwright 実機＋スクショ）
1. SEPARATE・MOQ100・手打ちなし → 製品行 5,239 円・金額 523,900・初期費用 15,600・総合計 539,500
   （dev RE-2026-0001 で検算・数値は live 確認）。
1-b. 割り切れない単価のケース（例: MOQ を 96 等に変えた一時データ、または autoPrice が
   MOQ で割り切れない見積）で、単価が切り上げ（Math.ceil）になっており、
   金額＝表示単価×数量で電卓一致することを確認。確認後、一時データは
   一意タイトル＋保護ガード（RE-2026-0001 除外）の既存作法で削除。
2. 1枚単価を手打ち（例 5,500）→ 金額 550,000・総合計が追随。
3. 初期費用行を手打ち（例 20,000）→ 初期費用合計・総合計が追随。
4. INCLUDED の見積 → 初期費用セクションに出ない・「（初期費用込）」付記・脚注あり。
5. 複数見積（同一クライアント）→ 製品表に複数行・合計3行が正しい。
6. MOQ 未入力を選択 → UI disable＋サーバ 400。
7. 複製 → 新2列がリセットされ自動参考値がデフォルト表示。
8. 総額手打ち欄が消え、導出総額表示に置換されている。
9. 絶対線の目視: 原価・利益率・材料/工賃明細が PDF のどこにも出ない。
10. `tsc`/`lint`/`build` 0。「ビルド通った」だけで完了報告しない。

## 7. マージ前後の A方式チェック（本番・migration 適用があるため必須）
- マージ前（read-only・本番接続は慎太郎さんが人手渡し・パスワードを会話に残さない）:
  1. host が shuttle:16099 であることを目視確認。
  2. `SELECT COUNT(*) FROM rough_estimates;` — ★本番 RE 件数は 2026-07-06 時点で**未確認**。
     ここで初めて確定する。何件あっても純増・バックフィルなしのため設計影響なし（記録のみ）。
  3. migration 履歴が39本目まで・`final_unit_price_manual_jpy` 列が未存在であることを確認。
- マージ → Railway 自動デプロイ（migrate deploy で40本目適用）。
- マージ後: デプロイログで適用確認 → 本番画面 smoke test（見積フォームが開く・PDF が落ちる）。

## 8. スコープ外
- finalPriceManualJpy の物理 DROP／初期費用の過去引き当て／USD インボイス／版管理／
  確定見積同居（spec v0.2 §7 どおり）。
