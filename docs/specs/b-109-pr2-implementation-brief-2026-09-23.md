# B-109 PR-2 実装ブリーフ v1.1（2026-09-23）

- 種別: 実装ブリーフ（Claude Code 向け）
- 対象: **B-109 PR-2 — 合計請求書（繰越型）＋クライアント単位の入金＋クライアントごとの消費税端数処理＋赤伝**
- 上位文書: 仕様確認書 v1.0（D-1〜D-21）／addendum v0.7（D-22〜D-28）
- ライフサイクル: **12. 請求・入金**／原マイルストーン **M5（納品・請求MVP）**
- live 実測: 2026-09-23 09:48 / 09:52 / 10:08 JST（Claude Code・read-only・main `eb373ec`・dev hopper:12921）
- ★本書で新たに確定した設計判断は §2（D-29〜D-35）。慎太郎さんの判断は 2026-09-23 の2問（請求書の状態＝繰越残高で色分け／非課税の行＝正しく分けて出す）
- ★本書の正本はプロジェクトナレッジ `claude/b-109-pr2-implementation-brief-2026-09-23.md`。本ファイルは同期先
- v1.1 の変更: 検証で抜けが1件見つかったため **D-35（端数処理を Invoice にスナップショットしない）** を追加（addendum v0.7 §2 の「実装ブリーフで決める」の取りこぼし）

---

## 0. 実測アンカー（今日の repo の現物。記憶ではない）

| # | 事実 | 出所 |
|---|---|---|
| A-1 | main = origin/main = `eb373ec`・未 commit なし・open PR 0件 | git |
| A-2 | dev への反映は **`db push`**。`migrate dev` は使わない（dev に `_prisma_migrations` が無く 54本すべて not applied と出る） | `prisma migrate status` |
| A-3 | 本番は `package.json:9` `"start": "prisma migrate deploy && next start"`＝Railway の main デプロイで自動適用 | package.json |
| A-4 | 最新 migration = `20260921000100_b054_factory_type_inspection`（`ALTER TYPE ... ADD VALUE` を単独ファイルに隔離した実例） | prisma/migrations |
| B-1 | Invoice に 前回御請求額／御入金額／繰越金額／再発行の元 の列は **無い** | schema |
| B-2 | Client に端数処理の列は **無い** | schema |
| B-3 | Payment は `counterpartType=CLIENT` で単体保存できる。`scheduledDate` は **NOT NULL**・`status` 既定 `SCHEDULED`・`paymentMethod` NOT NULL | schema |
| B-5 | 端数処理の受け皿になる enum・列は **0件**（陽性対照 `closingDay`=4件）。`TaxCalculationType` は `tax_calculation_logs` の**期間の種類**（6928行・帰属確認済み）で丸め方ではない | schema |
| C-1 | 数量のマイナスを止めているのは `src/lib/validators/delivery-note.ts` の `quantityIntField`（`Number.isInteger(v) && v > 0`）**1か所のみ**。`DeliveryNoteItem.quantity` は Int・CHECK 無し・フォームの `type="number"` に `min` 無し | validator / schema / form |
| C-2 | 納品書の税は `Math.round((sub * taxRatePercent) / 100)`。`taxRatePercent` は**フォームの欄**で列ではない。明細の小計は `Math.round(quantity × unitPrice)` | delivery-notes.ts |
| C-3 | DeliveryNote が持つ金額は `showAmounts`（既定 false）/ `subtotalAmount` / `taxAmount` / `totalAmount` のみ。税率の列は無い | schema |
| C-4 | 採番の手本 = `computeNextDeliveryNumber`（`startsWith` 前方一致・`desc`・`/-(\d+)$/`・`padStart(4)`・**`deletedAt` で絞らない**） | delivery-notes.ts:120-150 |
| C-5 | `clients.ts:24` が `{ ...data }` を作り create/update に渡す＝**validator に足せば列が通る**。AuditLog は 199 / 328 / 382 / 418 / 499 | clients.ts |
| C-5b | クライアントの validator / form に `isQualifiedInvoiceIssuer` と `taxId` は **無い**（仕入先・工場・外注先にはある） | grep 0件 |
| C-6 | BACKLOG に 繰越／端数／赤伝／丸め の独立行は **無い**（B-109・B-213・B-215・B-221 の4行のみ・陽性対照 B-109=4件）。★新規 B番号は振らない | BACKLOG.md |

