# B-243 PR-3 実装ブリーフ — 「納品」と「経理」の出し分け（2026-10-04）

- 対象: shunya-pms・main `a457a4a`（PR-2 = PR #182 のマージ後）を claude.ai 側で直接読んで作成（2026-10-04 13:10〜21:40 JST）
- 前提: PR-1 のブリーフ（C-D1〜C-D9）と PR-2 のブリーフ（D2-1〜D2-9）。基盤（`AREA_KEYS`・`AREA_DEFAULTS`・`canSeeArea`・`checkArea`・`requireAreaPage`・`canSeeAreaForSession`・`NavItem.area`）は入っている
- 根拠: 慎太郎さんの回答（MEMO_INBOX M-044・ナレッジ claude/MEMO_INBOX-append-2026-10-04.md 追記 4・10）
  - 10:08「はい、一度、見えない状態で進めて下さい。」（一般スタッフの初期値はすべて見えない）
  - 21:27「A」（納品は画面ごと隠す・一般スタッフは納品書を作れない）
- 作る順の変更: 当初の PR-3（経理＋納品＋マスターの取引条件・口座）を2本に分ける。**本 PR-3 は納品＋経理**、マスターの取引条件は PR-4（フォームごとに「保存しても隠した値を消さない」作りが要るため）。仕入先・工場に口座の欄は無い（口座は自社の「振込先」＝設定の行で隠せる）
- schema・migration: **なし**

## 1. 決定事項

- **D3-1 area を2つ足す**: `AREA_KEYS = ["orders", "cost", "sales", "delivery", "accounting"]`
  - `AREA_LABELS`: delivery「納品」／accounting「経理」
  - `AREA_HINTS`: delivery「納品書の一覧・詳細・作成・PDF」／accounting「請求・入金・締め」
  - `AREA_DEFAULTS`: delivery `{ STAFF: "hidden" }`／accounting `{ STAFF: "hidden" }`
  - `AREA_DENIED_MESSAGES`: delivery「この役割では納品を扱えません」／accounting「この役割では経理を扱えません」
  - 「役割と権限」の「画面」の表は AREA_KEYS を回すので5行になる（現物で確かめる）
- **D3-2 納品は画面ごと隠す**（21:27「A」）: サイドバー「納品」・`/deliveries` 配下・納品の Server Action・納品書 PDF。一般スタッフは納品書を作れない
- **D3-3 経理は画面ごと隠す**: サイドバー「請求」「入金」「締め」・`/invoices`・`/payments`・`/closings` 配下・それぞれの Server Action・請求書 PDF。クライアントの詳細の「入金」のカード（直近5件・「入金を記録」・入金の一覧へのリンク）も出さない
- **D3-4 受注の画面と納品のつながり**: 受注の詳細の納品書の一覧（DLV 番号のリンク）は、delivery が見えない人にはリンクにせず文字で出す。前受金の請求（`createDepositRequest`）と受注の画面の前受金の節（`getSalesOrderDepositSection`）は、既存の sales に加えて delivery も要る（前受金の請求は納品書を作るため）。★既定の役割にこの組み合わせは無い
- **D3-5 引き当てダイアログ**: 納品書の「発注・サンプル・受注から引き当て」は、orders が見えない人には発注の候補を、sales が見えない人には受注（量産）の候補を**サーバで空にして**返し、そのタブを出さない。サンプルの候補はそのまま。★既定の役割では納品が見える人は発注・受注も見える（設定で作れる組み合わせのための守り）
- **D3-6 納品が見えて経理が見えない／経理が見えて納品が見えない役割**: 請求書の作成画面に出る納品書の番号は**そのまま出す**（請求の内訳の一部・D2-7 と同じ考え）。納品の画面から請求の画面へのリンクは無い（現物で確かめる）
- **D3-7 止めない関数**: `listActiveClientsForDeliverySelect`・`listActiveProductsForDeliverySelect`（受注の作成・編集の画面が使う・金額なし）、`src/lib/billing/deposits.ts`・`src/lib/billing/client-payments.ts`（action の内部から呼ばれる）には判定を入れない

## 2. 作るもの・変えるもの

### 2-1. 純関数
`src/lib/settings-visibility.ts`: D3-1 の4つの定数に delivery・accounting を足す

### 2-2. サイドバー
`src/components/app-shell/nav-items.ts`: 「納品」に `area: "delivery"`、「請求」「入金」「締め」に `area: "accounting"`。★経理の見出しは、3つとも消えたら見出しごと出さない（PR-1 の作りで空のセクションが消えるか現物で確かめる。消えなければ消す）

### 2-3. 画面（ページ）
- 新規 `src/app/(app)/deliveries/layout.tsx`: `await requireAreaPage("delivery")`
- 新規 `src/app/(app)/invoices/layout.tsx`・`src/app/(app)/payments/layout.tsx`・`src/app/(app)/closings/layout.tsx`: `await requireAreaPage("accounting")`

### 2-4. Server Action（requireSession の直後に checkArea）
- delivery: `src/lib/actions/delivery-notes.ts` の listDeliveryNotes / getDeliveryNote / createDeliveryNote / updateDeliveryNote / updateDeliveryNoteStatus / softDeleteDeliveryNote / getDepositSuggestions / generateNextDeliveryNumberPreview / listActiveBuyersForDeliverySelect / listActiveDestinationsForDeliverySelect（D3-7 の2本は除外）
- delivery: 同ファイルの createDepositRequest / getSalesOrderDepositSection は、既存の `checkArea("sales")` の後に `checkArea("delivery")`（D3-4）
- delivery: `src/lib/actions/delivery-allocation.ts` の listAllocationCandidates。加えて D3-5（orders が見えなければ `orders` と `blocked` を `[]`、`groups` から発注由来の候補を除く。sales が見えなければ `soItems` を `[]`。groups の中身の作りは現物で確かめる）
- accounting: `src/lib/actions/invoices.ts` の6本（listActiveClientsForInvoiceSelect / getInvoiceCandidates / createInvoice / listInvoices / getInvoice / updateInvoiceStatus）
- accounting: `src/lib/actions/payments.ts` の5本（listClientPayments / listPayments / createClientPayment / getPaymentCancelImpact / cancelClientPayment）
- accounting: `src/lib/actions/period-closes.ts` の4本（getCloseWarnings / listPeriodCloses / closePeriod / reopenPeriod）
- ★返り値の作法は PR-1・PR-2 と同じ（配列は []、ActionResult は { ok:false, error }）

