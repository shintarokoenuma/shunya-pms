# B-109 PR-4 実装ブリーフ（請求書 PDF・納品書 PDF）

- 日付: 2026-09-25
- 対象: B-109 PR-4（仕様確認書 v1.0 §2-7・D-12／addendum v1.0 D-40）。B-108 の納品書 PDF を吸収（v1.0 §0）
- ライフサイクル: 11. 納品（納品書 PDF）／12. 請求（請求書 PDF）
- schema / migration: **なし**（`Invoice.bankInfo` は休眠列＝DDL 適用済み）
- 本番への影響: マージで本番反映。請求書と納品書の詳細画面に PDF ボタンが増える。本番の invoices は 0 件のため、請求書 PDF はまだ出る物が無い
- 参考画面: https://claude.ai/artifact/PoTJZi9FhmoZnACi8B4mbH （請求書 3案＋納品書 1案。**請求書は案A を採用**）

## §0 一次資料

- 慎太郎さん（2026-09-25）:「1. 請求書の紙面は A」
- 慎太郎さん（2026-09-25）: 振込先「みずほ銀行　渋谷中央支店　普通　1176464 株式会社shunya」
- 慎太郎さん（2026-09-25）: 受領印の欄について「スキャンdataを登録できるようにしたい。」→ 受領印を押してもらう欄を紙に置き、スキャンの登録は B-113（納品書の受領確認）で作る（本 PR の対象外）
- 慎太郎さん（2026-09-25）:「２と３を登録できるようにマスター登録できるようにしたい。そこにユーザー登録ページも追加してはどうですか？」→ 順番は「PR-4 が先」を選択。PR-4 は振込先を定数で入れ、設定ページ（自社情報＋振込先＋ユーザー登録）はその後の別 B（締めで BACKLOG を grep して B-205 に追記か新規）
- 仕様確認書 v1.0 §2-7: 納品書 PDF と請求書 PDF を新設・B-086 の方式（プレビュー → 承認後ダウンロード）・発行者ブロック・宛先・明細の形（案A＝1 SKU＝1行）をそろえる。請求書の必須記載＝発行者名・登録番号・取引年月日（納品日）・内容・税率ごとの合計と税額・請求先名・前受金の行
- addendum v1.0 D-40: 納品書に消費税と税込合計を出さない（小計まで）。「★納品書 PDF（PR-4）にも同じ判断が効く」
- addendum v0.2 §4-1（KKAP+ の実物の観察）: 全件「前回御請求額／御入金額／繰越金額／当月お買上げ額／消費税等／今回御請求額」の形。明細に「〔御入金〕振込」の行が入る
- addendum v0.5 §2-5: 請求書 PDF はマイナスの行と、マイナスの合計・今回御請求額をそのまま出す
- read-only recon（2026-09-25 22:47 JST・main 667efe3・dev hopper:12921）: 下の §1

## §1 実測した現状（2026-09-25 recon）

| 項目 | 現状 |
|---|---|
| PDF の3層 | `src/lib/pdf/*-data.ts`（prisma を読み companyId で絞る DTO）→ `*-document.tsx`（react-pdf）→ `render.tsx`（renderToBuffer） |
| 手本の紙面 | `order-document.tsx`（A4・fontSize 9・余白 36/48・左に宛先「〇〇 御中」・右に COMPANY_PROFILE） |
| プレビュー → DL | `src/components/pdf/order-pdf-preview-button.tsx` ＋ `pdf-preview-dialog.tsx`（`usePdfPreview().open(endpoint, [id], fallbackName)` が POST `{ ids }`）。DL 時に `/api/order-pdf-archive` へ `{ kind, ids, stamp }` |
| 控えの保存 | `src/lib/gcs.ts` の `uploadOrderPdf({ kind: "purchase-order" \| "work-order", ... })`。kind は2値固定 |
| PDF ルート | `src/app/api/purchase-orders/pdf/route.ts`（POST・複数を縦積み）／`[id]/pdf/route.ts`（GET） |
| 発行者 | `src/lib/constants/company-profile.ts` の COMPANY_PROFILE（name・postalCode・address・tel・fax・email・taxId）。**振込先は無い** |
| 請求書の発行者欄 | 作成時に issuerName / issuerAddress / issuerPhone / issuerTaxId をスナップショット（`invoices.ts:539〜`） |
| 振込先の器 | `Invoice.bankInfo`（Json?・休眠） |
| 請求書 DTO | `getInvoice`（`invoices.ts`）: items（deliveryNumber / deliveryDate / itemCode / itemName / colorName / size / taxClassification / quantity / unitPrice / subtotal）・payments（期間の窓の入金） |
| ボタンの置き場 | 請求書詳細 `invoices/[id]/page.tsx:31` と `invoice-status-actions.tsx:22` に「PDF は PR-4」のコメント。納品書詳細 `deliveries/[id]/page.tsx:81〜97` の右上 |
| フォント | `fonts.ts`（NotoSansJP サブセット・7466 字）。★※ ～ ① ℃ は無い（shunya-pdf-document §2） |

