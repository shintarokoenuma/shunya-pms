# B-222（B-109 PR-2d）実装ブリーフ v1.0（2026-09-23）

- 種別: 実装ブリーフ
- 対象: B-222 — 入金の独立ページ `/payments` と nav「取引」の「入金」
- 上位文書: addendum v1.0 §1 D-38 ／ 実装ブリーフ v1.1 §4-5 ／ 仕様確認書 v1.0
- 前提の実測: 2026-09-23 21:34〜21:37 JST・main `de0c325`・open PR 0件・dev `hopper:12921`・すべて read-only
- ★schema 変更 **ゼロ**。migration **なし**。`CREATE TABLE "payments"` は `prisma/migrations/20260516075911_init/migration.sql` にあり適用済み（陽性対照: 同 migration に `CREATE TABLE "invoices"` もヒット）

---

## 1. スコープ

### やること

1. `/payments` 一覧（クライアント横断・フィルタ・下に合計・ページング）
2. nav「取引」の「請求」の下に「入金」
3. 入金ダイアログにクライアント選択を足す（`/payments` から記録できる）
4. クライアント詳細の「入金」の節を **直近5件＋「すべて見る →」** に縮める（D-38）
5. 上の 3・4 に伴う画面の文言の追従

### やらないこと

- **入金の訂正・取消（編集・削除）** → 別 B番号（§6）。D-44
- 発行済み後の入金の取りこぼしの警告 → **B-223**（D-39）
- 納品書の税表記を落とす → **B-224**（D-40）
- 「経理」グループへの nav 再編 → 支払（仕入・M-029）と締め（B-123）が入るときにまとめて（D-38 の理由3）
- 入金の詳細ページ `/payments/[id]` → 一覧に全項目が出るので作らない

---

## 2. 本ブリーフで決めたこと（★addendum v1.1 に転記する）

| D | 内容 | 根拠 |
|---|---|---|
| D-42 | `/payments` の**期間フィルタの既定は今月（1日〜末日）**。見出しの下に対象期間を必ず明示し、「全期間」で解除できる | 慎太郎さん 2026-09-23。経理の実作業は「今日入った分を上から順に入れる」＝当月が主戦場 |
| D-43 | 下の**合計は、絞り込み結果の全件合計**（表示中のページの合計ではない）。`prisma.payment.aggregate` で一覧とは別に集計する | 経理が見たいのは「この期間にいくら入ったか」。ページ合計は業務上の意味がない |
| D-44 | 入金の**訂正・取消は PR-2d のスコープ外**。別 B番号で起票し、次の PR で作る | 慎太郎さん 2026-09-23。★現状 UI / validator / action 本体のどこにも訂正手段が無いことを実測済み |

---

## 3. 実測した現状（行番号つき）

| ファイル | 行 | 現状 |
|---|---|---|
| `src/lib/billing/client-payments.ts` | 22-26 | `listClientPayments(companyId, clientId, opts)`。clientId が**必須**。where を 28-44行に直書き |
| 同上 | 12-20 | `ClientPaymentRow` に `counterpartId` / `counterpartName` が**無い** |
| 同上 | 66-68 | `sumPayments(rows)` は配列の合計。ページング後の合計には使えない |
| `src/lib/actions/payments.ts` | 76-80 | `listClientPayments(clientId)` が唯一の読み取り |
| 同上 | 84-180 | `createClientPayment`。採番・AuditLog・P2002 リトライまで実装済み |
| 同上 | 174-175 | `revalidatePath` は `/clients/{id}` と `/invoices` の2本 |
| 同上 | 25 | ★`Payment` は `TENANT_MODELS` に無いため `companyId` / `deletedAt` を必ず明示する |
| `src/lib/validators/payment.ts` | 26 | `clientId: z.string().min(1)` — **既に必須**。変更不要 |
| `src/app/(app)/clients/_components/payment-record-dialog.tsx` | 34 | `{ clientId }` を prop で受ける。選択 UI は無い |
| 同上 | 110 | 注記「入れるのはこの4つだけです。…」 |
| `src/app/(app)/clients/[id]/page.tsx` | 114 | `listClientPayments(id)` を**全件**表示 |
| 同上 | 519-539 | 「入金」の節（見出し・補足文・表） |
| `src/components/app-shell/nav-items.ts` | 1-29 | lucide の import。`Banknote` は**無い**。`Coins` は import 済み |
| 同上 | 取引グループ | 見積もり / 発注PO / 発注WO / 受注 / 納品 / 請求 |

