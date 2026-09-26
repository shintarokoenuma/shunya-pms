# B-109 PR-6（B-123 締め）実装ブリーフ（2026-09-26）

- 種別: 実装ブリーフ
- 対象: B-123（締め処理・期間ロック）＝ 請求の仕様確認書 v1.0 の PR-6
- ライフサイクル: 12. 請求（手前の 10. 検品＝B-150 は未着手。慎太郎さんに報告済み・v1 の締めは在庫・検品の記録を対象にしない）
- 根拠: docs/specs/b-109-b-114-b-123-billing-spec-confirmation-v1_0-2026-09-22.md §2-8・§2-9（D-13〜D-16・D-21）／docs/b-123-period-close-lock-design-note-2026-08-08.md／addendum v1.0（D-38・D-41）
- 参考画面: https://claude.ai/artifact/V1EaAR2UBZ4gxaTefidqiK （案B を採用。一覧の中身・確認と解除のダイアログ・締めた期間の帯の文言はこの画面が正）
- live 実測: 2026-09-26 02:40 / 02:52 JST（Claude Code・read-only・main a1ce918・dev hopper:12921）
- 作成: 2026-09-26 03時台 JST（claude.ai 側）

---

## 0. 結論

1. 締めを記録する器 PeriodClose を新しく作る（ADD TABLE 1本＋enum 1つ・非破壊）。休眠モデルに受け皿は無い（isLocked は Specification / Quotation の1行ロックで期間ロックではない・2026-09-26 実測）。
2. 締めは「取引先 × 期間」。締めた期間の日付の伝票は、作成・編集・削除・状態の変更をサーバで止める。判定は1つの関数に集め、画面の表示にも同じ関数を使う。
3. 仕様確認書 v1.0 §2-8 から変えた点が3つある（本書 P6-D7・P6-D8・P6-D10）: 入金も止める／PO・WO の進捗の状態は止めない／残っている伝票は警告して締められる。
4. nav に「経理」グループを作り、請求・入金を取引から移して「締め」を足す（D-38 の再編をここで行う）。

---

## 1. 決定事項（P6-D）

| D | 内容 | 根拠 |
|---|---|---|
| P6-D1 | 器は新モデル PeriodClose（テーブル period_closes）＋ enum PeriodCloseStatus（CLOSED / REOPENED）。1回の締め＝1行。解除は同じ行を REOPENED にして解除した人・日時・理由を入れる。締め直しは新しい行を作る。行の並びがそのまま締めと解除の履歴になる | v1.0 §2-8・設計ノート §2 の2 |
| P6-D2 | 取引先の種類は既存の enum CounterpartType を使う（CLIENT / SUPPLIER / FACTORY / CONTRACTOR の4値だけを使う）。Payment が実用中の enum（2026-09-26 実測）。PartyType は BUYER / OWN_COMPANY 寄りで用途が違うので使わない | 実測 |
| P6-D3 | 期間（開始日・終了日）は保存する。判定は保存した期間で行い、後から締め日を変えても締めた行は動かない | D-41 と同じ理由 |
| P6-D4 | 「YYYY-MM の締め」＝期間の終わりがその月に入る期間。期間は取引先の closingDay から出す（31 または空＝月末締め → その月の1日〜末日／20 → 前月21日〜当月20日）。請求書の期間の出し方と同じ計算を使う（src/lib/calc/invoice-period.ts に既存の関数があれば流用し、無ければ同じファイルに純関数で足す） | v1.0 §2-2 の1・§2-8 |
| P6-D5 | 同じ取引先で、締めようとする期間と1日でも重なる CLOSED の行があれば締めない（エラー）。一覧では、その月に重なる CLOSED 行があれば、行の期間を出して「締め中」と表示する | 締め日の変更で期間がずれる場合の保護 |
| P6-D6 | 判定関数を1つにまとめる（新規 src/lib/period-close/lock.ts）。引数は client（prisma か tx）・companyId・counterpartType・counterpartId・日付（YYYY-MM-DD）。締め中の行があれば、エラー文「{日付} は {取引先名} の締め済みの期間（{開始}〜{終了}）です。変更するには管理者が締めを解除してください。」を返す。日付の比較は invoice-period.ts の fromYmd / toYmd を使い、new Date() の生の比較をしない。transaction の中で書き込む action は、同じ tx で判定する | サーバ側が正 |
| P6-D7 | 入金も締めの対象にする（作成・取消とも止める）。入金日は actualPaymentDate ?? scheduledDate（payments.ts:307 / :370 と同じ読み方） | 慎太郎さん 2026-09-26「対象にする」 |
| P6-D8 | PO / WO は、締めた期間でも進捗の状態（CANCELLED 以外への変更）は変えられる。止めるのは作成・編集・削除・CANCELLED への変更。PO / WO の発注日は画面から入力できず作成日が入るため、発注した月と完了する月が普通にずれる | 慎太郎さん 2026-09-26「進捗は変えられる」 |
| P6-D9 | 締めは社内の誰でも（role が EXTERNAL の人は締め・解除・一覧すべて拒否）。解除は role が OWNER / ADMIN の人だけ。role は session.user.role から取る。★role を画面で変える手段は無い（B-205）ので、当面の管理者は seed の OWNER のまま | v1.0 D-15・§2-8 |
| P6-D10 | 締める時に、その期間の処理が済んでいない伝票を数えて確認ダイアログに出す。残っていても締められる。数えたものは PeriodClose.closeWarnings（Json）と AuditLog に残す | 慎太郎さん 2026-09-26「警告して締められる」 |
| P6-D11 | AuditLog の enum は変えない。締め＝CREATE、解除＝UPDATE（entityType "PeriodClose"）。書き方は payments.ts と同じく tx.auditLog.create に companyId / userId を手書きする（writeAuditLog は TenantContext がある brands / clients でしか効かない・2026-09-26 実測） | 実測 |
| P6-D12 | nav: 取引から「請求」「入金」を外し、新しい section「経理」（請求・入金・締め）を「取引」と「マスター」の間に置く。accent は "trade" を流用する（新しい色は B-188 の範囲）。nav-items.ts:84 の「経理グループへの再編は…まとめて行う」のコメントは、再編した事実に書き換える | D-38・慎太郎さん 2026-09-26「案B」 |
| P6-D13 | 請求書は periodEndDate で判定する。締めた期間の請求書は、作成も状態の変更（送付済み・取消）もできない。したがって運用は「請求書を送付済みにしてから、その月を締める」 | v1.0 §2-8・D-41 |

