# QE-1R 見積書PDF出力・横断見積一覧・見積コピー 実装ブリーフ (2026-07-06)

## 対象プロジェクト
- リポジトリ: shintarokoenuma/shunya-pms
- ローカルパス: ~/shunya-production-system
- 本番URL: shunya-pms-web-production.up.railway.app
- saagara-v2とは完全に別プロジェクト

土台 spec: `docs/specs/quotation-pdf-and-list-spec-confirmation-v0_1-2026-07-05.md`（@main・コミット 2e24a17）。本ブリーフは spec v0.1 を実装レベルに落としたもの。**spec と食い違う指示があれば spec を正とし、その場で止めて確認すること。**

---

## 0. 前提・依存関係・実装順

### 0-1. 依存前提（★充足済み・2026-07-06）
本実装は QE-1R 本体（RoughEstimate/RoughEstimateItem スキーマ・calc.ts・actions）に依存する。**この前提は充足済み**：

- **PR #96 は MERGED**（squash commit `8af85d8`・2026-07-05 17:26）。RoughEstimate 一式＋引き当てキー＋1枚単価＋バッジ＋USD $小計併記まで全て main に入っている。
- **本番反映も完了**（Railway 自動デプロイで 39本目 `20260701000000_rough_estimate` が本番 DB へ適用済み・ログで確認）。
- したがって **`origin/main`（8af85d8）から新ブランチ `feat/qe1r-quotation-pdf` を切って着手する**。古い `feat/qe1r-p1-rough-estimate-schema` は main と同内容＝役割終了。

### 0-2. migration
**なし。** spec 明記どおり既存 PDF スタック4層＋calc.ts 流用で完結。スキーマ変更・enum 追加・`db push`・`migrate` はいずれも不要。もし実装中に「列を足したくなった」ら、それは設計の逸脱なので手を止めて相談すること。

### 0-3. ブランチ／PR 運用
- ブランチ: `feat/qe1r-quotation-pdf`（コードを含むので feature branch + PR 必須。main 直 push しない）。
- 型・lint・build が 0 になったら commit → push → PR open まで Claude Code が自走してよい。**マージは慎太郎さんが握る**（migration は無いが本番反映＝不可逆のため）。
- `git add` は明示的ファイルパスのみ（`-A`／`.`／`--all` 禁止）。

### 0-4. 実装順（1本の中の4パート・この順で段階コミット推奨）
- **Part A**: 入口有効化（nav 1行）＋会社横断見積一覧（list action ＋ /quotations ページ）
- **Part B**: PDF 生成層（quotation-data.ts / quotation-document.tsx / render 追記 / route）
- **Part C**: 選択→出力の配線（横断一覧＋カルテ内 rough-estimate-section.tsx）
- **Part D**: 見積コピー（duplicate read action ＋ 作成フォームの複製モード）

Part A→B→C の順なら、C の時点で初めてブラウザから PDF が落とせる（A/B は単体では画面に出ない）。Part D は独立。

---

## 1. 確定事実（live 調査で裏取り済み・2026-07-06）

記憶ではなく実物で確認済みの事実。実装はこれに従う。

### 1-1. スキーマ（変更しない）
- `RoughEstimate`: `id / companyId / estimateNumber / productId（scalar・@relation なし）/ issuedAt / title? / notes?（前提メモ）/ presentedMoq? / currency(既定JPY) / validUntil? / marginRate? Decimal(5,2) / marginRateSource / initialCostBillingMode(既定SEPARATE) / autoCostTotalJpy? / autoPriceTotalJpy? / finalPriceManualJpy?（すべて Decimal(15,2)?）/ createdByUserId? / deletedAt?(soft delete) / items[]`
- `@@unique([companyId, estimateNumber])` / `@@index([companyId, productId])`
- `RoughEstimateItem`: `itemOrder / itemCategory(RoughEstimateCategory) / itemName / itemNameEn? / materialId? / costCategoryId? / source(RoughEstimateItemSource) / sourcePoItemId? / sourceWoItemId? / quantity? / unit? / unitPrice? / currency(既定JPY) / subtotal? / subtotalJpy? / notes?`
- `InitialCostBillingMode { SEPARATE, INCLUDED }`（INCLUDED は `presentedMoq` 必須）
- ★`RoughEstimate` は `productId` しか持たない。**宛先 Client・Brand は PDF データ層で別途 join する。**

