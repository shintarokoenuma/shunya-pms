# B-205 PR-1 実装ブリーフ（設定ページの枠・自社情報・振込先・帳票の読み先の切り替え）2026-09-27

- 識別子: B205-PR1
- 上位: `docs/specs/b-205-settings-spec-confirmation-v1_0-2026-09-27.md`（SETTINGS-V10・D-1〜D-24）
- 根拠の実測: RECON-SETUI / RECON-R6 / RECON-PROD / RECON-R15（2026-09-27・main 8566889・read-only）
- 一次資料（画面）: 参考画面「PMS 設定ページ 参考画面」案B https://claude.ai/artifact/XrcQWHt5WWsnJGQXcCNpUB
- ブランチ: `feat/b205-pr1-settings-company-profile`（main 直 push 禁止）

---

## §0 この PR でやること（3行）

1. サイドバーの「設定」を開け、案B の1ページ（左に目次・右に欄）を作る。PR-1 の目次は **自社情報・振込先・表示設定** の3つ
2. Company に FAX・振込先、Invoice に FAX の写しの列を足す（nullable の ADD COLUMN ×3）
3. 帳票6本と請求書・納品書の作成を、定数 `COMPANY_PROFILE` から **そのテナントの Company** に切り替え、定数を消す

## §1 確定事項（本 PR で効くもの・spec v1.0 から）

| D | 内容 |
|---|---|
| D-2 | 自社情報は Company に持つ。既存列（postalCode / address / phone / email / website / taxId）＋新しい2列（fax・bankAccount） |
| D-3 | 空の項目は帳票に空欄で出す。画面で「未登録」と知らせる。shunya の値を予備にしない |
| D-4 | 帳票の社名は `legalEntity`、空なら `companyName` |
| D-9 | 案B: 1ページ・左の目次・その場で直して項目ごとに保存・見るだけの画面は作らない |
| D-10 | 表示設定は設定ページとカルテの歯車の両方。同じ設定（`CompanySetting.uiPreferences.productKarte.memo.*`） |
| D-11 | OWNER / ADMIN 以外は見るだけ（PR-1 では役割ごとの切り替えは作らない＝PR-2） |
| D-15 | 電話・FAX・メールは番号・アドレスだけを持つ。「TEL:」「FAX:」「MAIL:」は帳票側で付ける |
| D-21 | 請求書の FAX も作る時に写す（Invoice.issuerFax） |
| D-22 | 請求書 PDF の予備（写しが空の時）は、そのテナントの今の Company |
| D-23 | 頭の文字は、値が既にそれで始まっていれば付けない |
| D-24 | 本番の自社情報はマージ直後に本番の設定ページで慎太郎さんが入力する。migration に値を書かない |

### 本ブリーフで決めたこと（P1-D）

| D | 内容 | 理由 |
|---|---|---|
| P1-D1 | 郵便番号も「〒」を付けずに持つ（例 `150-0043`）。帳票側で「〒」を付ける。既に「〒」で始まっていれば付けない | D-15 と同じ考え。今の定数は「〒999-9999」の形 |
| P1-D2 | 振込先は5項目（銀行名・支店名・口座種別・口座番号・口座名義）を**全部入れるか全部空か**。一部だけの保存は validator で弾く | 請求書の振込先が半端に出ないように。`isBankAccount`（invoice-data.ts）は5キーとも string かで判定している |
| P1-D3 | 登録番号は空か「T＋13桁」。それ以外は validator で弾く | Company.taxId のコメント「適格請求書発行事業者番号（T+13桁）」 |
| P1-D4 | URL は `/settings/company`・`/settings/bank`・`/settings/display`。`/settings` は `/settings/company` へ redirect。★「ユーザー」「役割と権限」は PR-2 で目次に足す（PR-1 では出さない＝押せない項目を置かない） | spec v1.0 §3-1 |
| P1-D5 | 自社情報を読む関数を1つ作り（`src/lib/company-issuer.ts`・名前は仮）、帳票のデータを集める関数からだけ呼ぶ。document（*-document.tsx）は DB を読まない | RECON-R15: document は data だけを受け、ルートは全部 companyId を data 関数に渡している |