---

## 2. 器（schema・migration）

### 2-1. schema に足すもの

モデル（id・createdAt・updatedAt の書き方は ProductionEstimate の宣言をそのまま写す。house style に合わせ、User への @relation は張らない＝scalar のみ）:

    model PeriodClose {
      id               （ProductionEstimate の id と同じ宣言）
      companyId        String            @map("company_id")
      counterpartType  CounterpartType   @map("counterpart_type")  // CLIENT / SUPPLIER / FACTORY / CONTRACTOR のみ
      counterpartId    String            @map("counterpart_id")
      periodStartDate  DateTime          @map("period_start_date") @db.Date
      periodEndDate    DateTime          @map("period_end_date") @db.Date
      status           PeriodCloseStatus @default(CLOSED)
      closedAt         DateTime          @default(now()) @map("closed_at")
      closedByUserId   String            @map("closed_by_user_id")
      closeWarnings    Json?             @map("close_warnings")    // 締めた時点で残っていた伝票（P6-D10）
      reopenedAt       DateTime?         @map("reopened_at")
      reopenedByUserId String?           @map("reopened_by_user_id")
      reopenReason     String?           @map("reopen_reason") @db.Text
      createdAt / updatedAt / deletedAt  （ProductionEstimate と同じ宣言）
      @@index([companyId, counterpartType, counterpartId, periodEndDate])
      @@index([companyId, periodEndDate])
      @@map("period_closes")
    }

    enum PeriodCloseStatus {
      CLOSED   // 締め中
      REOPENED // 解除済み
    }

- 物理削除はしない。deletedAt は house style のために持つが、v1 で立てる経路は作らない。
- PeriodClose は TENANT_MODELS に入れない。クエリには companyId と deletedAt: null を必ず手書きする（AGENTS.md）。

### 2-2. migration の運用（shunya-environment-safety-check ルール 00・2026-09-26 実測）