### 1-2. calc.ts（`src/lib/pdf/` ではなく rough-estimate 配下の中立モジュール・そのまま流用）
- `computePriceBreakdownFromTotals(autoCostTotalJpy, autoPriceTotalJpy, marginRatePercent, billingMode, presentedMoq)` を PDF の1枚単価導出に使う。
  - `perUnit.productionPricePerUnitJpy` … **SEPARATE の1枚提示単価（初期費用抜き）**
  - `perUnit.includedPerUnitPriceJpy = autoPrice / moq` … **INCLUDED の1枚提示価格（初期費用込み）**
  - `presentedMoq` が null/0 のとき `perUnit === null`（＝1枚単価は非表示）
- 中立モジュール（`@prisma/client` からは enum のみ import）。サーバ側 PDF データ層から安全に import 可。
- ★**保存列は増やさない。** autoCost/autoPrice/marginRate/billingMode/presentedMoq から都度導出する。

### 1-3. actions（`src/lib/actions/rough-estimates.ts`）
- `getRoughEstimate(id)` → `RoughEstimateDetail = RoughEstimate & { items }`。PDF データ源（ただし productId のみ）。
- `getRoughEstimateForEdit(id)` → `RoughEstimateEditData`（plain・Decimal 非渡し）。**複製プレフィルの流用元。**
- `listRoughEstimatesByProduct(productId)` → `RoughEstimateListRow[]`。**company 横断版は未存在＝新設。**
- `createRoughEstimate(input)` → 複製の書き込みはこれに相乗り（採番・バリデーション・calc を二重実装しない）。
- 採番 `generateNextRoughEstimateNumberPreview()` / P2002 リトライ作法は既存に準拠。

### 1-4. 既存 PDF スタック（`src/lib/pdf/`・踏襲）
- `fonts.ts`: `PDF_FONT_FAMILY = "NotoSansJP"` / `registerPdfFonts()`
- `order-data.ts`: 型 `OrderPdfData/OrderPdfItem/OrderPdfTarget` ＋ `getOrderPdfData("po"|"wo", id, companyId)`。`primaryProductCode(product)` ユーティリティあり。
  - `resolveTarget` は `sampleProductionId → Product → Brand` 起点。**QE-1R は productId 直保持なので、そのままは使えない。** productId 起点の解決を新設する。型 `OrderPdfTarget`（brandName/productName/itemNumber/season）は流用可。
- `order-document.tsx`: `<OrderDocument data>`・`registerPdfFonts()` 呼び出し済み・`COMPANY_PROFILE`（name/postalCode/address/tel/fax/email）を発行元ブロックにレンダリング済み。
- `render.tsx`: `renderOrderPdfBuffer(data) = renderToBuffer(<OrderDocument/>)`。関数1本のみ。

### 1-5. 既存 PDF route（POST 化の雛形）
- `GET /api/{purchase-orders|work-orders}/[id]/pdf`: `auth() → getOrderPdfData → renderOrderPdfBuffer → new Response(new Uint8Array(buffer), { "Content-Type": "application/pdf", "Content-Disposition": attachment; filename, "Cache-Control": "no-store" })`。
- `uploadOrderPdf`（GCS 控え）は失敗しても null が返るだけで継続。**本件 v0.1 では GCS 控えは保存しない**（複数見積のファイル名規則が未確定のため・§7 spec）。

### 1-6. nav / section（UI の土台）
- `src/components/app-shell/nav-items.ts:100`: `{ label: "見積もり", href: "/quotations", icon: Calculator, enabled: false }` → `enabled: true` に（1行）。`/quotations` ルートは未存在＝新設。
- `src/.../rough-estimate-section.tsx`: `Checkbox` / `Table` 系 / `DialogContent` は import 済み。`RoughEstimateSection`（state=dialogOpen/editingId/deleting）でテーブルを `rows.map` 描画。`RoughEstimateFormDialog` は `editingId` 分岐＋`getRoughEstimateForEdit(editingId)` でプレフィル。複製は `duplicateFromId` をもう1系統足す形。

---

## 2. Part A — 入口有効化＋会社横断見積一覧

### A-1. nav 有効化
- `nav-items.ts:100` の `enabled: false` → `true`（1行のみ）。