---

## 1. スコープ

### やること

1. クライアントごとの消費税端数処理（D-23）— 新 enum ＋ Client に列1本 ＋ 4層
2. 合計請求書（月次・繰越型）（D-24）— Invoice に列4本 ＋ 採番 ＋ 候補 ＋ 二重請求の防止
3. 消費税は請求書1枚につき税率ごとに1回（D-22）— 共通の端数処理関数
4. クライアント単位の入金（D-25）— Payment を INCOMING・CLIENT で単体保存
5. 赤伝（D-26・D-28）— 納品書の validator 1か所
6. 請求書の状態（DRAFT / SENT / CANCELLED）と取消 → 再発行
7. クライアント画面に `isQualifiedInvoiceIssuer` と `taxId` を足す（v1.0 §2-9・未実装だった）

### やらないこと（次の PR）

- PR-3: 納品前の請求と前受金の差し引き（K-1 待ち）
- PR-4: 請求書 PDF・納品書 PDF
- PR-6: 締め（B-123）
- 委託の戻りの製品在庫計上（B-221）
- 1回の入金を複数の請求書に分ける消し込み（B-213・D-25 で v1 に生じない）

---

## 2. ★本書で確定した設計判断

### D-29 totalAmount の意味を「今回御請求額」にする

繰越型では、その請求書で請求する額は繰越込みの額になる。

- `subtotal` = 当月お買上げ額（税抜）
- `totalTaxAmount` = 消費税等
- `totalAmount` = **今回御請求額** = `carriedForwardAmount` + `subtotal` + `totalTaxAmount`

★現在の schema コメントは `totalAmount` を「税込合計」と書いている。**意味が変わるのでコメントも直す**。当月の税込計は `subtotal + totalTaxAmount` で導出する。

### D-30 請求書の状態は3値。入金状況の列は v1 で使わない

D-25（入金を請求書に充当しない）の帰結として、`paidAmount` / `remainingAmount` / `isFullyPaid` / `InvoicePayment` は埋まらない。

- 状態は **DRAFT / SENT / CANCELLED** の3値（enum は変更しない）
- `PARTIALLY_PAID` / `PAID` は v1 で出さない
- 一覧に **「繰越金額」の列**を出し、繰越が残っている行を色で分ける（慎太郎さん判断 2026-09-23）
- ★v1.0 §2-6 の「1回の入金を1枚の請求書に充当」と §2-9 の「未入金・一部入金・入金済みのフィルタ」は本 D で置き換わる

### D-31 端数処理は必ず絶対値に適用して符号を戻す

JS の `Math.round(-1.5)` は `-1`（正の無限大方向への half-up）で、「切り捨て」の直感と一致しない。赤伝で向きが反転する。

| モード | 実装 | −178,845.6 |
|---|---|---|
| TRUNCATE | `sign * Math.floor(abs)` | −178,845（0方向＝切り捨て） |
| ROUND_HALF_UP | `sign * Math.round(abs)` | −178,846 |
| CEILING | `sign * Math.ceil(abs)` | −178,846 |

ERA の +178,845（切り捨て）と赤伝の −178,845 が同じ向きに揃う。

### D-32 非課税の行は税区分ごとに分けて出す（慎太郎さん判断 2026-09-23）

`TaxClassification` に `NON_TAXABLE` が実在する。集計欄を税区分ごとに分ける。

    10.0%対象       ¥1,788,456     消費税  ¥178,845
    非課税           ¥1,100
    ───────────────────────────────
    当月お買上げ額   ¥1,789,556

