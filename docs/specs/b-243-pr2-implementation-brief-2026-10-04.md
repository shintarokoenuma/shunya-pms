# B-243 PR-2 実装ブリーフ — 「原価・見積」と「受注」の出し分け（2026-10-04）

- 対象: shunya-pms・main `a6ad821`（PR-1 = PR #181 のマージ後）を claude.ai 側で直接読んで作成（2026-10-04 11:52〜12:00 JST）
- 前提: PR-1 のブリーフ `docs/specs/b-243-pr1-implementation-brief-2026-10-04.md`（C-D1〜C-D9）。基盤（`rolePermissions.areas`・`AREA_KEYS`・`AREA_DEFAULTS`・`canSeeArea`・`checkArea`・`requireAreaPage`・`canSeeAreaForSession`・`NavItem.area`）は PR-1 で入っている
- 根拠: 慎太郎さんの回答（MEMO_INBOX M-044・ナレッジ claude/MEMO_INBOX-append-2026-10-04.md 追記 4・7・8）
  - 10:08「はい、一度、見えない状態で進めて下さい。」（一般スタッフの初期値はすべて見えない）
  - 11:52「この内容でいいです。」（品番カルテは原価の部分だけ隠す・見積の画面は丸ごと隠す・サンプルのコスト集計は隠す）
  - 11:56「Aでいいです。」（受注は画面ごと隠す・品番カルテの受注の表は見える）
- schema・migration: **なし**

## 1. 決定事項

- **D2-1 area を2つ足す**: `AREA_KEYS = ["orders", "cost", "sales"]`
  - `AREA_LABELS`: cost「原価・見積」／sales「受注」
  - `AREA_HINTS`: cost「量産見積・概算見積・原価・BOM の単価」／sales「受注の一覧・詳細・作成」
  - `AREA_DEFAULTS`: cost `{ STAFF: "hidden" }`／sales `{ STAFF: "hidden" }`
  - `AREA_DENIED_MESSAGES`: cost「この役割では原価・見積を扱えません」／sales「この役割では受注を扱えません」
  - validator と「役割と権限」の表は PR-1 で AREA_KEYS を回す作りなので、行は自動で増える（現物で確かめる）
- **D2-2 品番カルテは原価の部分だけ隠す**（11:52）: 絵型・品番・縫製指示・SKU 数量・メモ・型紙・縫製仕様書・カラー展開・進行・マーキング・所要量・関連書類・サンプル・メタは今まで通り
- **D2-3 BOM は単価と金額だけ隠す**: 一覧の単価列・1着概算の列・「発注から」の印（costSource）、入力フォームの単価・通貨の欄、合計の「1着概算 ¥」を出さない。★原価が見えない人が BOM を保存しても、**既存の単価・通貨・単価の出どころを消さない**（下の §2-6）
- **D2-4 BOM の「発注から取り込み」は発注の権限で出し分ける**: PO の明細を一覧にする機能なので、`orders` が見えない人には出さない（action も拒否）
- **D2-5 受注は画面ごと隠す**（11:56）: サイドバー「受注」・`/sales-orders` 配下・受注の Server Action・前受金の請求（受注の画面の機能）。品番カルテ「受注・発注」の受注の表（色×サイズの受注数・MOQ 判定・金額なし）は見える。ただし表の中の受注番号のリンクと「受注を作成」は出さない
- **D2-6 量産発注の生成は「発注」と「原価・見積」の両方が見える人だけ**: 生成画面は量産見積の明細と単価を並べるため。`/production-estimates/[id]/generate`・生成の入口ボタン・`generateProductionOrders` に cost の判定を足す
- **D2-7 原価が見えて発注が見えない役割（設定で作れる組み合わせ）**: 原価の画面の中の発注番号・仕入先名（量産実績原価の WO 番号、サンプルのコスト集計の PO 番号、概算見積の過去の発注明細、見積明細の「由来: ○○」）は**そのまま出す**。原価の内訳の一部として扱う。発注の画面へのリンクは PR-1 で開けないので、番号の文字だけが見える。★既定の役割にこの組み合わせは無い（一般スタッフは両方見えない・ほかは両方見える）。要望が出たら別番号で伏せる
- **D2-8 内部から呼ばれる関数は止めない**: `recomputeSampleProductionCosts`（発注の保存のたびに呼ばれる）・`markSalesOrdersConvertedForProduct`（量産発注の生成から呼ばれる）・`getSalesOrderSectionForProduct`（品番カルテの受注の表・金額なし）・`listConvertedSalesOrdersForProduct`（生成画面＝D2-6 で守られている）には判定を入れない
- **D2-9 型番の画面の原価**: 品番カルテのパターンNO 行から型番の編集へ行ける（B-207）。型番の詳細と編集フォームの「累計売上・累計パターンコスト・累計デザインコスト・単位コスト」の行は、cost が見えない人には出さない（表示のみ・保存には関係しない）