### A-2. 新設 action `listRoughEstimatesForCompany`
- 置き場所: `src/lib/actions/rough-estimates.ts`（既存に追記）。
- シグネチャ: `listRoughEstimatesForCompany(): Promise<CompanyRoughEstimateRow[]>`（companyId は session から。productId は取らない）。
- クエリ: `where: { companyId, deletedAt: null }`, `orderBy: { issuedAt: "desc" }`。
- 各行に品番名・宛先を出すため、取得した RE の `productId` 集合 → `Product`（productName/productCode/clientId）を **id 集合で一括引き（N+1 回避）** → その `clientId` 集合 → `Client`（companyName）を一括引き。Map で突き合わせて行に載せる。
- 返す行型 `CompanyRoughEstimateRow`（新規 export type）:
  - `{ id, estimateNumber, productId, productName, productCode, clientId, clientName, title, presentedMoq, issuedAt }`
- ページング/検索は **初版では実装しない**。件数が実務で膨らんだら後日追加。
- **取引先ソートは付ける**: action は issuedAt desc のまま返し、一覧コンポーネント側で clientName の昇順/降順トグルを持つ（client-side ソート・追加クエリなし）。

### A-3. 新設ページ `/quotations`
- 置き場所: `src/app/(app)/quotations/page.tsx`（server component で `listRoughEstimatesForCompany()` を呼び、client の一覧コンポーネントに渡す）。
- 表示列（spec §1 の最小列）: チェックボックス / 品番（productName＋productCode）/ タイトル / 宛先（clientName）/ 提示MOQ / 発行日 / RE番号。
- チェックボックスは複数選択。**別クライアントが混じったら「宛先が異なる見積が含まれています」と警告し、出力ボタンを disable**。選択中の clientId 集合サイズで判定。
- 「選択をPDF出力」ボタン → 共通 DL ハンドラ（B-5）を呼ぶ。
- 取引先ソートトグルを列ヘッダに（A-2）。
- （Part D で各行に「複製」動線も足すが、それは Part D で。）

---

## 3. Part B — PDF 生成層（新規3ファイル＋render 追記）

### B-1. `src/lib/pdf/quotation-data.ts`（新）
- export 型:
  - `QuotationPdfItem { itemName, itemCategory, quantity, unit, unitPrice, currency, subtotalJpy }`
  - `QuotationPdfBlock { target, title, estimateNumber, presentedMoq, materialItems[], laborItems[], initialCostItems[], perUnit: { label, valueJpy } | null, finalPriceJpy, notes }`
  - `QuotationPdfData { issuedAt, clientName, blocks: QuotationPdfBlock[] }`
- 関数: `getQuotationPdfData(ids: string[], companyId: string): Promise<QuotationPdfData | { error }>`
  - 各 id を `getRoughEstimate` 相当で引く（companyId で絞る・soft-deleted 除外）。見つからない id があればエラー。
  - productId 起点で `Product(productName/productCode/clientId/brandId/season) → Brand(brandName) → Client(companyName)` を解決（productId 起点の resolveTarget を新設。sampleProductionId 起点の既存 resolveTarget は流用不可）。
  - **全 id が同一 clientId か検証。違えば `{ error: "MIXED_CLIENT" }`**（横断起点の混在弾き・サーバ側の砦）。
  - 明細を itemCategory で MATERIAL / LABOR / INITIAL_COST に振り分け、各 itemOrder 昇順。
  - 1枚単価は `computePriceBreakdownFromTotals(...)` の perUnit から §6-3 のルールで `{ label, valueJpy }`（perUnit===null なら block.perUnit=null）。
  - `finalPriceJpy = finalPriceManualJpy ?? autoPriceTotalJpy`（§6-1）。両方 null なら「—」表示できるよう null 許容。
  - ★**autoCostTotalJpy・marginRate はデータ型に載せない**（PDF で絶対に出さないため型レベルで漏れを防ぐ）。

### B-2. `src/lib/pdf/quotation-document.tsx`（新）
- `registerPdfFonts()` 呼び出し・`PDF_FONT_FAMILY`・`COMPANY_PROFILE`（order-document.tsx に倣う）。
- ヘッダ（PDF 全体で1つ）: 発行元（COMPANY_PROFILE）／宛先 `clientName + " 御中"`（固定付与）／発行日。
- `blocks.map` で品番ブロックを縦積み・ブロック間に区切り線。各ブロック:
  - 見出し: 品番（productName＋productCode）／タイトル／RE番号／提示MOQ。
  - 明細テーブル: 費目順 **材料費 → 工賃 → 初期費用（別枠）**。列＝品目名・数量・単位・単価・小計（¥）。単価は行 currency 記号付き（¥/$）・小計は subtotalJpy（¥統一）＝§6-4。
  - 初期費用は **別枠セクションとして視覚分離**（見出し「初期費用（別途）」）。1枚原価に混ぜない（§6 絶対防衛線）。
  - 1枚単価: `block.perUnit` があれば「1枚あたり提示単価: ¥X（ラベル）」明記。null なら非表示。
  - 備考: notes をブロック内備考へ。
  - **合計行は一切置かない**（全体総額・初期費用一括合計・ブロック横断小計すべて無し）。
