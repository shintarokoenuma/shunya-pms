# B-252 実装ブリーフ: 取引先マスターの必須を DB の必須まで緩め、未入力を見える化する（2026-10-02）

- 対象: shunya-pms（~/shunya-production-system）。main 720aa5a 時点の read-only 調査（2026-10-01 23:53 JST）に基づく
- 種別: 実装ブリーフ（仕様確認書は作らない。決定は本書の D 番号が正）
- ライフサイクル: 横断（マスター整備）
- schema 変更: なし／migration: なし

## 0. 背景と決定

- 慎太郎さん（2026-10-01）: 「添付するエクセルから、マスター登録をしたいけど、必項に不明点がある登録先があるんだけど、それを後から登録する方法ってある？」
- 方針の確認に対して「はい、そのように進めましょう。」（2026-10-01 19:36）
- 決定: 画面（validator）の必須を DB の必須（コード・名前・種別）まで緩める。不明な項目は空で保存し、あとで編集画面で埋める。空の項目は一覧と詳細で分かるようにする
- 登録は画面から手で入れる（一括取り込みは作らない）。対象は KKAP+ の取引先 45件（クライアント19・仕入先16・工場8・外注先2）
- 空の項目は帳票にも空欄で出る。その取引先で帳票を出す前に埋める運用（慎太郎さん了承済み）

## 1. 調査で分かったこと（2026-10-01 23:53 JST・main 720aa5a）

- DB で必須: Client＝clientCode・companyName・businessType／Supplier＝supplierCode・companyName／Factory＝factoryCode・factoryName／Contractor＝contractorCode・contractorName・contractType。*Contact は firstName・lastName
- validators/client.ts: phone・email・city・address・assignedToUserId が必須、primaryContactSchema（:90）は姓・名・メール・電話が必須、superRefine（:211〜）で JP のとき postalCode と prefecture が必須
- validators/supplier.ts: supplierPrimaryContactSchema（:57）の姓・名が必須、supplierType は1つ以上、superRefine（:158〜）で JP のとき prefecture と taxId が必須
- validators/factory.ts: primaryContactSchema（:59）の姓・名が必須、factoryTypes は1つ以上、superRefine（:136〜）で JP のとき postalCode・prefecture・taxId が必須
- validators/contractor.ts: primaryContactSchema（:80）は全項目任意、superRefine（:156〜）で JP のとき postalCode・prefecture、JP かつ適格のとき taxId、法人（isIndividual=false）のとき姓・名が必須
- actions: clients.ts は作成時に必ず clientContact.create（:187）して primaryContactId を入れる（:197）。suppliers.ts（:197）・factories.ts（:200）も作成時に必ず *Contact.create。更新は「既存の主担当を update、無ければ create」。contractors.ts（:367〜409）だけは空のときに既存の主担当を論理削除する作り（isPrimary=false・deletedAt）
- 主担当を読む画面: clients/[id]/page.tsx:131 と edit:21 の contacts[0]、suppliers・factories・contractors の [id]/page.tsx と edit の contacts.find(isPrimary)、src/lib/pdf/sewing-spec-data.ts:437・442
- コードは4マスターとも手入力（code-suggest は使っていない）
- 画面の「*」: client-form（電話 :344・メール :357・担当者 :674・姓 :703・名 :714・メール :725・電話 :736）、supplier-form（担当者 :720・姓 :754・名 :767・登録番号の説明 :519）、factory-form（担当者 :830・姓 :864・名 :877・登録番号の説明 :546）、contractor-form（登録番号の説明 :760・法人の注意書き :970・姓 :978・名 :991）。行番号は 2026-10-01 時点。★「担当者 *」が自社担当者か先方担当者の見出しかは実装時に確かめる

## 2. 決定（D 番号）