## §2 決めたこと

| D | 内容 |
|---|---|
| P4-D1 | **用紙は A4 縦**（`size="A4"`）。`wrap={false}` は付けない |
| P4-D2 | **請求書は案A**（参考画面の案A の構造と文言のとおり。§3-1） |
| P4-D3 | **振込先は COMPANY_PROFILE に定数で足す**: `bank: { bankName: "みずほ銀行", branchName: "渋谷中央支店", accountType: "普通", accountNumber: "1176464", accountHolder: "株式会社shunya" }` |
| P4-D4 | **請求書を作るときに振込先を `Invoice.bankInfo` にスナップショットする**（発行者欄と同じ考え・D-35）。PDF は `bankInfo` を読み、null（本 PR より前に作った請求書）なら COMPANY_PROFILE.bank を使う |
| P4-D5 | **発行者欄は請求書のスナップショット列を使う**（issuerName / issuerAddress / issuerPhone / issuerTaxId）。FAX・MAIL はスナップショットが無いので COMPANY_PROFILE から |
| P4-D6 | **登録番号を請求書に載せる**（v1.0 §2-7 の必須記載・D-5）。M-032 の「載せてよいか」はこれで決着。納品書には載せない |
| P4-D7 | **明細は日付順に1本の表**: 請求書明細（納品日）と入金（入金日）を日付で並べる。同じ日は入金を先に。入金の行は品名欄に「〔御入金〕」＋方法（振込 など）、金額欄に入金額（プラスのまま） |
| P4-D8 | **入金の行の出し方（D-35 を守る）**: 期間の窓の入金のうち `createdAt ≤ Invoice.createdAt` で取消されていないものを並べ、**その合計が `paymentReceivedAmount` と一致するときだけ**1件ずつ出す。一致しないとき（発行後に入金を取消した等・B-225）は1行「〔御入金〕期間内の入金合計」に `paymentReceivedAmount` を出す。上の6枠と明細が食い違わないことを優先する |
| P4-D9 | **マイナスの行**（赤伝・前受金充当）は数量・金額にマイナスを付けて出す。色は付けない（白黒印刷で読めるように）。マイナス記号は ASCII の "-" |
| P4-D10 | **取消した請求書**は、タイトルの横に「取消」と出す。**再発行した請求書**は番号の下に「再発行（元: INV-○○）」と出す（修正インボイス＝当初交付分との関連性） |
| P4-D11 | **ドラフトの請求書も PDF を出せる**（送付の前に確認するため）。印は付けない |
| P4-D12 | **納品書 PDF**: 消費税・税込合計は出さない（D-40）。`showAmounts` が false の納品書は 単価・金額・小計 の列を出さない。前受金・充当の行は品名の横に小さく「前受金」「前受金充当」。数量合計は `totalQuantity`（前受金の行を含まない・PR-3）。小計の下に「消費税は合計請求書でまとめて計算します。」（画面と同じ文言）。右下に **受領印の欄**（受領日・受領印の枠） |
| P4-D13 | **取消した納品書**はタイトルの横に「取消」 |
| P4-D14 | **旧データの税額**（DLV-0003〜0009 の tax_amount）は読まない |
| P4-D15 | **ルートは POST `{ ids }` だけ**（`/api/invoices/pdf`・`/api/delivery-notes/pdf`）。単票の GET は作らない。ファイル名は `{番号}_{stamp}.pdf` |
| P4-D16 | **控え**: DL 時に保存する（B-086 と同じ）。`uploadOrderPdf` の kind に `"invoice"` と `"delivery-note"` を足すか、同じ形の関数を足す（既存の GCS のパスの付け方を読んで揃える）。archive ルートは既存を広げてよい |
| P4-D17 | **ボタン**: 請求書詳細に「請求書 PDF」（全状態）、納品書詳細に「納品書 PDF」（全状態）。`OrderPdfPreviewButton` に表示名と kind を渡せるようにして使い回す（PO/WO の見た目は変えない） |
| P4-D18 | **ページ送り**: 明細が1ページに入らないときは次のページに流す。表の見出しは各ページに繰り返す（`fixed`）。フッタに「{番号}　{ページ} / {総ページ}」 |
| P4-D19 | **折り返しに「-」を入れない**（2026-09-26 試し刷りで発見: 「前受金（SO-2026-00-/02）」「BLACK×襟BL-/UEDENIM」）。原因は `fonts.ts` の全帳票共通の `registerHyphenationCallback`（1文字ずつ割る＝折り返し位置にハイフンが付く・B-208）。`fonts.ts` と既存の帳票は変えず、請求書・納品書の document の DB 由来の値を出す `Text` にだけ、要素ごとの `hyphenationCallback`（1文字ごとに空の部分を挟む＝幅 0 の glue で折り返し、ハイフンを付けない）を渡す。試し刷りで "-" の glyph の出現が 5 → 3（文字列中の実際の "-" だけ）になることを確認 |
| P4-D20 | **納品書の品番**: 先方品番（clientProductCode）が無ければ社内品番（Product.productCode）を出す（請求書の itemCode と同じ決め方）。列の見出しは「品番」（2026-09-26 試し刷りで発見: DLV-0012 の Tシャツが空だった） |