### 2-5. 引き当てダイアログ `src/app/(app)/deliveries/_components/allocation-dialog.tsx`
- 発注の候補が来ない（D3-5）ときは「発注」のタブを、受注の候補が来ないときは「受注（量産）」のタブを出さない。判定はページから `canSeeOrders`・`canSeeSales` を props で渡す（件数 0 と「見えない」を区別するため）

### 2-6. 受注の詳細 `src/app/(app)/sales-orders/[id]/page.tsx`
- `canSeeDelivery` を `canSeeAreaForSession("delivery")` で取る。false なら納品書の一覧の DLV 番号はリンクにせず文字で出す。前受金の節は D3-4 で action が拒否するので、拒否のときは節ごと出さない（エラーの文言を画面に出さない）

### 2-7. クライアントの詳細 `src/app/(app)/clients/[id]/page.tsx`
- `canSeeAccounting` を取る。false なら `listClientPayments` を**呼ばず**、「入金」のカード（PaymentRecordDialog と入金の一覧へのリンクを含む）を出さない
- 「取引条件」のカードは本 PR では触らない（PR-4）

### 2-8. API（403）
- `src/app/api/delivery-notes/pdf/route.ts`: 401 の判定の直後に `checkArea("delivery")`。通らなければ 403（文言は AREA_DENIED_MESSAGES.delivery）
- `src/app/api/invoices/pdf/route.ts`: 同じく `checkArea("accounting")`

### 2-9. 全体検索・ダッシュボード
- main a457a4a の `global-search.ts` は納品書・請求書を検索しない。ダッシュボードにも納品・経理の数字は無い（どちらも現物で確かめ、あれば同じ作りで止める）

## 3. テスト（`src/lib/user-management.test.ts` に ⑩ を足す）
1. 空の設定で STAFF は delivery・accounting を見られない。PRODUCTION / ACCOUNTING / SALES / DESIGNER は5つとも見られる
2. `areas.delivery.STAFF = "view"` で STAFF が delivery を見られ、accounting・orders・cost・sales は見られないまま
3. `areas.accounting.SALES = "hidden"` で SALES だけ accounting が見られない
4. OWNER / ADMIN は5つとも hidden が書かれていても見られる。EXTERNAL・null は見られない
5. ⑧・⑨ が通る（visibleAreas の期待値は5つに増えるので更新してよい）

## 4. 確認（dev・localhost:3001）
★確認用ユーザーのパスワードは `<新しいパスワード>`（< と > を含む）。役割ごとにウィンドウを分ける。
一般スタッフ（dev-staff）で:
1. サイドバーの「取引」に「納品」が無く、「経理」の見出しごと無い
2. `/deliveries`・`/deliveries/new`・`/invoices`・`/payments`・`/closings` を直接開くとダッシュボードへ戻る
3. クライアントの詳細（納品書のあるクライアント）に「入金」のカードが無い。「取引条件」のカードは今まで通り（PR-4 で扱う）
生産管理（dev-production）で:
4. 納品・請求・入金・締めが今まで通り開ける。納品書の作成で「発注・サンプル・受注から引き当て」の3つのタブが出る。クライアントの詳細に「入金」のカードがある
管理者（dev-admin）で:
5. 「役割と権限」の「画面」の表が5行（発注・原価・見積・受注・納品・経理）で、一般スタッフが5つとも「隠す」。納品だけ一般スタッフを「見る」にして保存 → 一般スタッフで「納品」が出て、引き当てダイアログは「サンプル」のタブだけ（発注・受注のタブが無い）。「経理」は出ないまま → 「隠す」に戻す（★戻しは別の手順で）

## 5. 本番への影響
- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）
- 本番の User はオーナー1人（2026-10-04 時点）。見え方が変わる人はいない
- migration なし。本番の CompanySetting は書き換えない

## 6. 作業の約束
- ブランチ `feat/b243-pr3-delivery-accounting-visibility`（main `a457a4a` から）。PR 必須
- `npx tsc --noEmit`・触ったファイルの lint・`npx tsx src/lib/user-management.test.ts`・`npx next build`（dev サーバが止まっているときだけ。後で .next を消す）が通れば commit → push → PR open まで。マージは慎太郎さん
- "use server" のファイルから文字列の定数を export しない
- 新しいクエリは companyId と deletedAt: null を手書き（AGENTS.md）
- 本書を `docs/specs/b-243-pr3-implementation-brief-2026-10-04.md` として PR に同梱する

## 7. 本 PR で作らないもの
- マスターの取引条件（クライアント・仕入先・工場・外注先の支払条件・締日・支払日、クライアントのデポジット比率、外注先の料金体系、素材の単価）＝ PR-4
- 輸出書類（B-110・作るときに行を足す）・支払（B-212）
- 「見えるが編集できない」段階
- 「役割と権限」の表のはみ出し（B-257）。★5行に増えるので、スタッフ利用の開始前に別 PR で直す

END-OF-BRIEF-B243-PR3