## §2 現物（RECON-R15・main 8566889）

### 2-1. 帳票の流れ（10ルートとも同じ形）

    route.ts: const session = await auth()
      → get◯◯PdfData(id or ids, session.user.companyId)   ← ここで Company を1行読んで data に載せる
      → render◯◯PdfBuffer(data)（src/lib/pdf/render.tsx）
      → ◯◯Document({ data })（document は COMPANY_PROFILE を直接読んでいる → data.issuer を読むように変える）

| ルート | data 関数 | document |
|---|---|---|
| purchase-orders/pdf・purchase-orders/[id]/pdf・work-orders/pdf・work-orders/[id]/pdf | getOrderPdfData(kind, id, companyId) | OrderDocument / OrderDocumentMulti（order-document.tsx:136-142） |
| quotations/pdf | getQuotationPdfData(ids, companyId) | QuotationDocument（quotation-document.tsx:137-143） |
| production-estimates/pdf | getPeQuotationPdfData(ids, companyId) | PeQuotationDocument（pe-quotation-document.tsx:125-131） |
| delivery-notes/pdf | getDeliveryNotePdfData(id, companyId) | DeliveryNoteDocument（delivery-note-document.tsx:94-101） |
| products/[id]/sewing-spec | getSewingSpecPdfData(id, pages, companyId) | SewingSpecDocument（sewing-spec-document.tsx:438-443） |
| invoices/pdf | getInvoicePdfData(id, companyId)（invoice-data.ts） | 請求書の document（invoice-data.ts:151-153・166 が予備） |
| order-pdf-archive | 上の data 関数を companyId 引数で呼ぶ（:19-33） | 同上 |

★data 関数のファイルの場所は、実装の最初に `grep -rn "export async function get.*PdfData" src/lib` で確定する（推量しない）。

### 2-2. 作成時の写し

- `src/lib/actions/invoices.ts:548-558`（tx.invoice.create の data 内）: issuerName / issuerAddress（:161 の ISSUER_ADDRESS）/ issuerPhone / issuerEmail / issuerTaxId / bankInfo を定数から写している。`sess.companyId` を持っている。★issuerLegalEntity（`issuer_legal_entity`・String?）の列も既にある
- `src/lib/actions/delivery-notes.ts:210` モジュール定数 `SHIP_FROM_ADDRESS`、:773・:937 で shipFromAddress / shipFromContact に写している。`companyId` を持っている

### 2-3. 手本

- action: `src/lib/actions/company-settings.ts`（requireSession → 読み → 書き → AuditLog → revalidatePath・更新は `canManageCompanySettings`）。骨格をそのまま写す
- 表示設定: `getMemoUiPreferences` / 更新 action は既存。歯車の部品は `src/app/(app)/products/_components/memo-section.tsx`
- 見出しは h1 直書き（`src/app/(app)/closings/page.tsx:52` `<h1 className="text-2xl font-semibold tracking-tight">`）

## §3 schema と migration

### 3-1. schema

    model Company {
      ...
      fax         String? @db.VarChar(50)              // B-205 D-2・D-15（番号だけ）
      bankAccount Json?   @map("bank_account")         // B-205 D-2 { bankName, branchName, accountType, accountNumber, accountHolder }
    }
    model Invoice {
      ...
      issuerFax   String? @map("issuer_fax") @db.VarChar(50)   // B-205 D-21（作る時に Company.fax を写す）
    }

★列名は既存の書き方（`@map("snake_case")`）に揃える。`fax` は単語1つなので @map 不要（phone と同じ）

### 3-2. migration（★`prisma migrate dev` は使わない・shunya-environment-safety-check ルール 00）