- dev への反映は db push。prisma migrate dev は使わない。prisma migrate reset と --accept-data-loss は使わない。
- 本番は Railway の start（prisma migrate deploy && next start）で適用される。新しいテーブルと enum の追加だけなので、既存の行には触れない。
- 手順:
  1. .env の接続先が hopper.proxy.rlwy.net:12921 であることを確かめる。違えば止める
  2. schema を編集する
  3. ドライラン: npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script の出力を /tmp/b109-pr6-diff.sql に保存する。含まれてよいのは CREATE TYPE "PeriodCloseStatus"・CREATE TABLE "period_closes"・その CREATE INDEX だけ。DROP・既存テーブルへの ALTER が1行でもあれば止めて報告する
  4. npx prisma db push（--accept-data-loss は付けない）
  5. prisma/migrations/20260926000000_b109_pr6_period_close/migration.sql を作る。中身は1行目に説明コメント（-- B-109 PR-6（B-123）: 締め＝取引先×期間のロック。非破壊（ADD TABLE＋enum）。）、その後に手順3の出力をそのまま置く
  6. 一致の確認: コメント行を除いた migration.sql と /tmp/b109-pr6-diff.sql が diff で一致すること。db push 後に同じ migrate diff を流すと空になること
  7. npx prisma generate。★起動中の dev サーバは古い Client を掴むので、確認の前に再起動する

---

## 3. 判定を入れる action（サーバ）

★すべて src/lib/actions/ 配下（書き込み経路16か所の全数・2026-09-26 実測）。量産発注の生成は createPurchaseOrder / createWorkOrder を呼ぶので下の表で止まるが、途中で止まると半端に作られるため、生成の前にまとめて判定する（下の最終行）。

| 伝票 | 取引先の種類・id | 判定する日付 | 止める action |
|---|---|---|---|
| 納品書 | CLIENT・clientId | deliveryDate | createDeliveryNote／updateDeliveryNote（変更前と変更後の両方＝日付・取引先を締めた月へ移すのも、締めた月から出すのも止める）／updateDeliveryNoteStatus（すべての変更）／softDeleteDeliveryNote／createDepositRequest |
| 請求書 | CLIENT・clientId | periodEndDate | createInvoice／updateInvoiceStatus（すべての変更） |
| 入金 | CLIENT・counterpartId | actualPaymentDate ?? scheduledDate | createClientPayment／cancelClientPayment |
| PO | SUPPLIER・supplierId | orderDate（作成は JST の今日） | createPurchaseOrder／updatePurchaseOrder（仕入先を変えるなら変更後も）／deletePurchaseOrder／updatePurchaseOrderStatus は CANCELLED への変更だけ |
| WO | FACTORY・factoryId または CONTRACTOR・contractorId | orderDate（作成は JST の今日） | createWorkOrder／updateWorkOrder（発注先を変えるなら変更後も）／deleteWorkOrder／updateWorkOrderStatus は CANCELLED への変更だけ |
| 量産発注の生成 | 生成する PO / WO の全発注先 | JST の今日 | generateProductionOrders: 最初の createPurchaseOrder を呼ぶ前に全発注先を判定し、1件でも締め中なら何も作らずにエラーを返す |

- PO / WO の orderDate は validator に無く @default(now()) で入る（2026-09-26 実測）。作成時の判定に使う「今日」は JST の日付（toYmd と同じ基準）で求める。
- エラーは各 action の既存の返し方（{ ok: false, error }）に合わせる。
- 締めの判定に落ちた時は、何も書かない（AuditLog も書かない）。

---

## 4. 締めの action（新規 src/lib/actions/period-closes.ts）

- listPeriodCloses({ month: "YYYY-MM", counterpartType, status? }): その種類の取引先（deletedAt: null・ACTIVE。その月に行がある取引先は ACTIVE でなくても出す）ごとに、締め日・その月の期間（P6-D4）・状態（未締め／締め中／解除済み。重なる CLOSED 行があれば締め中・P6-D5）・残っている伝票の件数（P6-D10）・行の id を返す。
- getCloseWarnings(counterpartType, counterpartId, periodStart, periodEnd): 残っている伝票の種類ごとの件数と番号（最大5件）。
  - CLIENT: 状態が DRAFT / SHIPPED の納品書（deliveryDate が期間内）／納品完了なのに取消されていない請求書に載っていない明細（getInvoiceCandidates と同じ条件を流用）／DRAFT の請求書（periodEndDate が期間内）
  - SUPPLIER: DRAFT の PO（orderDate が期間内）
  - FACTORY / CONTRACTOR: DRAFT の WO（orderDate が期間内）