### 手本にするファイル（`/invoices`・PR-2c で作ったもの）

| 手本 | 行数 | 何を写すか |
|---|---|---|
| `src/app/(app)/invoices/page.tsx` | 67 | server page の形・`searchParams`・`Promise.all`・`result.ok` のエラー表示 |
| `src/app/(app)/invoices/_components/invoices-search.tsx` | 69 | URL params を push する client component |
| `src/app/(app)/invoices/_components/invoices-table.tsx` | 102 | 表・金額の右寄せ・行リンク |
| `src/app/(app)/invoices/_components/invoices-pagination.tsx` | 51 | ページング |
| `src/app/(app)/invoices/_components/labels.ts` | — | `PAYMENT_METHOD_OPTIONS`（ダイアログが既に import 済み） |

★**この5本を実装前に必ず開いて読む。** 本ブリーフの記述は要約であり、現物が正。

---

## 4. 変更点

### 4-1 読み取り層 `src/lib/billing/client-payments.ts`

**① where の抽出（★これが本 PR で最も重要）**

28-44行の where を関数に括り出す。

    type PaymentFilter = {
      clientId?: string
      window?: { start?: string; end?: string }
    }
    function paymentWhere(companyId: string, f: PaymentFilter): Prisma.PaymentWhereInput

条件の中身は現行と同じ（`INCOMING` / `CounterpartType.CLIENT` / `deletedAt: null` / `status: { notIn: [CANCELLED, FAILED] }`、`clientId` があれば `counterpartId`、`window` があれば `actualPaymentDate` の範囲）。`window.start` / `window.end` は**片方だけでも効く**ようにする（`gte` / `lte` を個別に組む）。

★**この集計条件は D-25 の決まりそのもの。2か所に書かない。** `/payments` 用にコピーすると、片方だけ直ったときに請求書の「御入金額」と一覧の合計がズレる。既存の `listClientPayments` も `paymentWhere` を使う形に書き換える。

**② 行の型を広げる**

`ClientPaymentRow` に `counterpartId: string` / `counterpartName: string` を足し、`select` にも足す。既存の消費側（クライアント詳細・請求書の御入金の節）は無視するだけなので安全。

**③ ページング用の関数を足す**

    export async function listPaymentsPaged(
      companyId: string,
      f: PaymentFilter,
      page: { page: number; pageSize: number },
    ): Promise<{ rows: ClientPaymentRow[]; count: number; total: number }>

- `rows`: `findMany` に `skip` / `take`。`orderBy` は既存と同じ `[{ actualPaymentDate: "desc" }, { paymentNumber: "desc" }]`
- `count`: `prisma.payment.count({ where })`
- `total`: `prisma.payment.aggregate({ where, _sum: { amount: true } })`（D-43）
- ★`_sum.amount` は **0件のとき null**。`?.toNumber() ?? 0` で受ける
- 3本は `Promise.all` で並列に投げる。**3本とも同じ `paymentWhere` の結果を使う**

### 4-2 action 層 `src/lib/actions/payments.ts`

- 新規 `listPayments(params: { clientId?: string; start?: string; end?: string; page?: number })` を export。`requireSession()` → `listPaymentsPaged`。`pageSize` は **20**（`/invoices` と同じ）
- ★クライアント選択の一覧は**新設しない**。`listActiveClientsForInvoiceSelect`（`@/lib/actions/invoices`）が既にあり、`invoices/page.tsx:7` で使われている。これを import して使う
- 174-175行の `revalidatePath` に **`revalidatePath("/payments")` を足す**