1. `.env` が dev（hopper.proxy.rlwy.net:12921）であることを確認
2. ドライラン: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` → ★出るのが下の3行だけであること。他の DDL が1行でも出たら止めて報告
3. `npx prisma db push`（`--accept-data-loss` は付けない）
4. 手書き: `prisma/migrations/20260927000000_b205_pr1_company_fax_bank_invoice_issuer_fax/migration.sql`

       -- B-205 PR-1: 自社情報をテナントごとに DB に持つ（spec v1.0 D-2・D-21）
       -- 非破壊: nullable の ADD COLUMN のみ。既存行は NULL のまま（本番 companies 1行・invoices 0行・2026-09-27 実測）
       ALTER TABLE "companies" ADD COLUMN "fax" VARCHAR(50);
       ALTER TABLE "companies" ADD COLUMN "bank_account" JSONB;
       ALTER TABLE "invoices" ADD COLUMN "issuer_fax" VARCHAR(50);

5. 手書きと 2 のドライラン出力が一致することを確かめる
6. schema を変えたので dev サーバを再起動する（ルール 00-2）

## §4 実装

### 4-1. 自社情報を読む関数（P1-D5）

新規 `src/lib/company-issuer.ts`（名前は仮）

- `getCompanyIssuer(companyId): Promise<CompanyIssuer>` — `prisma.company.findFirst({ where: { id: companyId, deletedAt: null }, select: {...} })`。★Company は companyId 列を持たないので `id` で絞る
- 返す形:

      type CompanyIssuer = {
        name: string            // legalEntity ?? companyName（D-4）
        postalCode: string | null
        address: string | null
        phone: string | null
        fax: string | null
        email: string | null
        website: string | null
        taxId: string | null
        bank: CompanyBankAccount | null   // bankAccount が5キーとも string のときだけ
      }

- 頭の文字を付ける関数（D-15・D-23・P1-D1）: `withLabel("TEL: ", v)` のように、値が空なら空文字、既に同じ頭で始まっていればそのまま、でなければ付ける。〒・TEL: ・FAX: ・MAIL: の4つ。★今の定数と同じ見た目（「TEL: 03-…」「〒150-…」）になるようにする
- 住所の1行（`〒{postalCode} {address}`）を組む関数。片方が空なら空の方を出さない
- 型 `CompanyBankAccount` は `src/lib/constants/company-profile.ts` から移すか、そのファイルに型だけ残す（どちらでも可・PR 本文に書く）

### 4-2. 帳票（5本の document と data 関数）

- 各 data 関数で `getCompanyIssuer(companyId)` を1回呼び、data 型に `issuer: CompanyIssuer` を足す（複数件の data 関数でも1回だけ読む）
- 各 document の `COMPANY_PROFILE.xxx` を `data.issuer` と 4-1 の関数に置き換える。★見た目（並び・区切りの全角空白「　」・フォントサイズ）は変えない
- 空の項目は空欄（D-3）。「TEL: 」だけが残るような出し方をしない

### 4-3. 請求書

- `src/lib/actions/invoices.ts` の作成（:548-558）: 定数の代わりに `getCompanyIssuer(sess.companyId)` を tx の前で読み、issuerName（= name）・issuerLegalEntity（= Company.legalEntity）・issuerAddress（4-1 の住所の1行）・issuerPhone・issuerEmail・issuerTaxId・**issuerFax（新）**・bankInfo（= bank、無ければ Prisma.DbNull）を写す。★写すのは番号だけ（頭の文字は付けない）
- ★issuerTaxId と issuerAddress は NOT NULL（RP-0）。Company が空のときは空文字 `""` を入れる（D-3・本番は D-24 でマージ直後に入れる）
- `src/lib/pdf/invoice-data.ts`: 151・153 の予備、152 の FAX、166 の振込先の予備を、そのテナントの Company に替える（D-21・D-22）。FAX は `issuerFax ?? issuer.fax`
- 頭の文字は PDF 側で 4-1 の関数で付ける（dev の古い請求書の「TEL: 」付きの写しも二重にならない・D-23）

### 4-4. 納品書

- `src/lib/actions/delivery-notes.ts`: モジュール定数 `SHIP_FROM_ADDRESS`（:210）をやめ、作成の関数の中で `getCompanyIssuer(companyId)` から組む。:773・:937 の shipFromContact は issuer.name

### 4-5. 定数を消す

- `COMPANY_PROFILE` を削除する（型は 4-1 のとおり）
- ★完了の条件: `grep -rn "COMPANY_PROFILE" src` が **0 件**（陽性対照: 同じ grep を main で流すと 30 行・RECON-R6）

### 4-6. 設定ページ

新規（置き場所は既存の (app) 配下の作りに合わせる）:

- `src/app/(app)/settings/layout.tsx` — 見出し「設定」・説明「会社の情報とユーザーを管理します。オーナーと管理者だけが変更できます。」・左の目次（768px 未満では上に横並び・B-093 の考え）
- `src/app/(app)/settings/page.tsx` — `/settings/company` へ redirect
- `src/app/(app)/settings/company/page.tsx` — 自社情報のカード
- `src/app/(app)/settings/bank/page.tsx` — 振込先のカード
- `src/app/(app)/settings/display/page.tsx` — 表示設定（既存の getMemoUiPreferences と更新 action を使う。歯車の中身を部品として切り出せるなら切り出して両方から使う）
- `src/lib/actions/company-profile.ts` — `getCompanyProfile()`・`updateCompanyProfile(input)`・`updateCompanyBankAccount(input)`（company-settings.ts の骨格・更新は `canManageCompanySettings`・EXTERNAL は拒否・AuditLog に前後の値・`revalidatePath("/settings", "layout")`）
- `src/lib/validators/company-profile.ts` — zod。長さは列に合わせる（companyName 255・legalEntity 255・taxId 50＋P1-D3・postalCode 20・phone 50・fax 50・email 255＋形式・website 255）。前後の空白は trim、空文字は null に
- `src/components/app-shell/nav-items.ts:130` — 「設定」を `enabled: true` に

画面の文言（★モック案B の原文・spec v1.0 §3-2。変えない）:

- 目次: 「自社情報」／「帳票に載る情報」・「振込先」／「請求書に載る口座」・「表示設定」／「品番カルテのメモ」
- 自社情報: 見出し「自社情報」・説明「請求書・納品書・発注書に載ります」・入力欄「表示名／正式名称／郵便番号／住所／電話／FAX／メール／Webサイト／登録番号」・空の欄は「未登録」・ボタン「保存」・注記「この欄だけ保存します」
- 振込先: 見出し「振込先」・説明「請求書を作るときに写し取ります。発行済みの請求書は変わりません」・入力欄「銀行名／支店名／口座種別／口座番号／口座名義」・ボタン「保存」
- 表示設定: 見出し「品番カルテのメモ」・説明「全員の画面に効きます。品番カルテの歯車と同じ設定です」・スイッチ「時刻を出す」「書いた人を出す」「「編集済み」の印を出す」

見るだけ（D-11）:

- OWNER / ADMIN 以外は入力欄を読み取り専用にし、「保存」を出さない。★action 側でも拒否する（画面だけで止めない）

### 4-7. 文言の確認（既存画面）

- `grep -rn -E "設定|COMPANY_PROFILE|自社情報" src/app src/components` を流し、「設定は準備中」などの古い説明文があれば直す

## §5 変えないもの

- 帳票の紙面の並び・区切り・フォント（読み先だけを変える）
- 発行済みの請求書・納品書の写し（書き換えない）
- `canManageCompanySettings` と `canReopenPeriod` の2か所（一本化は PR-2）
- JWT・auth.ts（D-6 は PR-2）
- MASTER_ADMIN の判定

## §6 確認（dev・http://localhost:3001・hopper:12921）

★確認するブランチに `git switch` してから `PORT=3001 npm run dev`。schema を変えたので必ず起動し直す。
★dev の Company は shunya の1行で、住所も登録番号も空（RECON-SET）。

1. サイドバーの「設定」が押せる。`/settings` を開くと `/settings/company` になり、目次に「自社情報」「振込先」「表示設定」の3つが出る（「ユーザー」「役割と権限」は出ない）
2. 自社情報の空の欄に「未登録」が出る
3. 空のまま発注書 PDF を出す → 社名だけが出て、住所・電話・FAX・メールは空欄（「TEL: 」だけが残らない）。★ここで「株式会社shunya」の住所が出たら定数が残っている
4. 自社情報に値を入れて「保存」→ 再読込で残る。登録番号に「T123」を入れると保存できない（P1-D3）
5. 振込先を5項目入れて「保存」→ 残る。1項目だけ空にすると保存できない（P1-D2）
6. 帳票5本（発注書・見積書・量産見積書・納品書・縫製仕様書）に、入れた値が「〒」「TEL: 」「FAX: 」「MAIL: 」付きで1回ずつ出る
7. 請求書を1枚新しく作る → PDF に入れた値と振込先が出る。read-only SQL で `invoices.issuer_fax` と `bank_info` に値が入っている（新しく作った1枚のみ）
8. dev の古い請求書（例 INV-2026-0001）の PDF で、電話が「TEL: TEL: 」にならない
9. 納品書を1枚新しく作る → `shipFromAddress` が入れた住所になっている
10. 設定の「表示設定」でスイッチを1つ切る → 品番カルテのメモに効く。カルテの歯車でも同じ状態に見える
11. OWNER / ADMIN 以外のユーザーでの見るだけ: dev に該当ユーザーが無ければ「未確認」と書く（role を画面で変える手段は PR-2）
12. `grep -rn "COMPANY_PROFILE" src` が 0 件

## §7 Git / PR

- ブランチ: `feat/b205-pr1-settings-company-profile`
- 本ブリーフを `docs/specs/b-205-pr1-implementation-brief-2026-09-27.md`、仕様確認書を `docs/specs/b-205-settings-spec-confirmation-v1_0-2026-09-27.md` として同じ PR に入れる
- 型（`npx tsc --noEmit`）と触ったファイルの lint がクリーンなら、commit → push → PR open まで自走してよい。全体 lint は既存の error 数から増えていないこと。マージは慎太郎さん
- commit の末尾:

      Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
      Claude-Session: https://claude.ai/code/session_01Q4wqnk33gTUnimFRWsehUn

- PR 本文の末尾:

      🤖 Generated with [Claude Code](https://claude.com/claude-code)

      https://claude.ai/code/session_01Q4wqnk33gTUnimFRWsehUn

## §8 本番への影響と手順（★マージ＝本番反映＝不可逆）

- migration は nullable の ADD COLUMN ×3（本番 companies 1行・invoices 0行・RECON-PROD）。`start` の `prisma migrate deploy` で適用される。画面が開けば migration は通っている
- ★マージと同時に、本番の帳票の自社情報は社名以外が空欄になる（本番の Company は住所・電話・登録番号が空）
- ★**マージ直後に、本番の `/settings/company` と `/settings/bank` で自社情報と振込先を入力する（D-24）。入力が終わるまで帳票を出さない**
- 入力後、本番で発注書 PDF を1枚プレビューして自社情報が出ることを確かめる（ダウンロードはしない）

## §9 今回やらないこと（行き先）

| 内容 | 行き先 |
|---|---|
| ユーザー一覧・役割の変更・停止／アーカイブ・画面を開くたびに役割を確かめる・役割と権限・判定の一本化 | B-205 PR-2 |
| 招待・パスワード再設定・メール送信の基盤 | B-205 PR-3 |
| 役割ごとの出し分けを他の画面へ | 仮 B-243（締めで起票） |
| 英語の帳票 | B-110 |

END-OF-BRIEF-B205-PR1