- D-1 残す必須: コード・名前・種別（Client の業種・Supplier の取扱品目1つ以上・Factory の工場タイプ1つ以上・Contractor の専門分野1つ以上と契約形態）、支払条件の条件付き必須（MONTHLY_CLOSING の締め日・支払月・支払日、DEPOSIT_COD のデポジット比率）。コードの形式（英数字など）もそのまま
- D-2 外す必須: Client＝電話・メール・市区町村・住所1・郵便番号・都道府県・自社担当者・先方担当者の4項目／Supplier＝先方担当者の姓名・都道府県・登録番号／Factory＝先方担当者の姓名・郵便番号・都道府県・登録番号／Contractor＝郵便番号・都道府県・登録番号・法人のときの担当者の姓名
- D-3 形式のチェックは「入力したときだけ」残す: 郵便番号の 3桁-4桁（JP のとき）、メールの形、登録番号の T＋13桁（今チェックしている3マスター）。空ならエラーにしない
- D-4 先方担当者: 姓か名のどちらかが入っていれば主担当の行を作る（片方が空なら空文字で保存。列は NOT NULL のため）。姓も名も空なら作らない。姓も名も空なのにメール・電話・役職・部署・携帯のどれかが入っているときはエラー「担当者の姓か名を入れてください」（path は primaryContact.lastName）。編集で姓も名も空にしたら、既存の主担当を論理削除する（isPrimary=false・deletedAt＝now）。Client は primaryContactId を null にする。contractors.ts の既存の作りに揃える
- D-5 自社担当者（Client.assignedToUserId）: 空なら null で保存（Supplier などの `|| null` と同じ）
- D-6 未入力の判定は純関数1か所: src/lib/master-completeness.ts に4つ（client / supplier / factory / contractor）。返り値は未入力の項目名の配列（日本語）。対象: 電話・メール（Client のみ）・住所（市区町村か住所1のどちらかが空）・郵便番号と都道府県（country が JP のとき）・登録番号（Supplier / Factory / Contractor で、JP かつ isQualifiedInvoiceIssuer のとき）・先方担当者（主担当の行が無いとき。Contractor は法人のときだけ）・自社担当者（Client のみ）
- D-7 表示: 一覧の名前の横に小さく「未入力 N」（N＝項目数・項目名は title 属性）。詳細のヘッダの下に「未入力: 電話・メール・…」と編集画面へのリンク。0 件なら何も出さない。一覧の取得で主担当の有無が分からない場合は、主担当を数える select を足す（companyId と deletedAt: null を手書き）
- D-8 画面の文言: 外した項目のラベルの「*」を外す。登録番号の説明は「T + 13桁の数字。分からなければ空で保存し、あとから入力できます」に揃える。外注先の法人の注意書き（:970）は「法人の場合は主担当者の姓・名を入れてください（あとからでも入力できます）」に変える。新規作成の画面の上に1行「分からない項目は空のまま保存し、あとから編集できます」
- D-9 読み手: 主担当の無い取引先で、4マスターの詳細・編集画面、縫製仕様書・発注書・作業発注・請求書・納品書の PDF が落ちないこと。contacts[0] / find(isPrimary) の後の参照に optional chaining を入れ、表示は「—」。★帳票側で主担当や住所を非 null 前提で読んでいる箇所を grep で洗い、該当があれば同様に守る
- D-10 範囲外: コードの自動採番・一括取り込み・選択肢の追加（2026-10-01 に案B＝近い選択肢に寄せる）・支払条件の必須の見直し・B-241（プリセットの選択中表示）

## 3. 変えるファイル（見込み）

- src/lib/validators/client.ts・supplier.ts・factory.ts・contractor.ts（D-2・D-3・D-4 のエラー）
- src/lib/actions/clients.ts・suppliers.ts・factories.ts（D-4・D-5。contractors.ts は確認のみ）
- src/lib/master-completeness.ts（新規・D-6）
- 4マスターの *-table.tsx と [id]/page.tsx（D-7・D-9）、[id]/edit/page.tsx（D-9）、*-form.tsx と new/page.tsx（D-8）
- 帳票の読み手（D-9 の grep で該当があったものだけ）

## 4. 確認（dev・localhost:3001・慎太郎さん）

1. クライアントを「コード・会社名・業種・支払条件（月末締め翌月末払い）」だけで保存できる → 一覧に「未入力」、詳細に未入力の一覧が出る
2. そのクライアントを編集して電話を入れて保存 → 未入力の数が1つ減る
3. 仕入先を先方担当者の姓名を空で保存できる → 詳細の担当者が「—」で落ちない
4. 郵便番号に「12345」と入れると形式のエラーが出る（形式チェックは残る）
5. 既存の取引先（担当者あり）の詳細・編集が今までどおり開き、保存しても担当者が消えない

END-OF-B252-BRIEF
