# B-212 PR-1 実装ブリーフ — 仕入先・工場の請求書の器と CSV 取り込み・一覧・詳細（2026-10-08）

- 作成: 2026-10-08 claude.ai（慎太郎さん + Claude）
- 一次資料: docs/specs/b-212-supplier-invoice-spec-confirmation-v1_1-2026-10-08.md（D-1〜D-10・§3-6 CSV の列）
- ライフサイクル: 8. 量産発注 → 12. 請求（買う側）
- recon: RECON-B212（2026-10-08 20:58）・RECON-B212-2（同 22:43）・main 8a26e50・dev hopper:12921・読み取りのみ
  - 仕入側の請求書の器は schema に無い（model 134 を目で確認）。Invoice はクライアント宛て専用
  - TENANT_MODELS は12モデルだけ（tenant-models.ts:18）。新しいモデルは入れず、companyId と deletedAt: null を手書きする（payments.ts と同じ）
  - 役割と権限: AREA_KEYS（settings-visibility.ts:39）・AREA_DEFAULTS は全領域 { STAFF: "hidden" }・画面は layout で requireAreaPage、action は先頭で checkArea（area-access.ts:22/34・payments/layout.tsx:8・payments.ts:89）・ナビは src/components/app-shell/nav-items.ts の area
  - 採番の手本: invoices.ts:125-141（startsWith の最大値＋1・4桁・deletedAt で絞らない）。作成＋監査の手本: payments.ts:182-220（$transaction・P2002 リトライ）
  - ファイルを受ける action の前例: markings.ts:263・product-sketches.ts:79。NFKC の前例: color-code.ts:16
  - 品番の検索は global-search.ts の ILIKE 部分一致だけで、完全一致の照合関数は無い。products.ts:670 は品番作成時に ModelCode.patternNumber に productCode を初期値で入れる
  - 費目（cost_categories・2階層・43行）に国内輸送費 DOMESTIC_TRANSPORT・国際輸送費 INTERNATIONAL_TRANSPORT・検品費 INSPECTION_FEE・保管費 STORAGE_FEE・通関費 CUSTOMS_FEE がある（すべて OVERHEAD 配下）
  - migration: dev は _prisma_migrations が無い（migrate status は全件未適用と出る）。本番は start の prisma migrate deploy

## 1. この PR で作るもの

1. 器（新しいテーブル3つ・ADD TABLE のみ・非破壊）
2. CSV の取り込み（ファイルを選ぶ → 読み取って確認画面 → 人が直して保存）
3. 一覧（/supplier-invoices）と詳細（/supplier-invoices/[id]）。詳細で明細の品番・費目を直し、覚えた対応で当てた行を「確認済み」にできる
4. 役割と権限に「仕入」の領域を足す（D-8）

作らないもの（§7）: 品番カルテの節・集計の画面（PR-2）／支払予定（PR-3）／発注との照合（PR-4）／対応表の一覧画面（PR-2）／締め（ロック）の判定

## 2. 決めたこと

### P1-D1 器（schema）

★モデル名・列名はこの案。実装時に既存の命名（@map の snake_case・@db 型）にそろえる。

