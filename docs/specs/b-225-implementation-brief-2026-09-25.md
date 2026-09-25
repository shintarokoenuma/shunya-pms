# B-225 実装ブリーフ（入金の取消：打ち間違えた入金は取消して入れ直す）

- 日付: 2026-09-25
- 対象: B-225 入金の訂正・取消（起票元 b-222-pr2d-implementation-brief-2026-09-23.md §6・D-44）
- ライフサイクル: 12. 請求
- schema / migration の変更: なし（`PaymentStatus.CANCELLED` と AuditLog は既存）
- 本番への影響: マージで本番反映。本番の payments は前回時点で 0件

## §0 一次資料

- 慎太郎さんの判断（2026-09-25）: 直し方は「取消＋再入力」。編集は作らない
- 経理の原則: B-123 設計ノート §1-3（確定した伝票は書き換えず、取消して正しい伝票を立て直す）。請求書の取消・再発行（`replacesInvoiceId`）と同じ形
- read-only の実測（2026-09-25 16:43 JST・main c645053）
  - `src/lib/actions/payments.ts`（233行）は `listClientPayments`（:77）・`listPayments`（:94）・`createClientPayment`（:136・status は CONFIRMED で作る :180）の3本だけ。更新・取消・削除は無い
  - 集計条件は `src/lib/billing/client-payments.ts:42` の `paymentWhere` の1か所（INCOMING・CLIENT・deletedAt null・`status notIn [CANCELLED, FAILED]` :51）。請求書の御入金額（`invoices.ts:304-309`）・B-223 の未計上判定（:313-330 `findUncoveredPayments`）・請求書詳細の御入金（:834）はすべてこれを通る
  - 採番は deletedAt で絞らない（`payments.ts:62`）＝取消した番号は再利用されない
  - `Invoice.paymentReceivedAmount`（御入金額）は作成時のスナップショット。発行済みは再計算しない（D-35）。`paidAmount` / `isFullyPaid` / `InvoicePayment` は未使用
  - 手本: 請求書の状態変更 `updateInvoiceStatus`（`invoices.ts:879`・金額は再計算しない・AuditLog）
  - 画面: `/payments`（page.tsx＋`_components/` payments-search / payments-table / payments-pagination）、クライアント詳細の「入金」の節（`clients/[id]/page.tsx:520-`・直近5件）。取消・訂正のボタンや文言は 0件

## §1 確定事項

- **D-1** 打ち間違えた入金は **取消して、正しい内容を新しい番号で入れ直す**。編集は作らない（慎太郎さん 2026-09-25）。取消した入金は消さずに「取消済み」として残る
- **D-2** 新しい action `cancelClientPayment({ id, reason })`（`payments.ts`）
  - 対象は `companyId` 一致・`deletedAt` null・`paymentDirection=INCOMING`・`counterpartType=CLIENT`
  - `status` が `CONFIRMED` のものだけ取消できる。それ以外（取消済みなど）はエラー「この入金は取消できません（状態: …）」。★UI で隠すだけでなくサーバで判定する
  - `status` を `CANCELLED` にする。金額・日付・番号は書き換えない。`deletedAt` は使わない（論理削除ではなく状態の変更）
  - 取消の理由は **必須**（1〜200文字）。AuditLog の afterData に理由・入金番号・金額・入金日を残す。書き方は `updateInvoiceStatus` の AuditLog と同じ形にする（新しい書き方を作らない）
  - validator は `src/lib/validators/payment.ts` に `clientPaymentCancelSchema` を足す
- **D-3** 取消の前に **影響する請求書を表示する**（止めない警告）
  - 取消されていない請求書のうち、御入金額にこの入金が入っているもの。判定は B-223 と同じ窓（`[前の請求書の periodEndDate+1日, 自分の periodEndDate]`、最初の1枚は自分の `periodStartDate`）に入金日が入り、かつ `請求書.createdAt >= 入金.createdAt`
  - ★窓の作り方を書き直さない。`findUncoveredPayments` と同じファイルに、同じ窓の部品を使う純関数（例 `findInvoicesCoveringPayment`）を足す
  - 表示する文: 「この入金は {請求書番号} の御入金額に入っています。取消しても {請求書番号} の金額は変わりません。直すには請求書を取消して再発行してください。」
  - 読み取り用の action（例 `getPaymentCancelImpact(id)`）で取り、取消のダイアログに出す
- **D-4** 画面は `/payments` の一覧だけに足す
  - 行の右端に「取消」ボタン（CONFIRMED の行だけ）。押すとダイアログ: 入金番号・クライアント・入金日・金額／D-3 の警告（あれば）／理由の入力欄（必須）／「取消する」（destructive）と「やめる」
  - 成功したら `router.refresh()` し、「取消しました。正しい内容は「入金を記録」から入れ直してください。」を出す