- closePeriod({ counterpartType, counterpartId, month }): 期間を出す → 重なる CLOSED 行があればエラー → warnings を数える → PeriodClose を作る（closeWarnings に保存）→ AuditLog（CREATE）。1つの $transaction。
- reopenPeriod({ id, reason }): role が OWNER / ADMIN 以外はエラー「締めを解除できるのは管理者（OWNER / ADMIN）だけです」。理由は必須（空白だけも不可）。status を REOPENED・reopenedAt / reopenedByUserId / reopenReason を入れる → AuditLog（UPDATE・beforeData / afterData に状態と理由）。
- 締め直しは closePeriod をもう一度呼ぶ（新しい行・P6-D1）。
- validator は新規 src/lib/validators/period-close.ts（zod）。requireSession はこのファイル内で role まで返す形にする（payments.ts の requireSession に role を足した形）。
- 各 action の最後に revalidatePath("/closings") と、影響する一覧（/deliveries・/invoices・/payments・/purchase-orders・/work-orders）。

---

## 5. 画面

### 5-1. nav（src/components/app-shell/nav-items.ts）

- 取引: 見積もり／発注（仕入 PO）／発注（作業 WO）／受注／納品
- 経理（新しい section・accent "trade"）: 請求 /invoices（FileText）／入金 /payments（Banknote）／締め /closings（アイコンは lucide の Lock）
- 取引の中の「請求・入金は別項目」「経理グループへの再編は…」のコメント2行は、「請求・入金・締めは経理グループ（B-109 PR-6・D-38 の再編）」に書き換える。

### 5-2. 締めの一覧 /closings（新規 src/app/(app)/closings/）

参考画面の案B の右側と同じ構成・同じ文言にする。

- 見出し「締め」、月の切り替え（◀ YYYY-MM ▶・既定は今日の前月）
- 取引先の種類の切り替え（クライアント／仕入先／工場／外注先）、状態の絞り込み（すべて／未締め／締め中／解除中）
- 表の列: 取引先／締め日（空なら「未設定→月末」）／期間（MM/DD〜MM/DD）／状態（未締め・締め中・解除中の札）／残っている伝票（件数の札・無ければ「なし」）／操作
- 操作: 未締め＝「締める」、締め中＝「解除する」（OWNER / ADMIN にだけ出す）、解除中＝「締め直す」
- 表の下の注記: 「締めの単位は「取引先 × その締め日の期間」です（D-16）。締め日が空の取引先は月末締めとして扱います。「解除する」は OWNER / ADMIN にだけ出ます。」

「締める」の確認ダイアログ（参考画面の文言）:

    {取引先名}　{YYYY-MM（MM/DD〜MM/DD）}を締めます。
    （残っている伝票がある時だけ）この期間に、まだ処理が済んでいない伝票があります。
      ・{種類}　{件数}（{番号…}）
    締めた後は、この期間の日付の納品書・請求書・入金の作成・編集・状態の変更・削除ができなくなります。直すには管理者が解除します。
    ［やめる］［このまま締める］

- 仕入先・工場・外注先の時は、3行目を「締めた後は、この期間に発注した PO / WO の作成・編集・削除・取消ができなくなります（進捗の状態は変えられます）。直すには管理者が解除します。」にする（P6-D8）。

「解除する」のダイアログ（OWNER / ADMIN のみ）:

    {取引先名}　{YYYY-MM（MM/DD〜MM/DD）}の締めを解除します。
    解除の理由（必須）［テキストエリア］
    解除した人・日時・理由を残します。解除している間の変更は、この記録と並べて見られます。
    ［やめる］［解除する］

### 5-3. 締めた期間の伝票の表示

- 納品書・請求書・PO・WO の詳細画面の上に帯を出す: 「{YYYY-MM（MM/DD〜MM/DD）}は締め済みです。変更するには管理者が締めを解除してください。」
- 帯が出ている時は、止まる操作のボタン（編集・状態の変更・取消・削除）を無効にする。PO / WO は CANCELLED 以外の状態の変更と PDF は押せるままにする。PDF・閲覧はどれも押せるまま。
- 入金一覧（/payments）: 締めた期間の入金は「取消」を無効にし、ボタンの title に同じ文を入れる。
- 画面の判定は §3 と同じ関数（src/lib/period-close/lock.ts）を server component から呼ぶ。サーバ側の判定が正で、画面は案内。
- 一覧画面（/deliveries・/invoices・/purchase-orders・/work-orders）は変えない。

### 5-4. 文言の確認（既存画面）

- 実装の前に grep -rn -E '取引|経理|締め|後続|v1 では' を src/app/(app)/invoices・payments・deliveries・purchase-orders・work-orders と src/components/app-shell に対して流し、締めや nav の再編と食い違う説明文があれば直す（2026-09-26 の recon では nav-items.ts:84 のコメント以外に見つかっていない）。