KKAP+ の癖（非課税を 10% 欄に含め、税額だけ除く）は**再現しない**。
★非課税の合計は**明細から導出する**（列は足さない）。`exemptAmount` は既存コメントどおり輸出免税専用に残す。

### D-33 〔御入金〕の行は InvoiceItem にしない

KKAP+ の紙面には明細に「〔御入金〕振込」の行が入るが、`InvoiceItem` は**納品書明細のスナップショットに限る**（`deliveryNoteItemId` による二重請求の判定が汚れるため）。入金は画面・PDF で別の節として入金日順に並べる。

### D-34 納品書の税の丸めは PR-2 で触らない

納品書の税は `Math.round` 固定（C-2）。請求書はクライアントごとの端数で請求書1枚につき1回。**丸め方を揃えてもずれは消えない**——合計請求書は複数の納品書を合算して1回計算するため、各納品書の税額の合計とは原理的に一致しない（KKAP+ の実物も請求書末尾の1行だけ）。

- 納品書の税額は**その納品書1枚の中だけの参考値**と位置づける
- 納品書の金額表示は任意（`showAmounts` 既定 false）なので、ずれが表に出るのは金額を出した納品書だけ
- PR-4 の納品書 PDF に「消費税は請求書にて計算します」の注記を入れる（PR-4 のスコープに送る）

### D-35 端数処理は Invoice にスナップショットしない

addendum v0.7 §2 の「請求書を作るとき、クライアントの端数処理を Invoice にもスナップショットするかは実装ブリーフで決める」への回答。

- **スナップショットしない**（Invoice に端数処理の列を足さない）
- 理由: 税額そのものが `taxAmount10` / `taxAmount8` / `totalTaxAmount` に**確定値として保存される**ため、発行後にクライアントのマスターが変わっても発行済みの税額は変わらない（再計算しなければずれない）
- ★したがって **発行済みの請求書の金額を再計算する処理を書かない**。DRAFT の編集時だけ、その時点のクライアント設定で計算し直す
- 発行時の設定を後から知りたくなった場合は AuditLog（クライアントの更新記録）で辿れる

---

## 3. schema 変更と migration

### 3-1 列と enum

    enum TaxRoundingMode {
      TRUNCATE      // 切り捨て（既定）
      ROUND_HALF_UP // 四捨五入
      CEILING       // 切り上げ
    }

| モデル | 追加する列 |
|---|---|
| Client | `taxRoundingMode TaxRoundingMode @default(TRUNCATE) @map("tax_rounding_mode")` |
| Invoice | `previousBalanceAmount Decimal? @map("previous_balance_amount") @db.Decimal(15, 2)` 前回御請求額 |
| Invoice | `paymentReceivedAmount Decimal? @map("payment_received_amount") @db.Decimal(15, 2)` 御入金額 |
| Invoice | `carriedForwardAmount Decimal? @map("carried_forward_amount") @db.Decimal(15, 2)` 繰越金額 |
| Invoice | `replacesInvoiceId String? @map("replaces_invoice_id")` 再発行の元（v1.0 §2-5） |

★`paidAmount` は既存で「その請求書に充当された入金」の意味なので、期間の入金合計には別語（`paymentReceived`）を当てて衝突を避ける。
★Invoice に `@@index([replacesInvoiceId])` を足す。
★端数処理の列は **Invoice には足さない**（D-35）。

### 3-2 migration は1ファイル

新しい enum は `CREATE TYPE` なので、`ALTER TABLE ... ADD COLUMN` と同じファイルに入れられる（`ALTER TYPE ... ADD VALUE` の単独ファイル隔離は不要）。