## §3 紙面（参考画面の文言をそのまま使う）

### §3-1 請求書（案A）

上から順に:

1. **タイトル行**: 左に「御請求書」（字間を広く）。右に 番号（太字）／「請求日　yyyy/mm/dd」（invoiceDate）／「締日　yyyy/mm/dd（mm/dd〜mm/dd）」（periodEndDate と期間）。取消なら「取消」（P4-D10）、再発行なら番号の下に「再発行（元: INV-○○）」
2. **宛先と発行者**:
   - 左: 「{billToName}　御中」（下線）／ billToAddress（空なら出さない）／「下記のとおりご請求申し上げます。」／「お支払期日　**yyyy/mm/dd**」
   - 右: issuerName（太字）／ issuerAddress ／「TEL: … FAX: …」／「MAIL: …」／「登録番号　T2011001051698」（issuerTaxId）
3. **6枠（横一列・罫線で囲む）**: 前回御請求額／御入金額／繰越金額／当月お買上げ額／消費税等／**今回御請求額**（この枠だけ見出しの背景を少し濃く・金額を太字で「¥」付き）。値は `previousBalanceAmount` / `paymentReceivedAmount` / `carriedForwardAmount` / `subtotal` / `totalTaxAmount` / `totalAmount`
4. **明細の表**: 列は 日付（mm/dd）／伝票番号／品番 / 品名／色・サイズ／数量／単価／金額
   - 納品の行: 日付＝納品日・伝票番号＝納品書番号・「{itemCode}　{itemName}」・「{色名}・{サイズ}」
   - 入金の行: 日付＝入金日・伝票番号＝入金番号・「〔御入金〕振込」（方法の表示名）・数量と単価は空・金額＝入金額
5. **下段（左右）**:
   - 左の枠: 「お振込先」（太字）／「みずほ銀行　渋谷中央支店　普通　1176464」／「口座名義　株式会社shunya」／「恐れ入りますが振込手数料はご負担ください。」
   - 右: 税率ごとの内訳 — 「10%対象」taxableAmount10 ／「消費税（10%）」taxAmount10 ／（8% が 0 でなければ「8%対象」「消費税（8%）」）／「非課税」／「当月合計（税込）」＝ subtotal ＋ totalTaxAmount（太字・上に罫線）
6. **フッタ**: 左に番号、右に「ページ / 総ページ」

### §3-2 納品書

1. **タイトル行**: 左に「納品書」。右に 番号（太字）／「納品日　yyyy/mm/dd」／「受注　SO-○○」（明細に受注があれば。複数なら「、」でつなぐ）。取消なら「取消」
2. **宛先と発行者**:
   - 左: 「{クライアント名}　御中」（下線）／「納品先：{shipToAddress}」／「ご担当：{shipToContact}」（空なら出さない）／「TEL：{shipToPhone}」（空なら出さない）／「下記のとおり納品いたします。」
   - 右: COMPANY_PROFILE の name（太字）・住所・TEL/FAX・MAIL（登録番号は載せない）
