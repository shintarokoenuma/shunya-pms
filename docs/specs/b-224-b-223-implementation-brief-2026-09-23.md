# B-224 / B-223 実装ブリーフ v1.0（2026-09-23）

- 種別: 実装ブリーフ（PR 2本）
- 対象: **B-224** 納品書の税表記を落とす（D-40）／**B-223** 入金の取りこぼしに警告（D-39）
- 上位文書: `b-109-b-114-b-123-billing-spec-addendum-v1_0-2026-09-23.md` §1 D-39・D-40
- 前提の実測: 2026-09-23 23:20〜23:22 JST・main `c23bd92`・open PR 0件・すべて read-only
- ★**両方とも schema 変更ゼロ・migration なし。** B-224 は既存の nullable 列に null を入れるだけ、B-223 は列を足さない（D-39 の明文）
- ★**PR は2本に分ける。** 領域が違い（11.納品 / 12.請求）、`open PR の上に次の PR を積まない` の鉄則がある。**B-224 → マージ → B-223** の順

---

# 第1部　B-224: 納品書の税表記を落とす（D-40）

## 1-1. 実測した現状

| ファイル | 行 | 現状 |
|---|---|---|
| `prisma/schema.prisma` model DeliveryNote | 38-40 | `subtotalAmount` / `taxAmount` / `totalAmount` は**3列とも `Decimal?`（nullable）** |
| `src/lib/actions/delivery-notes.ts` | 570-585 | `showAmounts` のとき `tax = Math.round(sub × taxRatePercent / 100)` / `totalAmount = 小計 + tax` |
| 同上 | 718-720 / 844-846 | create / update がそのまま保存 |
| `src/lib/validators/delivery-note.ts` | 114-118 | `taxRatePercent`（既定 10） |
| `src/app/(app)/deliveries/_components/delivery-note-form.tsx` | 63 / 144-146 / 211 | 型・state・payload |
| 同上 | 394 | チェックボックス「金額を表示する（単価・小計・**消費税・合計**）」 |
| 同上 | 398-404 | 「消費税率(%)」の Input |
| `src/app/(app)/deliveries/[id]/page.tsx` | 194-208 | 小計 / **消費税** / **合計** の3行 |
| `src/app/(app)/deliveries/[id]/edit/page.tsx` | 53-54 / 61 | コメント「v1 は 10% 固定」と `taxRatePercent: "10"` |
| `src/lib/pdf/` | — | **納品書 PDF は存在しない**（発注書・見積書・量産見積・縫製仕様書の4種のみ） |

★**納品書の税の列を読んでいる他の画面・action は無い。** deliveries 以外の `taxAmount` ヒット3件（work-orders.ts:852 / sales-orders.ts:31 / purchase-orders.ts:646）は**それぞれ自モデルの列**で、DeliveryNote とは無関係（陽性対照: `deliveries/[id]/page.tsx` の `taxAmount` = 1件）。

★dev の納品書8枚は**すべて `show_amounts = true` で税額が入っている**（例: DLV-2026-0008 = 2,805 → 281 → 3,086）。

## 1-2. 本ブリーフで決めたこと

| D | 内容 | 根拠 |
|---|---|---|
| D-45 | **税の計算ごとやめる。** `taxAmount` / `totalAmount` は保存しない（null のまま）。`subtotalAmount` は残す | 3列とも nullable なので可能（addendum v1.0 D-40 の分岐の前者）。値が残っていると、将来「納品書の税額の合計」と「請求書の税額」を突き合わせて D-40 が防ごうとした混乱が再発する |
| D-46 | **既存行の `tax_amount` / `total_amount` は消さない**（DB の UPDATE をしない） | 表示側が出さないので見えない。データ移行は不可逆なので、やるなら別途の明示的な判断。新規は null・旧は値あり の混在になるが実害ゼロ |
| D-47 | **「消費税率(%)」の入力欄と `taxRatePercent` を4層すべてから外す** | 税を計算しないなら入力は無意味。addendum v1.0 の「誰も見ない値を入れ続けるのは不自然なので外す方向」に従う |
| D-48 | **納品書 PDF は本 PR の対象外。** 実装が存在しないため。PR-4（納品書 PDF）で税を載せないことは addendum v1.0 の「★納品書 PDF（PR-4）にも同じ判断が効く」で担保済み | 2026-09-23 実測 |

## 1-3. 変更点（4層＋文言）

### ① action `src/lib/actions/delivery-notes.ts`

570-585行を次のようにする。

    let subtotalAmount: Prisma.Decimal | null = null
    if (data.showAmounts) {
      if (data.items.some((it) => it.unitPrice == null)) {
        warnings.push("単価未入力の明細があります（金額表示ONのまま保存しました）")
      }
      const sub = data.items.reduce(
        (a, it) => a + (it.unitPrice != null ? it.quantity * it.unitPrice : 0),
        0,
      )
      subtotalAmount = new Prisma.Decimal(Math.round(sub))
    }