- 改ページ: ブロックは `<View>` で包む。ブロック単位 `wrap={false}` は付けない（明細多い時に破綻）。見出しがページ末尾で孤立しないよう配慮・Playwright で確認。

### B-3. `render.tsx` 追記
- `renderQuotationPdfBuffer(data: QuotationPdfData): Promise<Buffer> = renderToBuffer(<QuotationDocument data={data} />)` を既存 `renderOrderPdfBuffer` の隣に追加。

### B-4. `src/app/api/quotations/pdf/route.ts`（新・POST）
- `POST`: `auth()` → 401 ガード → `const { ids } = await req.json()` → ids の型/非空バリデーション（空配列・非配列は 400）→ `getQuotationPdfData(ids, session.user.companyId)`。
- error: `MIXED_CLIENT` → 400（「宛先が異なる見積が含まれています」）／not found → 404。
- 成功: `renderQuotationPdfBuffer(data)` → `new Response(new Uint8Array(buffer), { "Content-Type":"application/pdf", "Content-Disposition": attachment; filename, "Cache-Control":"no-store" })`。
- ファイル名: `見積書_{clientName}_{YYYYMMDD-HHmmss}.pdf`（timestampJst 流用可）。
- **GCS 控えは保存しない**（v0.1）。

### B-5. 共通クライアント DL ハンドラ（Part A/C 共有）
- 置き場所: 小さな util（`src/lib/quotations/download-pdf.ts` か一覧コンポーネント内関数）。
- 処理: `fetch("/api/quotations/pdf", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ids }) })` → `res.blob()` → `URL.createObjectURL` → 一時 `<a>` click → revoke。
- `res.ok` が false なら body の error を toast。
- 横断一覧・カルテ内の両方からこの1関数を呼ぶ（経路共有）。

---

## 4. Part C — 選択→出力の配線

### C-1. カルテ内 `rough-estimate-section.tsx`
- 既存テーブルに **選択チェックボックス列** を追加（Checkbox は import 済み）。選択 id の `Set<string>` state。
- テーブル上部/下部に「選択をPDF出力」ボタン。選択0件なら disable。
- 押下で B-5 の DL ハンドラに選択 ids を渡す。**同一品番なので UI 側のクライアント混在チェックは不要**（サーバ側で自動的に単一 client）。
- テーブル自体は既存。**選択 state と出力ボタンの追加のみ**（列や既存表示を壊さない）。

### C-2. 横断一覧（Part A のページ）
- A-3 の選択 state を DL ハンドラに配線。別クライアント混在時は出力ボタン disable＋警告。

---

## 5. Part D — 見積コピー（複製）

### D-1. 新設 read action `duplicateRoughEstimate(id)`
- 置き場所: `src/lib/actions/rough-estimates.ts`。
- 実装: `getRoughEstimateForEdit(id)`（既存・plain な RoughEstimateEditData を返す）を呼び、プレフィル用に加工して返す **read のみ**。書き込みなし。
- 加工:
  - **コピーする**: タイトル（`"{元タイトル} のコピー"` 付与）／presentedMoq／marginRate・marginRateSource／initialCostBillingMode／notes／全明細（itemCategory・itemName(En)・quantity・unit・unitPrice・currency・materialId・costCategoryId・**source・sourcePoItemId・sourceWoItemId＝引き当て焼き込みは保持**）。
  - **リセット（含めない）**: estimateNumber（新規採番は createRoughEstimate 側）／issuedAt（複製日）／finalPriceManualJpy（各発行に固有）。
- 返り値は「作成フォームの初期値」に使える形（RoughEstimateEditData 相当・加工済み・id なし）。

### D-2. UI: 作成フォームの複製モード
- `RoughEstimateFormDialog` に `duplicateFromId: string | null` を `editingId` とは別に追加。
- open 時分岐:
  - `editingId !== null` → 従来どおり `getRoughEstimateForEdit` で編集プレフィル。
  - `duplicateFromId !== null` → `duplicateRoughEstimate(duplicateFromId)` でプレフィル。**editingId は null のまま**＝保存は `createRoughEstimate`（新規採番・独立発行）。
  - どちらも null → 空の新規作成（従来）。