置き場所: `prisma/migrations/20260923000000_b109_pr2_billing_carryover/migration.sql`

    -- B-109 PR-2: 繰越型の合計請求書と、クライアントごとの消費税端数処理（D-22〜D-25）。
    -- 非破壊: CREATE TYPE と ADD COLUMN のみ。既存データの書き換えなし。
    CREATE TYPE "TaxRoundingMode" AS ENUM ('TRUNCATE', 'ROUND_HALF_UP', 'CEILING');

    ALTER TABLE "clients" ADD COLUMN "tax_rounding_mode" "TaxRoundingMode" NOT NULL DEFAULT 'TRUNCATE';

    ALTER TABLE "invoices" ADD COLUMN "previous_balance_amount" DECIMAL(15,2);
    ALTER TABLE "invoices" ADD COLUMN "payment_received_amount" DECIMAL(15,2);
    ALTER TABLE "invoices" ADD COLUMN "carried_forward_amount" DECIMAL(15,2);
    ALTER TABLE "invoices" ADD COLUMN "replaces_invoice_id" TEXT;

    CREATE INDEX "invoices_replaces_invoice_id_idx" ON "invoices"("replaces_invoice_id");

### 3-3 適用の手順（★この repo の正運用・A-2 / A-3 の実測どおり）

    cd ~/shunya-production-system
    # 1. schema.prisma を編集した後、差分をドライランで見る
    npx prisma migrate diff \
      --from-schema-datasource prisma/schema.prisma \
      --to-schema-datamodel prisma/schema.prisma \
      --script
    # 2. dev に反映（db push。migrate dev は使わない）
    npx prisma db push
    # 3. 手書き migration を置く（上の SQL）
    # 4. 1 の出力と手書きが一致することを目で確認する
    # 5. 本番は main マージ → Railway が migrate deploy を自動実行

★**`prisma migrate dev` / `prisma migrate reset` / `--accept-data-loss` は実行も提案もしない**（dev に `_prisma_migrations` が無く、DB 全体の reset を要求する）。

---

## 4. 実装

### 4-1 共通: 端数処理（新規 `src/lib/calc/tax-rounding.ts`）

    import { TaxRoundingMode } from "@prisma/client"

    /**
     * 円未満の端数処理（B-109 D-22・D-23・D-31）。
     * ★必ず絶対値に適用して符号を戻す。JS の Math.round は負数で 0 方向に丸まらない
     *   （Math.round(-1.5) === -1）ため、赤伝（マイナス請求）で丸めの向きが反転する。
     */
    export function applyTaxRounding(amount: number, mode: TaxRoundingMode): number {
      const sign = amount < 0 ? -1 : 1
      const abs = Math.abs(amount)
      switch (mode) {
        case "TRUNCATE":
          return sign * Math.floor(abs)
        case "ROUND_HALF_UP":
          return sign * Math.round(abs)
        case "CEILING":
          return sign * Math.ceil(abs)
      }
    }

★既存の `quotation-data.ts:227`（Math.floor）と `delivery-notes.ts:581`（Math.round）は **PR-2 では触らない**（D-34）。

### 4-2 クライアント（4層）

| 層 | ファイル | 変更 |
|---|---|---|
| schema | `prisma/schema.prisma` | §3-1 |
| validator | `src/lib/validators/client.ts` | import に `TaxRoundingMode` を足し、185行（`depositPercentage`）の後に `taxRoundingMode: z.nativeEnum(TaxRoundingMode).default("TRUNCATE"),` ／ あわせて `isQualifiedInvoiceIssuer: z.boolean().default(true),` と `taxId: optionalString(50)` を足す（`validators/supplier.ts:127` と同じ形） |
| action | `src/lib/actions/clients.ts` | **変更不要**（24行の `{ ...data }` で通る）。★update の AuditLog（328行）の before/after に新しい列が入ることを確認する |
| form | `src/app/(app)/clients/_components/client-form.tsx` | 取引条件カード（427〜590行）の末尾に3つ足す |
| 詳細 | `src/app/(app)/clients/[id]/page.tsx` | 取引条件の節（249〜259行の近く）に3つ表示 |

**フォームの文言（画面に出る日本語は仕様。この語で入れる）**