---

## 6. 変えないもの

- 請求書の金額・繰越の計算（D-35 のまま・締めは再計算しない）
- 納品書の既存の DRAFT ガード（編集と削除は DRAFT のみ）と請求書の状態遷移の表
- PO / WO の進捗の状態の変更（CANCELLED 以外）
- AuditLog の enum・UserRole の enum
- 在庫・検品（ステップ 10）の記録。v1 の締めの対象にしない（B-150 / B-221 を作る時に対象へ足す）

---

## 7. 確認（dev・localhost:3001・hopper:12921）

★dev サーバは schema を変えた後に再起動する。確認は OWNER のユーザーで行い、6 だけ OWNER / ADMIN 以外のユーザーで確かめる（role を画面で変える手段が無いので、該当ユーザーが dev に無ければ 6 は「未確認」と書く）。

1. サイドバーに「経理」グループがあり、請求・入金・締めが並ぶ。取引に請求・入金が残っていない
2. /closings で月と種類を切り替えられる。締め日 20 のクライアントの期間が 前月21日〜当月20日 になる
3. 残っている伝票があるクライアントで「締める」→ 件数と番号が出る → 「このまま締める」で締め中になる
4. 締めた期間の日付で、納品書の新規作成・状態の変更、請求書の新規作成・取消、入金の記録・取消がエラーになり、エラー文に期間が出る。詳細画面に帯が出てボタンが無効になる
5. 締めた仕入先の PO: 編集・削除・取消はエラー、送付済みなど進捗の状態は変えられる
6. OWNER / ADMIN 以外には「解除する」が出ず、直接 action を呼んでもエラーになる
7. 「解除する」で理由を空にすると保存できない。理由を入れると解除中になり、4 の操作ができるようになる
8. 「締め直す」で新しい行ができ、再び止まる。AuditLog に締め（CREATE）・解除（UPDATE・理由入り）・締め直し（CREATE）が残る
9. 締めた期間と重なる期間を締めようとするとエラー（締め日を変えて試す）
10. 量産発注の生成: 発注先の今日の月を締めてから生成するとエラーになり、PO / WO が1件も増えていない

---

## 8. スコープ外（既存の B番号で受ける）

- 締め後の変更の専用レポート → B-214（v1 は解除の記録と AuditLog を並べて見られるところまで）
- role を画面で変える・ユーザー管理 → B-205
- 仕入の計上日（発注日か届いた日か）と支払の締め → B-212
- 在庫・検品・委託の戻りを締めの対象にする → B-150 / B-221
- 全取引先をまとめて締めるボタン → v1 では作らない（要望が出たら起票）

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-26 | v1.0 | 初版。P6-D1〜P6-D13。v1.0 §2-8 から変えた点（入金も止める・PO/WO の進捗は止めない・残っている伝票は警告して締められる）と nav の経理グループ（案B）を確定 |

END-OF-BRIEF-B109-PR6

---

## 9. 追記 v1.1（2026-09-26 dev 確認で出たもの）

| D | 内容 | 根拠 |
|---|---|---|
| P6-D14 | 「締める」のダイアログは開くたびに getCloseWarnings で残っている伝票を数え直す。一覧を開いた時点の件数のままだと、別の画面で状態を変えた後も古い件数が出る（DLV-2026-0003 を納品完了にした後も「納品書（ドラフト・出荷済み）」と出ていた） | 慎太郎さん 2026-09-26 dev 確認 |
| P6-D15 | 「未請求の納品明細」の表示を「納品完了・請求書にまだ載っていない明細」に変える（納品完了なのに警告が出る理由が読めなかった） | 同 |
| P6-D16 | PO / WO の作成時に orderDate を JST の今日で明示して保存する。DB の @default(now()) は UTC の日付になり、JST 0〜9 時に作ると前日になって締めた月に紛れ込むため。締めの判定と保存に同じ値を使う。既存の PO / WO の orderDate は変えない | Claude の指摘 2026-09-26 |
| P6-D17 | B-235（クライアント編集の 締め日・支払月・支払日 が打ち直しにくい）を本 PR で直す。慎太郎さん「マスターに15日を入れられない」。原因と直し方は実装時の recon で確定し、PR 本文に書く | 慎太郎さん 2026-09-26 |

## 改訂履歴（v1.1）

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-26 | v1.1 | P6-D14〜P6-D17 を追記（dev 確認での指摘） |

END-OF-BRIEF-B109-PR6-V1_1