```prisma
/// B-212: 仕入先・工場・外注先などから受け取った請求書（1書類＝1行）
model SupplierInvoice {
  id                 String   @id @default(uuid())
  companyId          String   @map("company_id")
  invoiceNumber      String   @map("invoice_number") @db.VarChar(50)        // 社内の番号 SIV-2026-0001
  counterpartType    CounterpartType @map("counterpart_type")              // SUPPLIER / FACTORY / CONTRACTOR / OTHER
  counterpartId      String?  @map("counterpart_id")                       // マスターに当たったときだけ
  counterpartNameRaw String   @map("counterpart_name_raw") @db.VarChar(255) // CSV の相手先名（読み取ったまま）
  counterpartCodeRaw String?  @map("counterpart_code_raw") @db.VarChar(50)  // CSV の相手先コード（B-070）
  counterpartCategoryRaw String? @map("counterpart_category_raw") @db.VarChar(20) // CSV の相手先区分
  registrationNumber String?  @map("registration_number") @db.VarChar(20)  // 登録番号 T+13桁
  documentType       String   @map("document_type") @db.VarChar(50)
  documentNumber     String   @map("document_number") @db.VarChar(100)
  periodMonth        String   @map("period_month") @db.VarChar(7)          // YYYY-MM（D-3）
  issueDate          DateTime? @map("issue_date") @db.Date
  closingDate        DateTime? @map("closing_date") @db.Date
  dueDate            DateTime? @map("due_date") @db.Date
  subtotal           Decimal? @db.Decimal(15, 2)
  taxAmount          Decimal? @map("tax_amount") @db.Decimal(15, 2)
  totalAmount        Decimal  @map("total_amount") @db.Decimal(15, 2)
  currency           Currency @default(JPY)
  postingType        SupplierInvoicePostingType @map("posting_type")       // COUNTED / REFERENCE（D-4）
  pairedDocumentNumber String? @map("paired_document_number") @db.VarChar(100) // 参照の書類が含まれる一括請求書
  source             SupplierInvoiceSource @default(B070_CSV)
  importBatchId      String?  @map("import_batch_id")                      // 1回の取り込みで共通の uuid
  importFileName     String?  @map("import_file_name") @db.VarChar(255)
  sourceFileName     String?  @map("source_file_name") @db.VarChar(255)    // 原本 PDF の名前（CSV の原本ファイル）
  notes              String?  @db.Text
  createdByUserId    String?  @map("created_by_user_id")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")
  deletedAt          DateTime? @map("deleted_at")
  lines              SupplierInvoiceLine[]
  @@unique([companyId, invoiceNumber])
  @@index([companyId, periodMonth])
  @@index([companyId, counterpartType, counterpartId])
  @@index([companyId, documentNumber])
  @@map("supplier_invoices")
}

/// B-212: 受け取った請求書の明細
model SupplierInvoiceLine {
  id                String   @id @default(uuid())
  supplierInvoiceId String   @map("supplier_invoice_id")
  lineNo            Int      @map("line_no")
  slipDate          DateTime? @map("slip_date") @db.Date
  slipNumber        String?  @map("slip_number") @db.VarChar(100)
  targetRaw         String?  @map("target_raw") @db.VarChar(255)          // 投入先（読み取ったまま）
  itemCodeRaw       String?  @map("item_code_raw") @db.VarChar(100)
  itemName          String?  @map("item_name") @db.VarChar(255)
  quantity          Decimal? @db.Decimal(15, 4)
  unit              String?  @db.VarChar(20)
  unitPrice         Decimal? @map("unit_price") @db.Decimal(15, 4)
  amount            Decimal  @db.Decimal(15, 2)                            // 金額（税抜・外貨はそのまま D-7）
  taxCategory       String?  @map("tax_category") @db.VarChar(20)
  productId         String?  @map("product_id")
  matchStatus       SupplierInvoiceMatchStatus @map("match_status")
  matchedBy         SupplierInvoiceMatchSource? @map("matched_by")
  costCategoryId    String?  @map("cost_category_id")
  packageCount      Int?     @map("package_count")                         // 件数（D-6）
  pieceCount        Int?     @map("piece_count")                           // 枚数
  weightKg          Decimal? @map("weight_kg") @db.Decimal(10, 3)          // 重さ
  sourcePage        Int?     @map("source_page")
  memo              String?  @db.Text
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  supplierInvoice   SupplierInvoice @relation(fields: [supplierInvoiceId], references: [id], onDelete: Cascade)
  @@index([supplierInvoiceId, lineNo])
  @@index([productId])
  @@index([costCategoryId])
  @@map("supplier_invoice_lines")
}

/// B-212 D-5: 人が当てた対応（相手先・品番）を覚える
model SupplierInvoiceMatchRule {
  id                  String   @id @default(uuid())
  companyId           String   @map("company_id")
  ruleType            SupplierInvoiceRuleType @map("rule_type")            // COUNTERPART / PRODUCT
  scopeCounterpartType CounterpartType? @map("scope_counterpart_type")    // PRODUCT のときの相手先（D-5 相手先ごと）
  scopeCounterpartId  String?  @map("scope_counterpart_id")
  sourceKey           String   @map("source_key") @db.VarChar(255)         // 正規化した文字（P1-D4）
  targetCounterpartType CounterpartType? @map("target_counterpart_type")  // COUNTERPART のとき
  targetId            String   @map("target_id")                           // 相手先 id か productId
  createdByUserId     String?  @map("created_by_user_id")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  deletedAt           DateTime? @map("deleted_at")
  @@index([companyId, ruleType, sourceKey])
  @@map("supplier_invoice_match_rules")
}

enum SupplierInvoicePostingType { COUNTED REFERENCE }
enum SupplierInvoiceSource { B070_CSV MANUAL }
enum SupplierInvoiceMatchStatus {
  MATCHED        // 品番に当たり確定（自動の完全一致・人が選んだ・人が確認した）
  RULE_PENDING   // 覚えた対応で当てた。人が確認するまで確定しない（D-5）
  UNMATCHED      // 未一致（候補が複数のときも含む）
  NO_PRODUCT     // 品番なし（その他経費・D-6）
}
enum SupplierInvoiceMatchSource { CLIENT_PRODUCT_CODE PRODUCT_CODE PATTERN_NUMBER RULE MANUAL }
enum SupplierInvoiceRuleType { COUNTERPART PRODUCT }
```