- 消費税の端数処理
  - ラベル: 消費税の端数処理
  - 補足: 請求書の消費税を計算するときの、1円未満の扱いです。今の請求書（KKAP+）の取引先ごとの設定に合わせてください。
  - 選択肢: 切り捨て（既定） / 四捨五入 / 切り上げ
- 適格請求書発行事業者（Switch・既定 ON）— `suppliers/_components/supplier-form.tsx:529` と同じ形
  - 詳細画面の表示は 登録あり / 未登録（`suppliers/[id]/page.tsx:232` と同じ）
- 登録番号（`taxId`・任意・50文字）
  - 補足: 適格請求書発行事業者の登録番号（T＋13桁）

### 4-3 赤伝（`src/lib/validators/delivery-note.ts` の1か所）

`quantityIntField` を「0 以外の整数」に緩め、**受注から引き当てた行だけ 1 以上に限る**（D-26・D-27・D-28）。

    /** 数量（Int・0 以外）。§3-2: DeliveryNoteItem.quantity は整数。
     *  ★B-109 PR-2（D-26・D-28）: 赤伝（値引き・委託の戻り）はマイナスの数量で表す。単価はプラスのまま。
     *    受注から引き当てた行（soItemId あり）は従来どおり 1 以上（納品済み数の算出に効くため）。 */
    const quantityIntField = z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "number" ? v : Number(v)))
      .refine(
        (v) => Number.isInteger(v) && v !== 0,
        "数量は0以外の整数で入力してください",
      )

明細スキーマ（`deliveryNoteItemInputSchema`）の末尾に:

    .superRefine((v, ctx) => {
      if (v.soItemId && v.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "受注から引き当てた行の数量は1以上で入力してください",
          path: ["quantity"],
        })
      }
    })

- ★`unitPriceField`（`v >= 0`）は**変えない**（D-28: マイナスは数量で表す）
- ★action は変更不要。`delivery-notes.ts` にマイナスを拒む処理は無く、小計 `Math.round(quantity × unitPrice)` は符号どおりに出る（C-2 実測）
- ★`recomputeDeliveredQuantities` は `soItemId` / `skuId` を持つ行だけを集計するので、手入力の赤伝は受注の納品済み数に影響しない（D-27・addendum v0.7 §2-5 実測）
- ★画面: `delivery-note-form.tsx` の数量入力（503行）に `min` は**足さない**。明細の節に1行だけ説明を足す:
  値引き・返品はマイナスの数量で入れてください（赤伝）。単価はプラスのままにします。

### 4-4 合計請求書

**新規ファイル**

- `src/lib/validators/invoice.ts`
- `src/lib/actions/invoices.ts`
- `src/app/(app)/invoices/page.tsx`（一覧）/ `new/page.tsx` / `[id]/page.tsx`
- `src/app/(app)/invoices/_components/`（一覧表・作成フォーム・候補ダイアログ・状態操作・labels.ts）

**採番** `INV-{年}-{4桁}`

`delivery-notes.ts:120-150` の `computeNextDeliveryNumber` をそのまま写す。★`findFirst` を `deletedAt` で絞らない（番号の再利用を防ぐ）。P2002 リトライも同型。

**作成の流れ**

1. クライアントと期間を選ぶ。期間の既定は `Client.closingDay` から出す（31 または未設定＝月末締め。例: 20 → 前月21日〜当月20日）。人が直せる。
2. 候補 = そのクライアントの **DELIVERED 以降**の納品書のうち、`deliveryDate` が期間内で、**取消されていない請求書の `InvoiceItem.deliveryNoteItemId` に載っていない**明細。★サンプル・量産・赤伝を区別しない（D-4・D-6・D-26）。
3. 人が確認して外す行は外せる → 保存。
4. 明細 = 納品書明細のスナップショット（納品日・先方品番・品名・色・サイズ・数量・単価・税区分）＋ `deliveryNoteItemId`。見せ方は案A（1 SKU＝1行・D-19）。
5. 税区分の既定は `STANDARD_10`。非課税の行は `NON_TAXABLE` を選べる（D-32）。