- 見積一覧（カルテ内・横断一覧の両方）の各行に「複製」アクション → `duplicateFromId` をセットしてダイアログを開く。
- ★**複製専用の書き込み経路は作らない。** 既存 `createRoughEstimate` に相乗り（採番・バリデーション・calc の二重実装を避ける）。

---

## 6. 表示規則の確定（客向け・絶対線）

PDF 上で崩してはいけない線。実装の検算ポイント。

- **6-1 金額の正**: 出す金額は `finalPriceManualJpy`。null なら `autoPriceTotalJpy` フォールバック。両方 null なら「—」。
- **6-2 非表示**: `autoCostTotalJpy`（原価）・`marginRate`（利益率）は全ブロックで**出さない**（B-1 で型にも載せない）。
- **6-3 1枚単価**: `computePriceBreakdownFromTotals` の perUnit から。SEPARATE → `productionPricePerUnitJpy`（初期費用抜き・ラベル「量産1枚あたり」）／INCLUDED → `includedPerUnitPriceJpy`（初期費用込み・ラベル「1枚あたり（初期費用込）」）。presentedMoq 未入力（perUnit===null）なら**1枚単価行ごと非表示**。★SEPARATE に `includedPerUnitPriceJpy` を流用しない（§6 絶対防衛線）。
- **6-4 通貨**: PDF は JPY 前提。**小計は必ず `subtotalJpy`（¥統一）**。単価列は行 currency 記号付きで元 unitPrice（例 `¥1,200` / `$8.50`）。行別通貨が混在してもこの規則で一貫（単価＝行通貨・小計＝¥換算）。これは 2026-07-06 実装の明細 UI「¥小計の下に $小計併記」と同一思想。
- **6-5 合計なし**: 全体総額・初期費用一括合計・ブロック横断小計、いずれも置かない。
- **6-6 初期費用別枠**: MATERIAL/LABOR とは別セクションで分離表示。1枚原価に混ぜない。
- **6-7 宛先**: `Client.companyName + " 御中"` 固定付与（Client に敬称列なし）。

---

## 7. 検証（完了報告の前提）

- **Playwright 実機で PDF を実際に落として目視**。少なくとも:
  1. カルテ内から単一見積を出力（SEPARATE・MOQ あり）。
  2. カルテ内から2〜3見積を選択して縦積み出力。
  3. 横断一覧から複数品番（同一クライアント）を選択して出力。
  4. 横断一覧で別クライアント混在 → 出力ボタン disable＋警告。
  5. INCLUDED・MOQ ありで1枚単価ラベルが「初期費用込」。
  6. presentedMoq 未入力で1枚単価行が消える。
  7. USD 行を含む見積で 単価が $ 記号付き・小計が ¥ で出る。
  8. 複製 → タイトル「のコピー」・番号/発行日/手打ち最終値リセット・引き当てバッジ（sourcePoItemId）保持。
- **絶対線の目視**: 原価・利益率が PDF のどこにも出ていない。合計行が無い。初期費用が別枠。
- `DialogContent` を触る場合は `sm:max-w-*` プレフィックス必須（過去バグ）。影響ダイアログは grep で網羅。
- `tsc` / `lint` / `build` を 0 にしてから完了報告。**「ビルド通った」だけで報告しない**（Playwright 実機再現＋スクショで裏取り）。
- 完了報告後、慎太郎さんがブラウザ最終確認。

---

## 8. スコープ外（引き込まない）
- 確定見積 QE-1/QE-2 の実装（/quotations は将来同居できる器にするが中身は概算のみ）。
- USD/海外インボイス PDF（後日・別レーン）。
- 見積の版管理・PDF 発行履歴の DB 保存（都度生成 DL・GCS 控えは v0.1 で保存しない）。
- 合計・小計ロジック全般（意図的に持たない）。
- 横断一覧のページング/検索（初版では持たない）。
- 初期費用の過去引き当て（別バックログ・引き当てキー設計の再検討が要る）。

---

## 9. 論点の確定（2026-07-06・全て決着）
- **9-1 PR #96 のマージ順** → 完了。MERGED（8af85d8）・本番反映済み。origin/main から feat/qe1r-quotation-pdf を切って着手。
- **9-2 明細の単価/通貨表示**（§6-4）→ 確定：単価=行通貨の記号付き元値（¥/$）、小計=¥換算（subtotalJpy）統一。
- **9-3 横断一覧のページング/検索** → 確定：初版はページング/検索なし。取引先（clientName）ソートは付ける（client-side トグル・A-2）。