- `taxAmount` / `totalAmount` の宣言と代入を消す
- `prepared` に渡すのは `subtotalAmount` のみ。★**`taxAmount: null` / `totalAmount: null` を明示的に渡す**（update のときに古い値が残らないように）
- 718-720 / 844-846 の create / update も同じ3つを渡す形のままでよい（`prepared` 経由なら自動で null になる）。★**渡していなければ update で旧値が残る**ので、現物を読んで確かめる
- `data.taxRatePercent` の参照を消す

### ② validator `src/lib/validators/delivery-note.ts`

114-118行の `taxRatePercent` を**削除**する。★「§6: 消費税は v1 は 10% 固定＋手入力上書き可」のコメントも一緒に消す（古くなる文はその変更を入れた PR が消す）。

### ③ フォーム `delivery-note-form.tsx`

- 63行 `taxRatePercent: string` を型から削除
- 144-146行 の state を削除
- 211行 の payload から削除
- **396-405行の「消費税率(%)」のブロックごと削除**（`showAmounts &&` の条件分岐も不要になる）
- ★394行の文言: `金額を表示する（単価・小計・消費税・合計）` → **`金額を表示する（単価・小計）`**

### ④ 詳細 `deliveries/[id]/page.tsx`

194-208行の集計ブロックから「消費税」と「合計」の2行を削除し、**小計だけ**にする。

    {dn.showAmounts && (
      <div className="mt-3 flex flex-col items-end gap-1 text-sm">
        <div>
          <span className="text-muted-foreground mr-3">小計</span>
          {fmtYen(dn.subtotalAmount)}
        </div>
      </div>
    )}

★144行・178行の `showAmounts` 分岐（明細の単価・金額の列）は**変えない**。消すのは集計の2行だけ。

★小計の下に1行足す: `消費税は合計請求書でまとめて計算します。` — 税が無いことが意図的だと分かるようにする。

### ⑤ 編集 `deliveries/[id]/edit/page.tsx`

- 61行 `taxRatePercent: "10",` を削除
- 53-54行のコメント（`消費税率はヘッダに列が無い…v1 は 10% 固定なので…`）を**削除**する。税率そのものが無くなるので、この説明は嘘になる

## 1-4. やってはいけないこと（B-224）

- ★既存行の `tax_amount` / `total_amount` を UPDATE や DELETE で消す（D-46）
- ★`subtotalAmount` まで一緒に落とす（小計は残す）
- ★`showAmounts` の仕組みごと消す（明細の単価・金額の表示に必要）
- ★明細の単価・金額の列（144行・178行）に手を入れる
- ★`prisma/` に触る（schema 変更ゼロ）
- ★納品書 PDF を新規に作る（存在しない・PR-4 のスコープ）

## 1-5. ★マージ前に本番の件数を測る

本 PR は**本番の納品書の画面から消費税・合計の行を消す**。マージ前に、本番に金額表示ありの納品書が何枚あるかを read-only で測り、慎太郎さんに件数を伝える（驚かないため）。

    select count(*) filter (where show_amounts) as 金額表示あり,
           count(*) filter (where tax_amount is not null) as 税額あり,
           count(*) as 全件
      from delivery_notes where deleted_at is null;

★接続先は `DATABASE_PUBLIC_URL`。host が `shuttle` であることを `sed -E 's#^.*@##'` で確認してから（`tail -c` の桁数を増やさない）。

---

# 第2部　B-223: 入金の取りこぼしに警告（D-39）

## 2-1. 実測した現状

| ファイル | 行 | 現状 |
|---|---|---|
| `src/lib/actions/invoices.ts` | 192-330 | `loadCandidateContext(q)` が候補・直前の請求書・入金の窓・御入金額をまとめて計算している |
| 同上 | 301-306 | 窓 = 直前の請求書の `periodEndDate` の翌日 〜 今回の `periodEnd`（直前が無ければ `periodStart` から） |
| 同上 | 176-189 | `InvoiceCandidatesResult` の型（ここに足す） |
| 同上 | 348 / 373 | `getInvoiceCandidates` と `createInvoice` の**両方が同じ `loadCandidateContext` を通る** |
| `prisma/schema.prisma` | Invoice 147 / Payment 82 | `createdAt` は両方にある。★**列は足さない**（D-39 の明文） |
| `invoice-form.tsx` | 386-398 | 右カラムの「御入金額は◯〜◯に記録された入金の合計です」の注記（この直後が警告の置き場所） |
| `src/components/ui/alert.tsx` | — | `variant` は `default` と `destructive` の2つだけ。**amber 系は無い** |
| `products/_components/rough-estimate-section.tsx` | 1188-1191 | ★既存の「止めない警告」の手本: `bg-amber-100 text-amber-800` の直書き＋`AlertTriangle` |