**金額の計算**

    taxableAmount10        = 税区分 STANDARD_10 の行の小計合計
    taxAmount10            = applyTaxRounding(taxableAmount10 * 0.10, client.taxRoundingMode)
    taxableAmount8         = 税区分 REDUCED_8 の行の小計合計（v1 は通常 null）
    taxAmount8             = applyTaxRounding(taxableAmount8 * 0.08, client.taxRoundingMode)
    subtotal               = 全明細の小計合計（当月お買上げ額・税抜）
    totalTaxAmount         = taxAmount10 + taxAmount8
    previousBalanceAmount  = 直前の請求書（同じクライアント・取消されていない）の totalAmount
                             無ければ人が入れる（既定 0）
    paymentReceivedAmount  = 期間内の入金合計（§4-5）
    carriedForwardAmount   = previousBalanceAmount - paymentReceivedAmount
    totalAmount            = carriedForwardAmount + subtotal + totalTaxAmount   ← 今回御請求額（D-29）

- ★**端数処理は税率ごとに1回だけ**（D-22）。明細ごと・納品書ごとには丸めない。
- ★計算に使うのは**その時点の `client.taxRoundingMode`**。Invoice にはスナップショットしない（D-35）。**発行済み（SENT 以降）の請求書の金額を再計算する処理は書かない**。
- ★非課税の合計は明細から導出して紙面に出す。列は足さない（D-32）。
- ★当月お買上げ額が 0 でも繰越があれば請求書を作れる（KKAP+ のスタイルバンク東京 2026/08 の実例）。
- ★赤伝が入って `totalAmount` がマイナスになることを許す（D-26）。

**その他の列**

| 列 | 値 |
|---|---|
| `invoiceType` | `STANDARD`（赤伝が混ざっても `CREDIT_NOTE` にしない。1枚の合計請求書の中で相殺する） |
| `transactionType` | `DOMESTIC_TAXABLE_10`。8% や非課税が混ざれば `MIXED` |
| `issuerTaxId` | **T2011001051698**。`COMPANY_PROFILE` 定数に足す（D-5） |
| `issuerName` / `issuerAddress` ほか | `COMPANY_PROFILE` からスナップショット |
| `billTo*` | `Client.billing*` → `Client` 基本 の連鎖（B-108 §4-2 と同型）をスナップショット |
| `billToTaxId` | `Client.taxId`（§4-2 で足す列） |
| `paymentDueDate` | 締め日 ＋ `paymentMonthOffset` / `paymentDay` から自動・人が直せる |
| `status` | `DRAFT`（D-30） |
| `paidAmount` / `remainingAmount` / `isFullyPaid` | **v1 では使わない**（既定のまま触らない・D-25 / D-30） |

**状態と訂正**

- `DRAFT`（編集可）→ `SENT`（確定・以後書き換えない）→ `CANCELLED`
- 誤りは 取消 → **新しい番号で再発行**。再発行側の `replacesInvoiceId` に元の請求書の id（修正インボイス＝当初交付分との関連性を明らかにして交付）
- 取消した請求書に載っていた明細は**再び候補に戻る**
- 状態変更は AuditLog に残す（`clients.ts` の `writeAuditLog` と同型）

**二重請求の防止**

候補から除外するだけでなく、**保存時にサーバでも再確認**する（取消されていない請求書の `InvoiceItem.deliveryNoteItemId` と突合）。★UI とサーバの両方に置き、サーバ側を正とする。

### 4-5 入金（クライアント単位・D-25）

**新規** `src/lib/validators/payment.ts` / `src/lib/actions/payments.ts`

置き場所は **クライアントの詳細画面に「入金」の節**（一覧＋「入金を記録」）。★v1.0 §2-6 は請求書の詳細からだったが、D-25 でクライアント単位になったので移す。v1 では `/payments` の独立した一覧も nav 項目も作らない。