## 2. 作るもの・変えるもの

### 2-1. 純関数
`src/lib/settings-visibility.ts`: D2-1 の4つの定数に cost・sales を足す。`readRolePermissions` は AREA_KEYS を回すので変更不要（確かめる）

### 2-2. サイドバー
`src/components/app-shell/nav-items.ts`: 「見積もり」に `area: "cost"`、「受注」に `area: "sales"`

### 2-3. 画面（ページ）
- 新規 `src/app/(app)/quotations/layout.tsx`・`src/app/(app)/production-estimates/layout.tsx`: `await requireAreaPage("cost")`
- 新規 `src/app/(app)/sales-orders/layout.tsx`: `await requireAreaPage("sales")`
- `src/app/(app)/production-estimates/[id]/generate/page.tsx`: 既存の `requireAreaPage("orders")` の後に `requireAreaPage("cost")`（layout でも cost は止まるが、意図を明示する）

### 2-4. Server Action（requireSession の直後に checkArea）
- cost: `src/lib/actions/production-estimates.ts` の createProductionEstimateFromSample / updateProductionEstimate / softDeleteProductionEstimate / getProductionEstimate / getProductionEstimateSection / listProductionEstimatesForCompany / getProductionOrderGenerationContext
- cost: `src/lib/actions/rough-estimates.ts` の export async function すべて（getDefaultMarginRateForProduct・listPastPoItemsBySupplier・listPastWoItemsByCostCategory を含む12本）
- cost: `src/lib/actions/production-cost.ts` の getProductionCostInputs
- cost: `src/lib/actions/sample-production-costs.ts` の getSampleProductionCostBreakdown（recomputeSampleProductionCosts は D2-8 で除外）
- cost: `src/lib/actions/production-order-generation.ts` の generateProductionOrders に `checkArea("cost")` を足す（orders の判定の後）
- sales: `src/lib/actions/sales-orders.ts` の listSalesOrders / getSalesOrder / createSalesOrder / updateSalesOrder / updateSalesOrderStatus / cancelSalesOrder（D2-8 の3本は除外）
- sales: `src/lib/actions/delivery-notes.ts` の createDepositRequest / getSalesOrderDepositSection（受注の画面の前受金）
- orders: `src/lib/actions/boms.ts` の listPoItemsForBomImport / importPoItemsToBom（D2-4）
- ★返り値の作法は PR-1 と同じ（配列は []、ActionResult は { ok:false, error }）

### 2-5. 品番カルテ `src/app/(app)/products/[id]/page.tsx`
- `canSeeCost` と `canSeeSales` を `canSeeAreaForSession` で取る（PR-1 の canSeeOrders と並べる）
- `canSeeCost` が false なら、`getProductionEstimateSection`・`listRoughEstimatesByProduct`・`getProductionCostInputs`・`getDefaultMarginRateForProduct` を**呼ばない**（データを作らない）
- 引き出し「見積・原価」（id: "est"）の項目そのものを、`canSeeCost` が false のとき並びから外す
- `BomSection` に `canSeeCost` と `canSeeOrders` を渡す（§2-6）
- `SalesOrderSection` に `canSeeSales` を渡す。false なら受注番号はリンクにせず文字で出し、「受注を作成」を出さない
- 「受注・発注」の引き出しは、受注の表があるので残す
- `ProductionEstimateSection` の「量産発注を生成」は `canSeeOrders && canSeeCost` のときだけ（ただし est の引き出しごと消えるので、実質は cost が見える人の中での判定）

### 2-6. BOM `src/app/(app)/products/_components/bom-section.tsx` と `src/lib/actions/boms.ts`
- 画面: `canSeeCost` が false なら、一覧の単価・1着概算の列と costSource の印、フォームの単価・通貨の欄、合計の「1着概算 ¥」を出さない。マスターから資材を選んだときの単価の自動入力もしない
- 画面: `canSeeOrders` が false なら「発注から取り込み」のボタンとダイアログを出さない
- サーバ: `getBomByProductId` と `listMaterialsForBomSelect` は、cost が見えない人には `unitPrice`（と単価の出どころ）を **null にして返す**（画面で隠すだけにしない）
- サーバ: `addBomItem` は cost が見えない人から来た単価を捨てて保存する（単価は null）
- サーバ: `updateBomItem` は cost が見えない人から来たとき、**既存の行の unitPrice をそのまま残す**（buildItemData の結果から unitPrice を除く。main a6ad821 の buildItemData は currency・costSource を書かないが、書く列が増えていたら同じく除く）。★これを忘れると一般スタッフが用尺を直しただけで単価が消える
- AuditLog の before/after は今のまま（単価が変わらないことが記録に残る）