- **D-5** 取消済みの入金を見る手段: `/payments` の絞り込みに **状態（有効／取消済み）** を足す。既定は「有効」
  - `paymentWhere` の `PaymentFilter` に `status?: "active" | "cancelled"` を足す。既定（未指定）は今と同じ `notIn [CANCELLED, FAILED]`。`"cancelled"` のときは `status = CANCELLED`
  - ★請求書側の呼び出しは何も渡さないので、集計の結果は変わらない
  - ★一覧の行・件数・合計は同じ `paymentWhere` から出す（D-43 のまま）。「取消済み」を選んだときの合計の見出しは「取消済みの合計」にする
  - 取消済みの行には「取消済み」のバッジを出し、取消ボタンは出さない
- **D-6** 文言: `/payments` の見出しの下の説明文に1文足す「打ち間違えた入金は「取消」して、正しい内容を入れ直します。」（説明文の現物を grep してから足す）。クライアント詳細の節（:537）は変えない（取消した入金は直近5件から自然に消える）
- **D-7** 今回やらないこと（新しい B番号は振らない）
  - 入金の編集（D-1 で作らないと決めた）
  - 取消の取り消し（誤って取消したら入れ直す）
  - クライアント詳細の「入金」の節からの取消（`/payments` に一本化）
  - 出金（OUTGOING）・`relatedInvoiceIds` / `InvoicePayment`（B-213）
  - 取消に合わせて請求書を自動で取消・再計算すること（D-35）

## §2 変更するファイル（予定）

| ファイル | 変更 |
|---|---|
| `src/lib/validators/payment.ts` | `clientPaymentCancelSchema`（D-2） |
| `src/lib/actions/payments.ts` | `cancelClientPayment`・`getPaymentCancelImpact`（D-2・D-3）。一覧の取得に状態の絞り込みを通す（D-5） |
| `src/lib/billing/client-payments.ts` | `PaymentFilter.status`（D-5） |
| `findUncoveredPayments` のあるファイル | `findInvoicesCoveringPayment`（D-3） |
| `src/app/(app)/payments/page.tsx` ・ `_components/*` | 取消ボタンとダイアログ・状態の絞り込み・取消済みバッジ・合計の見出し・説明文（D-4〜D-6） |

## §3 やってはいけないこと

- ★`prisma/schema.prisma` と `prisma/migrations/` に触る（schema 変更はゼロ）
- ★集計条件を `paymentWhere` の外にコピーする
- ★入金の金額・日付を書き換える action を作る（D-1）
- ★`deletedAt` を入れて消す（取消済みとして残す）
- ★取消に合わせて請求書の金額を再計算する
- ★`prisma.payment` のクエリで `companyId` / `deletedAt` を省く（Payment は TENANT_MODELS に無い・`payments.ts:26`）
- ★`git add -A` / `git add .`

## §4 確認（dev・http://localhost:3001）

dev の入金（2026-09-25 実測）: PAY-0001 葵 9/30 3,080 ／ PAY-0002 なんば 9/30 10,000 ／ PAY-0003 葵 8/31 5,000（すべて CONFIRMED）。請求書は INV-0001 取消済み・INV-0002 なんば 9/1〜9/30 ドラフト。

1. `/payments`（全期間）: 3件・合計 18,080。各行に「取消」がある
2. **警告なしの取消**: PAY-0003 の「取消」→ 警告は出ない（葵に有効な請求書が無い）→ 理由を空で押すと止まる → 理由を入れて取消 → 一覧から消え、合計 13,080
3. 状態を「取消済み」にすると PAY-0003 だけが出る。「取消済み」のバッジ・取消ボタン無し・見出し「取消済みの合計」5,000
4. **警告ありの取消**: 先に INV-2026-0002 の詳細で御入金額に 10,000 が入っているかを見る。入っていれば、PAY-0002 の「取消」で「INV-2026-0002 の御入金額に入っています…」が出る（押さずに「やめる」でもよい）
5. 葵アパレルのクライアント詳細: 入金の節に PAY-0003 が出ない
6. 入れ直し: 「入金を記録」で 葵・8/31・5,000 を記録 → PAY-2026-0004 になる（0003 は再利用されない）
7. AuditLog に取消の行が1件ある（read-only の SQL で確かめる）

## §5 本番への影響

新しい操作（取消）が増える。schema は変わらない。本番の payments は前回時点で 0件。問題があれば revert で戻せる（取消済みにした入金の状態は revert では戻らない）。