| 列 | 入れる値 |
|---|---|
| `paymentNumber` | `PAY-{年}-{4桁}`（採番は §4-4 と同じ手本） |
| `paymentDirection` | `INCOMING` |
| `counterpartType` / `counterpartId` / `counterpartName` | `CLIENT` / client.id / client.companyName |
| `amount` | 入金額 |
| `scheduledDate`（NOT NULL） | **入金日と同じ値**（実績の記録なので予定日＝実績日） |
| `actualPaymentDate` | 入金日 |
| `status` | **`CONFIRMED`（着金確認済み）**。`COMPLETED` は出金寄りの語 |
| `paymentMethod`（NOT NULL） | 既定 `BANK_TRANSFER`・選択可 |
| `title` / `internalNotes` | 任意 |
| `relatedInvoiceIds` / `InvoicePayment` | **使わない**（D-25） |

**御入金額の集計**

そのクライアントの Payment（`INCOMING`・`counterpartType=CLIENT`・`deletedAt` null・`status` が `CANCELLED` / `FAILED` 以外）のうち、`actualPaymentDate` が **前回の締め日の翌日〜今回の締め日**のものの合計。

入力フォームの文言:

- 見出し: 入金
- ボタン: 入金を記録
- 補足: 入金はクライアントごとに記録します。次の合計請求書の「御入金額」と「繰越金額」に自動で入ります。

### 4-6 画面

**nav**（`src/components/app-shell/nav-items.ts`）

取引グループの「納品」の後に足す。★80-81行のコメント（請求（INV）は B-109 で別項目として追加する）は**書き換える**（後続を語る文はその後続を実装した PR が消す）。

    { label: "請求", href: "/invoices", icon: FileText, enabled: true },

**一覧** `/invoices`

- 列: 請求書番号・クライアント・期間・**繰越金額**・今回御請求額・支払期日・状態
- ★**繰越金額が残っている行を色で分ける**（慎太郎さん判断 2026-09-23）。0 は通常表示、0 でなければ強調
- フィルタ: 状態（ドラフト／送付済み／取消）とクライアント
- ★「未入金・一部入金・入金済み」のフィルタは作らない（D-30）

**新規** `/invoices/new` — クライアントと期間 → 候補の確認 → 保存

**詳細** `/invoices/[id]` — 明細・金額の内訳（下の6行）・送付済みにする・取消・再発行

    前回御請求額    ¥ ...
    御入金額        ¥ ...
    繰越金額        ¥ ...
    当月お買上げ額  ¥ ...
    消費税等        ¥ ...
    今回御請求額    ¥ ...

★入金は明細ではなく別の節に入金日順で並べる（D-33）。

### 4-7 既存画面の文言

`(app)/deliveries/` の該当15行を確認した結果、**PR-2 で古くなる文は無い**（4値の状態・受注 SKU は変更不可・引き当て不可の3つは、赤伝を入れても意味が変わらない）。変えるのは次の2つだけ。

1. `nav-items.ts:80-81` のコメント（上記）
2. 納品書の明細の節に赤伝の説明を1行（§4-3）

---

## 5. 動作確認（★マージ前はローカル。本番では確認しない）

    cd ~/shunya-production-system
    git switch feat/b-109-pr2-billing-carryover
    PORT=3001 npm run dev

- 確認先は **http://localhost:3001** （dev DB = hopper:12921）。3000 ではない
- ★未ログインの curl は 401 ではなく **307**（`src/proxy.ts` が /login へ転送）。確認はブラウザで行う
- dev の素材: `DLV-2026-0006`（葵アパレル[ダミー]・**出荷済み**・量産行＋手入力行）／`SO-2026-0004`
- ★**請求の候補は「納品完了（DELIVERED）」以降**。`DLV-2026-0006` は出荷済みなので、確認の前に納品完了にする