### 4-3 validator `src/lib/validators/payment.ts`

**変更なし。** `clientId` は 26行で既に `min(1)` の必須。クライアント選択は UI が値を供給するだけ。★「入れるのは4つだけ」はフォームの見た目の話で、validator は最初から5項目。

### 4-4 画面

**新規 `src/app/(app)/payments/page.tsx`**（手本: `invoices/page.tsx`）

`searchParams` は `{ clientId?, start?, end?, period?, page? }`。期間の決め方は次の順（D-42）:

1. `start` か `end` が1つでもあれば → その範囲
2. どちらも無く `period === "all"` → 期間なし（全期間）
3. どちらも無く `period` も無い → **今月の1日〜末日**

★見出しの下に**必ず対象期間を文で出す**。「2026-09-01 〜 2026-09-30 の入金」。出さないと「先月の入金が無い」と誤読される。全期間のときは「すべての期間の入金」。

**新規 `_components/payments-search.tsx`**（手本: `invoices-search.tsx`）

- クライアントの select（「すべてのクライアント」を含む）
- 開始日 / 終了日 の date input
- ボタン「今月」（`period` と `start`/`end` を落とす）／「全期間」（`period=all`）
- URL params を push する形は手本そのまま

**新規 `_components/payments-table.tsx`**（手本: `invoices-table.tsx`）

- 列はこの順・この見出し: `入金番号` / `入金日` / `クライアント` / `方法` / `摘要` / `金額`
- 金額は右寄せ・3桁区切り
- クライアント名は **`counterpartName` をそのまま出す**。★`counterpartId` で `clients` を join しない（改名すると過去の入金の表示まで変わる）
- クライアント名のリンク先は `/clients/{counterpartId}`
- 空の状態の文言: `この期間の入金の記録はありません。`

**ページング**

`invoices-pagination.tsx` の props が汎用（現在の page・総ページ数・base path を受ける）なら**再利用**。`/invoices` が決め打ちなら `_components/payments-pagination.tsx` に複製する。★決め打ちのまま流用しない。

**合計**

表の下に `合計　¥ {total.toLocaleString()}`。★見出しの期間表示と対で読ませる。

★**表を含むグリッド列には `min-w-0` を付ける。** 無いと表の最小幅がページ全体を横に伸ばす（2026-09-23 に PR-2c で発生・`876a89c` で解消）。

### 4-5 nav `src/components/app-shell/nav-items.ts`

- import に **`Banknote`** を足す（1-29行のアルファベット順で `Building2` の前）。★`Coins` が既に import されているが、**他の nav 項目で使われていないかを確認せずに流用しない**。使われていれば同じアイコンが2つ並ぶ
- 取引グループの「請求」の**次**に1行:

      { label: "入金", href: "/payments", icon: Banknote, enabled: true },

- ★取引グループに残っている「請求（INV）は B-109 で別項目として追加する」系のコメントは、**PR-2c で役目を終えている**。入金を足した事実に合わせて整理する（後続を語る文は、その後続を実装した PR が消す）

### 4-6 文言（★既存画面の変更・2026-09-22 の教訓）

| ファイル:行 | 現在 | 変更後 |
|---|---|---|
| `payment-record-dialog.tsx`:110 | `入れるのはこの4つだけです。内部では予定日＝入金日、状態＝着金確認済みで保存します（実績の記録なので予定と実績が同じ）。請求書への紐付けはしません。` | **クライアント固定のとき**（クライアント詳細から）は現行のまま。**クライアント選択があるとき**（`/payments` から）は冒頭を `入れるのはこの5つだけです。` に差し替え、以降は同文 |
| `clients/[id]/page.tsx`:527 | `入金はクライアントごとに記録します。次の合計請求書の「御入金額」と「繰越金額」に自動で入ります。` | 末尾に1文を足す → `ここには直近5件を出します。すべての入金は「入金」の画面で見られます。` |
| `clients/[id]/page.tsx`:531 | `入金の記録はまだありません。` | 変更なし |