## 2-2. 本ブリーフで決めたこと

| D | 内容 | 根拠 |
|---|---|---|
| D-49 | **警告を出すだけ。** その入金を今回の御入金額に含める仕組みは作らない | D-39 の文面が警告のみ。含める仕組みは D-35（発行済みは再計算しない）と衝突した複雑さを持ち込む |
| D-50 | **（v1.1 で訂正）** 検知の定義: そのクライアントの入金（D-25 の集計条件）のうち、**入金日が今回の窓の始まりより前**で、**その入金日を窓に含む取消されていない請求書 I が存在し**、かつ **`I.createdAt < payment.createdAt`**（その請求書より後に記録された）もの。★**窓に入る請求書が1枚も無い入金は対象外** | D-39 の原文は「**発行済みの請求書より後に**、その請求書の期間内の日付で記録された入金」。請求書が無い期間の入金は D-39 の対象ではなく、初回の「前回御請求額」で人が扱う領分。★v1.0 は「請求書が無い」も未計上に含めていたが、それだと**初回の請求書を作るたびに過去の入金が全部警告に並ぶ**（2026-09-23 に dev の実データで発覚。葵アパレルは INV-2026-0001 が CANCELLED のため取消されていない請求書が0枚で、この形に該当した） |
| D-50a | **（v1.2 で追加）** 「取消されていない請求書」には **`DRAFT` も含む**。`SENT` だけに絞らない | 請求書の金額は作成時のスナップショットで保存され、**`DRAFT` でも再計算されない**（PR-2c の実装）。さらにドラフトの編集画面は作らない方針（D-31 相当）なので、`DRAFT` でも取りこぼしは同じ形で起きる |
| D-51 | 見た目は **amber の直書き**（`bg-amber-100 text-amber-800` ＋ `AlertTriangle`）。`ui/alert.tsx` の `Alert` は使わない | 既存の「止めない警告」がこの形で揃っている。`Alert` には amber の variant が無く、`destructive` は止めるエラーの色 |
| D-52 | **保存は止めない。** ただし `createInvoice` の AuditLog の `afterData` に `uncoveredPaymentCount` を1つ足す | 「気づいていたのに作った」を後から辿れるようにする。`loadCandidateContext` を両方が通るので追加の読み取りは要らない |

## 2-3. 変更点

### ① サーバ `src/lib/actions/invoices.ts`

`loadCandidateContext`（301-306行で窓を作った直後）に、未計上の入金を拾う処理を足す。

手順:

1. そのクライアントの入金を**全期間**で取る（`listClientPayments(companyId, client.id)` — 窓なし）
2. **（v1.2 で訂正）** そのクライアントの取消されていない請求書を `periodEndDate` 昇順で取り、各請求書の窓 `[前の periodEndDate + 1日, 自分の periodEndDate]` と `createdAt` を作る。★**最初の1枚の窓の始まりは、その請求書に保存された `periodStartDate`（D-41）**。v1.0/v1.1 の「`-infinity` 相当」は**誤り**で、それだと最初の請求書より前の期間の入金が全部その請求書の窓に入り、v1.1 の D-50 訂正（請求書が無い期間の入金は対象外）と矛盾する。作成時に実際に集計した窓と同じ始まりを使う（2026-09-24 に純関数テストの「7月の入金は対象外」で検出）
3. 各入金 P について:
   - `P.paymentDate >= paymentWindow.start` なら**今回計上される**ので除外
   - `P.paymentDate` を窓に含む**取消されていない**請求書 I を探す
   - I が無い → **対象外**（まだ請求していない期間の入金・D-50 の訂正）
   - I があり `I.createdAt < P.createdAt` → **未計上**（その請求書より後に記録された）
   - I があり `I.createdAt >= P.createdAt` → 計上済み
4. 未計上のものを `uncoveredPayments` として返す

`InvoiceCandidatesResult`（176-189行）に足す型:

    uncoveredPayments: {
      id: string
      paymentNumber: string
      paymentDate: string
      amount: number
    }[]

★`listClientPayments` は `src/lib/billing/client-payments.ts` の `paymentWhere` を通るので、集計条件（INCOMING / CLIENT / deletedAt / status notIn）は自動で揃う。**条件を書き直さない。**

### ② 画面 `invoice-form.tsx`