| # | 確認 |
|---|---|
| 1 | クライアント編集で「消費税の端数処理」を保存 → 詳細に出る。適格請求書発行事業者・登録番号も出る |
| 2 | `DLV-2026-0006` を納品完了にする |
| 3 | 請求 → 新規 → 葵アパレル・期間を選ぶ → 候補に `DLV-2026-0006` の明細が出る → 保存 → `INV-2026-0001` |
| 4 | 金額の6行が出る。前回御請求額 0（人が入れられる）／御入金額 0／繰越 0／当月お買上げ額＝小計／消費税／今回御請求額 |
| 5 | クライアント詳細で入金を記録 → 次の期間の請求書で「御入金額」と「繰越金額」に入る |
| 6 | 赤伝: 納品書を新規作成し、**手入力行**で 数量 −1・単価 30,000 → 保存できる。**受注から引き当てた行**で −1 を入れるとエラーになる |
| 7 | 赤伝を納品完了にして請求書を作る → 当月お買上げ額・消費税・今回御請求額がマイナスになる。切り捨てが 0 方向であることを確認（D-31） |
| 8 | 端数: クライアントを「四捨五入」に変えて**新しい請求書を作る**と税額が1円上がる（税抜合計の1円未満が 0.5〜0.9 になる単価で作る）。★発行済みの請求書の金額は変わらない（D-35） |
| 9 | 二重請求: 同じ期間でもう1枚作ろうとすると候補が空になる。取消すと候補に戻る |

---

## 6. Git / PR

- ブランチ: `feat/b-109-pr2-billing-carryover`（★main 直 push 禁止）
- コードを含むので **PR 必須**。型・lint がクリーンなら commit → push → PR open まで Claude Code が自走してよい。**マージは慎太郎さんが握る**
- lint のゲートは**触ったファイル**で測る。全体 lint は既存 error が増えていないことの確認に使う（main は error 0 ではない）
- ★open PR の上に次の PR を積まない
- マージ＝Railway の main 自動デプロイ＝**本番反映（不可逆）**。migration もそのとき `migrate deploy` で本番に当たる

---

## 7. 未確定・次に送るもの

| # | 内容 | 行き先 |
|---|---|---|
| 1 | 納品書 PDF に「消費税は請求書にて計算します」の注記（D-34） | PR-4 |
| 2 | K-1 前受金の消費税の扱い（税理士事務所に確認） | PR-3 の前 |
| 3 | Q-3a / Q-3b KKAP+ の得意先マスタ（ACME・ウエルカムの端数の向き／税計算の単位） | B-215 |
| 4 | 移行の初期値（最初の請求書の前回御請求額＝KKAP+ の直前の今回御請求額） | 人が入れる欄で受ける（B-215 に記載済み） |
| 5 | 赤伝の「納品完了」が何を指すか（返品を受け取った時か） | 運用で確かめる |
| 6 | 請求書の一覧で「繰越が残っている」をどの閾値で色分けするか | 実装時に 0 以外で作り、運用で調整 |

★新規 B番号は振らない（C-6 で BACKLOG を grep 済み・独立行なし・陽性対照 B-109=4件）。

---

## 8. 検証記録（2026-09-23・spec との逐一照合）

v1.0 の D-1〜D-21 と addendum v0.7 の D-22〜D-28 を1件ずつ本書と突き合わせた。

- **PR-2 で実装するもの**: D-4 / D-5 / D-6 / D-11 / D-19 / D-22 / D-23 / D-24 / D-25 / D-26 / D-27 / D-28 → §3・§4 に反映済み
- **PR-1 で実装済み・本書は前提として使うもの**: D-1 / D-2 / D-17
- **次の PR に送るもの**: D-7〜D-9・D-20（PR-3）／D-12（PR-4）／D-13〜D-16・D-21（PR-6）／D-18（B-215）
- **置き換わったもの**: D-10（→ D-23）／D-3 の「都度」（→ PR-3）
- addendum v0.7 が「実装ブリーフで決める」とした13点をすべて確定した（§2 の D-29〜D-35 と §3・§4）。★初稿では「Invoice に端数処理をスナップショットするか」が抜けており、本検証で発見して D-35 を追加した（v1.1）

END-OF-BRIEF-B109-PR2-V1_1