### 2-7. サンプル製作 `src/app/(app)/samples/[id]/page.tsx`
- `canSeeCost` が false なら「コスト集計」のカードを出さず、`getSampleProductionCostBreakdown` を呼ばない

### 2-8. 型番 `src/app/(app)/model-codes/[id]/page.tsx`・`[id]/edit/page.tsx`・`_components/model-code-form.tsx`
- `canSeeCost` が false なら D2-9 の4行を出さない（edit は props で渡す）

### 2-9. API（403）
- `src/app/api/production-estimates/pdf/route.ts`・`src/app/api/quotations/pdf/route.ts`: 401 の判定の直後に `checkArea("cost")`。通らなければ 403（文言は AREA_DENIED_MESSAGES.cost）

### 2-10. 全体検索 `src/lib/actions/global-search.ts`
- cost が見えなければ ②見積（概算・量産）の2本を実行せず `[]`（PR-1 の発注と同じ作り）。受注は検索の対象に無い（現物で確かめる）

## 3. テスト（`src/lib/user-management.test.ts` に ⑨ を足す）
1. 空の設定で STAFF は cost・sales・orders を見られない。PRODUCTION / ACCOUNTING / SALES / DESIGNER は3つとも見られる
2. `areas.cost.STAFF = "view"` で STAFF が cost を見られ、sales と orders は見られないまま（area ごとに独立）
3. `areas.sales.DESIGNER = "hidden"` で DESIGNER だけ sales が見られない
4. OWNER / ADMIN は3つとも hidden が書かれていても見られる。EXTERNAL・null は見られない
5. 知らない area（例 `billing`）が保存されていても捨てられる
6. ⑧（PR-1）がそのまま通る

## 4. 確認（dev・localhost:3001）
★確認用ユーザーのパスワードは `<新しいパスワード>`（< と > を含む・2026-10-04 10:39 に流し直した値）。役割ごとにウィンドウを分ける。
一般スタッフ（dev-staff）で:
1. サイドバーに「見積もり」「受注」が無い（発注も無いまま）
2. `/quotations`・`/production-estimates/<id>`・`/sales-orders`・`/sales-orders/new` を直接開くとダッシュボードへ戻る
3. 品番カルテ AOI-26SS-M-TS-001: ボタンの並びに「見積・原価」が無い。「受注・発注」を開くと受注の表は出るが、受注番号はリンクでなく、「受注を作成」が無い
4. 同じ品番の「資材表 BOM」: 単価・1着概算の列と「発注から取り込み」が無い。行を1つ編集して用尺だけ変えて保存 → 生産管理のウィンドウで同じ行の単価が**変わっていない**こと（★必ず見る）
5. サンプル製作（AOI のサンプル）: 「コスト集計」のカードが無い
6. パターンNO の「型番で編集」から型番の編集を開くと、累計売上・コスト・単位コストの行が無い
7. 全体検索で「PE-2026」「RE-2026」を入れても見積が出ない
生産管理（dev-production）で:
8. 1〜7 がすべて今まで通り見える・使える。BOM の単価は 4 の前後で同じ値
管理者（dev-admin）で:
9. 「役割と権限」の「画面」の表に「発注」「原価・見積」「受注」の3行があり、一般スタッフが3つとも「隠す」。原価・見積だけ一般スタッフを「見る」にして保存 → 一般スタッフで「見積もり」が出て「受注」「発注」は出ないまま → 「隠す」に戻す（★戻しは別の手順で）

## 5. 本番への影響
- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）
- 本番の User はオーナー1人（2026-10-04 時点）。見え方が変わる人はいない
- migration なし。本番の CompanySetting は書き換えない

## 6. 作業の約束
- ブランチ `feat/b243-pr2-cost-sales-visibility`（main `a6ad821` から）。PR 必須
- `npx tsc --noEmit`・触ったファイルの lint・`npx tsx src/lib/user-management.test.ts`・`npx next build`（dev サーバが止まっているときだけ。後で .next を消す）が通れば commit → push → PR open まで。マージは慎太郎さん
- "use server" のファイルから文字列の定数を export しない
- 新しいクエリは companyId と deletedAt: null を手書き（AGENTS.md）
- 本書を `docs/specs/b-243-pr2-implementation-brief-2026-10-04.md` として PR に同梱する

## 7. 本 PR で作らないもの
- 経理（請求・入金・締め・支払）・納品・マスターの取引条件と口座（PR-3）。★納品書の引き当てダイアログの「受注（量産）」タブは受注の単価を出すが、納品は PR-3 で扱う
- 原価が見えて発注が見えない役割のための発注番号の伏せ字（D2-7）
- 「見えるが編集できない」段階
- 「役割と権限」の表のはみ出し（B-257）

END-OF-BRIEF-B243-PR2