- 外部キーは明細→ヘッダの1本だけ（Cascade）。productId・costCategoryId・counterpartId・targetId は既存の house style どおり scalar（@relation なし）
- 重複の判定（同じ相手先名・書類No・月度の、削除されていない書類）は DB の unique にせず action で行う（論理削除と両立させるため）
- ★counterpartType の OTHER は既存 enum の値をそのまま使う（enum は変更しない）

### P1-D2 migration（shunya-environment-safety-check ルール 00）

1. dev であることを host で確認（hopper.proxy.rlwy.net:12921）
2. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` で、出る DDL が「CREATE TYPE ×5・CREATE TABLE ×3・CREATE INDEX・明細→ヘッダの FK 1本」だけであることを見る。それ以外が1行でも出たら止めて報告
3. `npx prisma db push`（--accept-data-loss は付けない）
4. `prisma/migrations/20261009000000_b212_pr1_supplier_invoices/migration.sql` を手書き（冒頭に意図と非破壊のコメント）。2 の出力と一致することを確かめる
5. dev サーバを再起動する（ルール 00-2）
- ★`prisma migrate dev` / `migrate reset` / `--accept-data-loss` は使わない
- 本番は新しい表だけなので、NOT NULL の列があっても既存の行は無い（ルール 00-1 の心配は無い）

### P1-D3 役割と権限（D-8）

- settings-visibility.ts の AREA_KEYS に `purchases` を足す。AREA_LABELS「仕入」・AREA_HINTS「仕入先・工場の請求書（取り込み・一覧）」・AREA_DEFAULTS `{ STAFF: "hidden" }`（ほかの領域と同じ）・AREA_DENIED_MESSAGES「この役割では仕入を扱えません」
- ★設定の「役割と権限」の表（role-permissions-form）が AREA_KEYS を回して行を作っているかを最初に確かめる。手で列挙しているなら1行足す
- 画面: `src/app/(app)/supplier-invoices/layout.tsx` で `await requireAreaPage("purchases")`
- action: すべての action の先頭で `checkArea("purchases")`
- ナビ: src/components/app-shell/nav-items.ts の「経理」節、「請求」の次に `{ label: "仕入請求書", href: "/supplier-invoices", icon: <lucide の FileInput など>, enabled: true, area: "purchases" }`

### P1-D4 文字の正規化と品番の当て方（D-1・D-5）

純関数を `src/lib/supplier-invoice/match.ts` に置き、テストを付ける。

- `normalizeKey(s)`: NFKC → 大文字 → 空白・全角空白・「-」「‐」「−」「_」「.」を取り除く。空なら null
- `splitTargetTokens(raw)`: 投入先を「/」「(」「)」「（」「）」「、」「,」「空白」で区切った断片＋元の文字全体。例「26A-PT05(25SY-50)」→「26A-PT05(25SY-50)」「26A-PT05」「25SY-50」。「IP-JQ-S-002/003」→ 全体・「IP-JQ-S-002」「003」
- 当てる順（行ごと）:
  1. その相手先の PRODUCT の覚えた対応（sourceKey＝normalizeKey(投入先の全体)）があれば → RULE_PENDING（matchedBy RULE）
  2. 断片ごとに 先方品番 → 社内品番 → パターンナンバー の完全一致（normalizeKey 同士）。最初に当たった段で、当たった品番が1つなら MATCHED（matchedBy は当たった段）。パターンナンバーで複数の品番に当たったら UNMATCHED にして候補を出す（D-1）
  3. どれにも当たらない → 費目が入っている行は NO_PRODUCT、それ以外は UNMATCHED
- 品番の読み込みは、取り込みの1回につき会社の品番（deletedAt null）を1回だけ読み、productCode・clientProductCode・ModelCode.patternNumber の3つの Map（正規化した文字 → productId[]）を作る
- ★覚えた対応（1）を完全一致（2）より先に見るのは、人が直した結果を優先するため。確認が要る印（RULE_PENDING）は残す

### P1-D5 相手先の当て方

- 当てる順: ①COUNTERPART の覚えた対応（sourceKey＝相手先コードがあれば normalizeKey(コード)、無ければ normalizeKey(社名から法人の種類を除いたもの)）→ 要確認 ②仕入先・工場・外注先のコード（supplierCode / factoryCode / contractorCode）と相手先コードの完全一致 ③社名の一致（法人の種類「株式会社」「(株)」「㈱」「有限会社」「(有)」「㈲」「合同会社」を除き normalizeKey で比べる）。複数当たったら人が選ぶ
- 当たらないときは counterpartType=OTHER・counterpartId=null で保存できる（後から詳細で当てる）

### P1-D6 CSV の読み取り（§3-6）

- 画面でファイルを選び、ブラウザで文字として読んで action に渡す（FormData は使わない。月の行数は数百程度）。先頭の BOM（）を取り除き、papaparse（既存の依存）で header: true・skipEmptyLines で読む
- 見出しは次の34列ちょうど（順番は問わない・足りない列があればエラーで止める・知らない列は無視して警告）:
  月度・相手先区分・相手先コード・相手先名・登録番号・書類種別・書類No・発行日・締め日・支払期日・書類税抜・書類消費税・書類税込・通貨・行番号・計上区分・対の書類No・伝票日付・伝票No・投入先・品番・品名・数量・単位・単価・金額税抜・税区分・費目・件数・枚数・重さkg・原本ファイル・原本ページ・メモ
- 値の読み方: 金額・数量はカンマを取り除いて数値（Decimal で保持・float にしない）。数値にならない値（例「35400?」）はその行をエラーにする／日付は YYYY-MM-DD か YYYY/MM/DD／月度は YYYY-MM／計上区分は「計上」「参照」／通貨は Currency の値（JPY・USD など）／費目は費目マスターの categoryCode か categoryName（normalizeKey で比べる）に当てる。当たらなければ空にして警告
- 書類のまとめ方: （相手先名・書類No・月度）が同じ行を1書類にまとめる。同じ書類の中でヘッダの列（相手先コード・書類種別・日付・書類税抜／消費税／税込・通貨・計上区分・対の書類No・原本ファイル）が行によって違えばエラー
- 検算（止めない・赤で出す）: 書類ごとに「明細の金額税抜の合計＝書類税抜」。書類税抜が空なら検算しない
- エラーは「CSV の何行目・何の列・なぜ」を一覧で返す。エラーが1件でもあれば保存させない（確認画面には出す）

### P1-D7 確認画面と保存

- `/supplier-invoices/import`: ①ファイルを選ぶ →「読み取る」 ②確認画面 ③「保存する」
- 確認画面: 書類ごとに1つの塊
  - 塊の頭: 相手先（当てた結果＋選び直す Select・種別で絞る）・書類種別・書類No・月度・税込・通貨・計上／参照の札・検算の結果
  - 明細の表: 行番号・投入先・品名・数量・単価・金額・当て方の札（「自動一致：先方品番」「要確認：覚えた対応」「未一致」「品番なし」）・品番の選び直し（SearchableSelect・候補が複数のときは候補を上に）・費目の Select（品番なしの行）
  - 「要確認をまとめて確認済みにする」ボタン（書類ごと・全体）
  - 重複（同じ相手先名・書類No・月度の書類が既にある）は既定で「取り込まない」にし、理由を出す
  - 外貨の書類は金額の横に通貨を出す（「USD 1,493.80（円は未確定）」・D-7）
- 保存（action `importSupplierInvoices`）
  - 入力は確認画面で人が直した後の内容（書類と明細・人が選んだ品番・費目・相手先・確認済みにした行）
  - 1回の取り込みで importBatchId を1つ作る。書類ごとに採番（SIV-{年}-{4桁}・年は月度の年）・ヘッダと明細を作る。全体を1つの $transaction（P2002 はリトライ・payments.ts と同じ）
  - 人が品番を選んだ行・相手先を選んだ書類は、覚えた対応（MatchRule）を作るか書き換える（同じ scope・sourceKey の行があれば targetId を書き換え、無ければ作る）
  - 人が確認済みにした RULE_PENDING の行は MATCHED（matchedBy は RULE のまま）
  - AuditLog: 書類ごとに CREATE（entityType "SupplierInvoice"・afterData に invoiceNumber・相手先・書類No・月度・税込・通貨・明細の件数・importBatchId）
  - サーバ側で同じ検証をもう一度行う（画面の検証に頼らない）
  - 締め（period-close）の判定は PR-1 では行わない（§7）

### P1-D8 一覧と詳細

- `/supplier-invoices`（一覧）: 手本は /invoices・/payments（search・table・pagination）
  - 絞り込み: 月度・相手先・計上／参照・要確認／未一致がある書類だけ
  - 列: 番号・月度・相手先・書類種別・書類No・税込（通貨）・計上／参照・明細の当て方の件数（一致 n・要確認 n・未一致 n・品番なし n）
  - 下に合計: 計上の書類だけを通貨ごとに合計（参照の書類は合計に入れない・D-4）
  - 右上に「CSV を取り込む」→ /supplier-invoices/import
- `/supplier-invoices/[id]`（詳細）
  - ヘッダ・明細の表（確認画面と同じ見た目）。原本ファイル名・頁を表示
  - 直せるもの: 相手先の当て・明細の品番・費目・要確認の行の確認。直したら覚えた対応も書き換える（D-5）・AuditLog UPDATE
  - 書類の取消（論理削除・理由必須・AuditLog DELETE）。金額・日付など読み取った値は直せない（直すときは取消して取り込み直す・B-225 と同じ考え方）
  - 参照の書類は、対の書類No が同じ月・同じ相手先の計上の書類にあればリンクする

### P1-D9 置き場所（案）

- `src/lib/supplier-invoice/match.ts`（純関数・P1-D4/D5）・`csv.ts`（読み取りと検証・P1-D6）・テスト `*.test.ts`（既存と同じ assert 方式・npx tsx）
- `src/lib/validators/supplier-invoice.ts`
- `src/lib/actions/supplier-invoices.ts`（previewSupplierInvoiceCsv・importSupplierInvoices・listSupplierInvoices・getSupplierInvoice・updateSupplierInvoiceLine・updateSupplierInvoiceCounterpart・confirmSupplierInvoiceLines・cancelSupplierInvoice）
- `src/app/(app)/supplier-invoices/`（layout・page・import/page・[id]/page・_components）

## 3. テスト（npx tsx・最低限）

- normalizeKey: 「２６Ａ－ＴＥ０１」→「26ATE01」／「 ps27ss-ts-01 」→「PS27SSTS01」／空白だけ → null
- splitTargetTokens: 「26A-PT05(25SY-50)」→ 全体・26A-PT05・25SY-50／「IP-JQ-S-002/003」→ 全体・IP-JQ-S-002・003
- 当て方: 先方品番が社内品番より先に当たる／パターンナンバーで2品番に当たると UNMATCHED＋候補2つ／覚えた対応が完全一致より先で RULE_PENDING／費目ありで当たらない行は NO_PRODUCT
- 相手先: コード一致・「㈱滝善」と「株式会社滝善」が一致・当たらなければ OTHER
- CSV: 見出しが1つ足りない → エラー／「35400?」→ その行のエラー／同じ書類で書類税込が行ごとに違う → エラー／明細の合計と書類税抜が違う → 警告（エラーにしない）／BOM 付きでも読める／計上区分「参照」の書類は合計に入らない
- 既存のテスト（invoice-rows・sewing-spec-layout・sewing-spec-format・pe-quotation-data・design-code・pdf-wrap）がすべて通る

## 4. dev の確認（localhost:3001）

dev サーバは本 PR のブランチに git switch し、db push の後に起動し直す。確認用の CSV は `docs/specs/b-212-pr1-sample.csv`（本 PR に同梱・dev 専用の例。dev の品番 SC27-SH04・EB27-PT01・SLC-27SS-U-BT-001 と、当たらない投入先・品番なしの送料・参照の単票・USD の書類を含める）。

1. サイドバー「経理」に「仕入請求書」が出る。設定の役割と権限に「仕入」の行がある。一般スタッフ（dev の確認用ユーザー）では出ず、URL を直接開くと /dashboard に戻る
2. サンプル CSV を取り込む → 確認画面: 先方品番で当たる行が「自動一致：先方品番」、当たらない行が「未一致」、送料の行が「品番なし」＋費目「国際輸送費」、参照の単票に「参照」の札、USD の書類に「円は未確定」
3. 未一致の行で品番を選び、相手先を選んで保存 → 一覧に出る。合計に参照の書類が入っていない
4. 同じ CSV をもう一度取り込む → すべて重複として「取り込まない」になる
5. 投入先だけ同じで書類No を変えた CSV を取り込む → 3 で選んだ品番が「要確認：覚えた対応」で当たる → 確認済みにして保存 → 詳細で「一致」になっている
6. 詳細で書類を取消（理由あり）→ 一覧から消える（取消済みは出さない）
7. 「35400?」の行を混ぜた CSV → エラーの一覧が出て保存できない

## 5. 本番への影響

- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）。migration は新しい表3つと enum 5つだけ（既存の表は変えない）
- 本番で何かを取り込むのは慎太郎さんが運用を始めるとき（D-9）。PR の確認で本番に取り込まない

## 6. 作業の約束

- ブランチ feat/b212-pr1-supplier-invoices（main 8a26e50 から）。PR 必須
- 着手前に repo 全体の lint error 合計を控える
- ゲート: npx tsc --noEmit・触ったファイルの eslint・全体の lint error 合計が着手前から増えていない・テスト全部・npx next build（dev サーバ 3001 を止めて実行し、終わったら .next を消す）
- 通れば commit → push → PR open まで。マージは慎太郎さん
- PR 本文に: migrate diff の出力と手書き migration の一致／確認に使うサンプル CSV の中身の説明／§4 の手順／LINT の BEFORE と AFTER

## 7. この PR で作らないもの

- 品番カルテの「仕入（請求書ベース）」の節・品番別／相手先別／費目別の集計の画面・対応表の一覧画面 → PR-2
- 支払予定（Payment OUTGOING）と期日の知らせ・円の金額の記入 → PR-3
- 発注（PO / WO）との照合 → PR-4
- 締め（SUPPLIER / FACTORY の期間ロック）を仕入の請求書にかけること → v1.1 の §3-5。PR-3 以降で決める
- 原本 PDF のアップロード（原本ファイル名と頁だけ保存）
- 手入力での書類の作成（source MANUAL は器だけ）
- B-070 側の CSV 出力（別プロジェクト）

END-OF-BRIEF-B212-PR1