3. **明細の表**: 品番（先方品番が無ければ社内品番）／品名／色／サイズ／数量／（showAmounts なら 単価・金額）。前受金の行は品名の横に小さく「前受金」「前受金充当」
4. **下段**:
   - 左: 「数量合計　**N** 枚」（totalQuantity）。前受金の行があれば下に小さく「前受金・充当の行は数量合計に含めません」。clientNotes があれば「備考」として出す
   - 右: showAmounts なら「小計（税抜）」（subtotalAmount・太字）と「消費税は合計請求書でまとめて計算します。」。その下に **受領印の欄**（「受領日　　年　　月　　日」と 20mm 角程度の「受領印」の枠）
5. **フッタ**: 番号とページ

### §3-3 字形（★着手の最初に確かめる）

紙面に置く記号 **〔 〕 ［ ］ ・ 〜 × ¥** が同梱の NotoSansJP にあるかを確かめる。無い字は置き換える（〔〕が無ければ【】、それも無ければ（））。DB の値に ～（U+FF5E）が入っていたら 〜（U+301C）に置き換えて出す。

    cd ~/shunya-production-system
    node -e '
    const fk=require("fontkit");const f=fk.openSync("src/assets/fonts/NotoSansJP-Regular.ttf");
    for (const ch of ["〔","〕","［","］","・","〜","×","¥","※","～","【","】"]) console.log(ch, f.hasGlyphForCodePoint(ch.codePointAt(0)))'

★fontkit が無ければ `node_modules/@react-pdf` 配下の同梱を探す。どちらも無ければ、試し刷りの PDF を目で見て判定する（□ や空白になる字が無いか）。

## §4 変更するファイル

| ファイル | 変更 |
|---|---|
| `src/lib/constants/company-profile.ts` | 型と定数に `bank`（P4-D3） |
| `src/lib/actions/invoices.ts` | 作成時に `bankInfo` をスナップショット（P4-D4）。PDF 用の読み取りは次の data 側で持つ |
| `src/lib/pdf/invoice-data.ts`（新規） | Invoice ＋ items ＋ 納品書番号・納品日（deliveryNoteItemId から）＋ 入金の行（P4-D8）を、companyId・deletedAt で絞って組み立てる |
| `src/lib/pdf/invoice-rows.ts`（新規・純関数）＋ `.test.ts` | 納品の行と入金の行を日付順に並べる／入金の合計と paymentReceivedAmount の突き合わせ（P4-D7・D8）。テストは `npx tsx` で走らせる |
| `src/lib/pdf/invoice-document.tsx`（新規） | §3-1 |
| `src/lib/pdf/delivery-note-data.ts`（新規） | DeliveryNote ＋ items ＋ クライアント名 ＋ 受注番号 |
| `src/lib/pdf/delivery-note-document.tsx`（新規） | §3-2 |
| `src/lib/pdf/render.tsx` | 2つの render 関数（複数を縦積みできる形） |
| `src/app/api/invoices/pdf/route.ts`・`src/app/api/delivery-notes/pdf/route.ts`（新規） | POST `{ ids }`（P4-D15）。auth → data（companyId）→ render |
| `src/lib/gcs.ts`・`src/app/api/order-pdf-archive/route.ts` | 控えの kind を広げる（P4-D16） |
| `src/components/pdf/order-pdf-preview-button.tsx` | 表示名と kind を props で受ける。既定は今と同じ「発注書 PDF」 |
| `src/app/(app)/invoices/[id]/page.tsx`・`_components/invoice-status-actions.tsx` | 「請求書 PDF」ボタン。★「PDF は PR-4」のコメント2か所を消す（後続を語る文はその後続を実装した PR が消す） |
| `src/app/(app)/deliveries/[id]/page.tsx` | 「納品書 PDF」ボタン |

★既存画面の文言: 着手前に `grep -rn -E '後続|未対応|のみ|専用|できません|PR-4|PDF' "src/app/(app)/invoices/" "src/app/(app)/deliveries/"` を出し、PDF が無いことを前提にした文があれば変更点に入れる（recon では上の2か所のコメントのみ）。

## §5 やってはいけないこと