386-398行の「御入金額は◯〜◯に…」の注記の**直後**に足す。

    {ctx && ctx.uncoveredPayments.length > 0 && (
      <div className="flex items-start gap-2 rounded bg-amber-100 p-2 text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1 text-xs">
          <p className="font-medium">
            この期間より前の日付で、まだどの請求書にも載っていない入金があります
          </p>
          <ul className="space-y-0.5 tabular-nums">
            {ctx.uncoveredPayments.map((p) => (
              <li key={p.id}>
                {p.paymentNumber}　{fmtYmd(p.paymentDate)}　{fmtYen(p.amount)}
              </li>
            ))}
          </ul>
          <p>
            発行済みの請求書は再計算しません。その請求書を取消して再発行するか、次回の請求で調整してください。
          </p>
        </div>
      </div>
    )}

- 見出しの文言は **D-39 の指定どおり**（1文字も変えない）
- `AlertTriangle` は `lucide-react` から import（このファイルに未 import なら足す）
- ★**保存ボタンを disabled にしない。** 止めない警告

### ③ AuditLog `createInvoice`

`afterData` に `uncoveredPaymentCount: ctx.uncoveredPayments.length` を1つ足す（D-52）。

## 2-4. やってはいけないこと（B-223）

- ★列を足す（D-39 の明文「列は足さない」）
- ★集計条件を `invoices.ts` にコピーして書く（`paymentWhere` を通す）
- ★警告で保存を止める・ボタンを disabled にする
- ★`ui/alert.tsx` の `Alert` を `destructive` で使う（止めるエラーの色になる）
- ★見出しの文言を言い換える（D-39 の指定）
- ★発行済みの請求書を再計算する（D-35 違反）

## 2-5. dev での確認（★素材を作るところから）

**dev の現状**（2026-09-23 23:28 実測）: 葵アパレルの `INV-2026-0001` は **CANCELLED**。取消されていない請求書は `INV-2026-0002`（なんば商店・DRAFT）だけ。入金は `PAY-0001`（葵・9/30・3,080）／`PAY-0002`（なんば・9/30・10,000）／`PAY-0003`（葵・8/31・5,000）。

★**この状態では D-50（訂正後）の警告は出ない**（葵に取消されていない請求書が0枚のため）。確認には素材を1組作る。

1. `/invoices/new` で 葵アパレル・**2026-08-01 〜 2026-08-31** の請求書を作る（候補が0件でも保存できる。`PAY-0003` が御入金額に入る）
2. **その後に** `/payments` から 葵アパレルに **2026-08-15・1,000** の入金を記録する（★1 の請求書より後に作る＝D-39 そのものの形）
3. `/invoices/new` で 葵アパレル・**2026-09-01 〜 2026-09-30** を開く
4. 右カラムに警告が出て、**2 で入れた 8/15 の入金だけ**が並ぶ（`PAY-0003` は 1 の請求書に計上済みなので出ない・`PAY-0001` は 9/30 で今回の窓に入るので出ない）

★**陰性対照**: なんば商店・2026-10-01 〜 10-31 を開くと、`PAY-0002`（9/30）は `INV-0002`（9/01〜9/30・DRAFT）の窓に入り、その請求書より先に記録されている（13:39 < DRAFT 作成 05:14 ではないので要実測）ため、判定がどちらに出るかを確かめる。**期待値を先に決めてから開く。**

★確認の前に、dev の請求書と入金の現状を read-only で測り直す。

---

## 3. PR の分け方

| PR | 内容 | ステップ | schema | 本番影響 |
|---|---|---|---|---|
| PR-1 | **B-224**（第1部） | 11. 納品 | なし | 納品書の画面から消費税・合計が消える。★マージ前に本番の件数を測る（§1-5） |
| PR-2 | **B-223**（第2部） | 12. 請求 | なし | 請求書の作成画面に警告が増える。既存データは変わらない |

★**PR-1 をマージしてから PR-2 の枝を切る**（open PR の上に積まない）。

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-09-23 | v1.0 | 初版。D-45〜D-48（B-224: 計算ごとやめる・既存行は触らない・税率欄を外す・PDF は対象外）と D-49〜D-52（B-223: 警告のみ・検知の定義・amber の直書き・AuditLog に件数）を確定。両方とも schema 変更ゼロであることを実測で裏取り |

| 2026-09-23 | v1.1 | ★D-50 を訂正。「窓に入る請求書が1枚も無い入金」を未計上から外した（v1.0 のままだと初回の請求書で過去の入金が全部警告に並ぶ）。§2-3 の判定手順と §2-5 の dev 確認手順を dev の現物（INV-2026-0001 が CANCELLED）に合わせて書き直した |

| 2026-09-24 | v1.2 | ★§2-3 手順2 の「最初の1枚の窓の始まりは -infinity 相当」を訂正し、`periodStartDate`（D-41）に改めた。v1.1 の D-50 訂正と矛盾していた（実装時の純関数テストで検出）。D-50a（取消されていない請求書には DRAFT も含む）を追加 |

END-OF-BRIEF-B224-B223-V1_0