### 4-7 ダイアログ `payment-record-dialog.tsx`

props をどちらか一方にする。

    type Props =
      | { clientId: string; clients?: never }
      | { clientId?: never; clients: { id: string; companyName: string }[] }

- `clients` モードでは **クライアントの select を最初の項目**として出し、未選択なら「記録する」を disabled にする
- ★記録に成功したあと、**選んだクライアントは初期化しない**（同じ取引先の入金を続けて入れることがある）。金額と摘要だけ空にする — 52-53行の現行挙動と同じ
- `router.refresh()`（54行）は両モードで共通

### 4-8 クライアント詳細 `clients/[id]/page.tsx`

- 114行の結果を **`.slice(0, 5)`** する。★`listClientPayments` の action 側で 5 に絞らない（請求書の御入金の節など他の消費者に影響する）
- 「入金」のヘッダ（522-523行）に `すべて見る →` のリンクを足す。リンク先は:

      /payments?clientId={id}&period=all

  ★**`period=all` を必ず付ける。** 付けないと飛んだ先で今月に絞られ、先月以前の入金が「無い」ように見える

---

## 5. やってはいけないこと

- ★集計条件（`INCOMING` / `CLIENT` / `deletedAt` / `status notIn`）を `/payments` 用にコピーして2か所に書く → `paymentWhere` 1か所に置く
- ★`counterpartId` で `clients` を join してクライアント名を出す → `counterpartName` のスナップショットを使う
- ★合計を「表示中のページの行の合計」で出す（D-43 違反）
- ★`prisma.payment` のクエリで `companyId` / `deletedAt` を省く（`Payment` は `TENANT_MODELS` に無い・`actions/payments.ts:25`）
- ★`clientPaymentCreateSchema` を「5項目にする」ために書き換える → 既に5項目
- ★`prisma/schema.prisma` や `prisma/migrations/` に触る → 本 PR の schema 変更はゼロ
- ★`listActiveClientsForInvoiceSelect` と同じものを payments 側に新設する
- ★`git add -A` / `git add .` を使う

---

## 6. 起票（★BACKLOG を grep してから番号を振る）

**入金の訂正・取消（D-44）。** 現状、金額・入金日・方法・摘要を打ち間違えた入金を直す手段が UI / validator / action 本体のどこにも無い（2026-09-23 実測）。

- 起票の前に `grep -n "入金" docs/BACKLOG.md` を実行し、既存の B番号が受けられないかを先に見る
- 受けられる番号が無ければ、BACKLOG の最大番号 +1 で新規起票する
- 実装案（参考）: 一覧に「取消」を足し、`status` を `CANCELLED` にする論理取消。★既存の集計条件が `CANCELLED` を除外済みなので、集計は自動で正しくなる。AuditLog に残す
- ライフサイクル: **12. 請求**

---

## 7. dev での確認の前に（★素材が足りない）

dev（`hopper:12921`）の payments は **1件だけ**（`PAY-2026-0001` 3,080・葵アパレル・2026-09）。この1件ではクライアント横断も期間フィルタも確認できない。

確認の前に dev で次を足す（画面から記録する。SQL 直書きはしない）:

1. **なんば商店**に1件（今月の日付）→ クライアント絞り込みの確認
2. **葵アパレル**に1件、**先月**の日付 → 期間フィルタと「今月／全期間」の切り替えの確認
3. 合計が 2〜3件分の和になること（D-43）

★本番（`shuttle:16099`）の payments は 0件。確認は dev のみで行う。

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-09-23 | v1.0 | 初版。D-38 の実装方針を4層（読み取り / action / 画面 / 文言）で確定。D-42（期間の既定は今月）・D-43（合計は絞り込み結果の全件）・D-44（訂正手段は別 B番号）を追加。schema 変更ゼロを migration の現物で裏取り |

END-OF-BRIEF-B222-V1_0