- ★`prisma/schema.prisma` と `prisma/migrations/` に触る（schema 変更ゼロ）
- ★発行済みの請求書の金額を PDF 側で計算し直す（6枠と税の内訳は保存した列をそのまま出す・D-35）
- ★納品書 PDF に消費税・税込合計を出す（D-40）。旧データの tax_amount を読む
- ★紙面の固定文言に ※ ～ ① ℃ を使う（フォントに無い）
- ★発注書 PDF の見た目・ファイル名・控えの保存を変える
- ★`prisma.invoice` / `prisma.deliveryNote` のクエリで `companyId` / `deletedAt` を省く
- ★`git add -A` / `git add .`
- ★open PR の上に積む（着手時に open PR 0 を確かめる）

## §6 確認（dev・http://localhost:3001・★マージ前はローカル。本番では確認しない）

    cd ~/shunya-production-system
    git switch feat/b-109-pr4-pdf
    PORT=3001 npm run dev

dev の素材（2026-09-25 実測）: INV-2026-0001（取消）／0002（ドラフト・赤伝入り −33,000）／0003（ドラフト・前受金 880）。納品書 DLV-0011（前受金の伝票）／0012（Tシャツ＋充当 −400）／0007（赤伝 −30,000）ほか。

| # | 確認 |
|---|---|
| 1 | §3-3 の字形の結果を貼る |
| 2 | INV-2026-0003 の「請求書 PDF」→ プレビュー → 6枠・明細「前受金（SO-2026-0002）」1 × 800・税の内訳 800 / 80・振込先（null のため定数から）・登録番号 |
| 3 | 画面で 葵アパレル 10/06〜10/31 の請求書を作成（INV-2026-0004 になる見込み）→ PDF で 6枠が 880 / 880 / 0 / 1,600 / 160 / ¥1,760。明細に「〔御入金〕振込」880 の行が 10/06 で先頭、Tシャツ 2 × 1,000、充当 -1 × 400 = -400。★DB の `bank_info` に振込先が入っている（read-only SQL） |
| 4 | INV-2026-0002（赤伝入り）で、マイナスの行と今回御請求額 -33,000 がそのまま出る |
| 5 | INV-2026-0001（取消）でタイトルの横に「取消」 |
| 6 | DLV-2026-0012 の「納品書 PDF」→ 税の行が無い・小計（税抜）1,600・「消費税は合計請求書でまとめて計算します。」・数量合計 2 枚・受領印の欄 |
| 7 | DLV-2026-0011（前受金の伝票）で 品名「前受金（SO-2026-0002）」に「前受金」の印・数量合計 0 |
| 8 | 金額を表示しない納品書（無ければ dev で1枚、notes に「[B-109 PR-4 確認用]」を付けて作る）で 単価・金額・小計が出ない |
| 9 | ダウンロード → ファイル名が `{番号}_{yyyyMMdd-HHmmss}.pdf`。控えの保存が失敗してもダウンロードは止まらない |
| 10 | 発注書 PDF（PO/WO の詳細）が今までどおり出る（回帰） |
| 11 | 明細が多い請求書（無ければ確認を省き、その旨を書く）で2ページ目に表の見出しが繰り返される |

## §7 Git / PR

- ブランチ: `feat/b-109-pr4-pdf`（main 直 push 禁止）
- 本ブリーフを `docs/specs/b-109-pr4-implementation-brief-2026-09-25.md` として同じ PR に入れる
- 型（`npx tsc --noEmit`）・触ったファイルの lint がクリーンなら commit → push → PR open まで自走してよい。全体 lint は既存の 11 errors から増えていないこと。マージは慎太郎さん
- commit の末尾:

      Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
      Claude-Session: https://claude.ai/code/session_01Q6Qp4UbUhCG1xEhDFqfqev

- PR 本文の末尾:

      🤖 Generated with [Claude Code](https://claude.com/claude-code)

      https://claude.ai/code/session_01Q6Qp4UbUhCG1xEhDFqfqev

## §8 今回やらないこと（行き先）

| 内容 | 行き先 |
|---|---|
| 自社情報・振込先を画面から登録・変更する「設定」ページ（＋ユーザー登録） | 締めで BACKLOG を grep（B-205 に追記か新規）。PR-4 の後 |
| 受領印を押した納品書のスキャンを登録する | B-113（`DeliveryNote.receiptSignatureUrl` ほか休眠列が候補） |
| 一覧から複数を選んでまとめて PDF | 後段（ルートは複数 id を受けられる形にしておく） |
| 英語版の請求書・納品書 | B-110 |
| 締め（期間のロック） | PR-6（B-123） |

END-OF-BRIEF-B109-PR4
