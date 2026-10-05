# B-208 / B-250 実装ブリーフ — PDF の字の欠けと分綴の「-」、発注書の C# 列の幅（2026-10-05）

- 対象: shunya-pms・main cc9d7e4 を recon（2026-10-05 11:10・11:15 JST・read-only と一時フォルダでの試し）して作成
- 根拠: BACKLOG B-208（同梱フォントの字の欠け・1文字ごとの分綴で「-」が入る）・B-250（発注書・作業発注の PDF の C# 列が狭く色名が割れる）
- 慎太郎さんの判断: 2026-10-05 11:14「１でお願いします。」（字の欠けは、フォントを縮小しない全字版に差し替える。置き換えで逃げる案は採らない）
- 範囲: src/assets/fonts/ のフォント2本の差し替えと OFL.txt の追加、src/lib/pdf/fonts.ts の分綴1行、src/lib/pdf/order-document.tsx の列幅。schema・migration・action・validator は触らない
- 重要度: 工場・お客様に渡す紙に出る（縫製仕様書・発注書・見積書・請求書・納品書の全部に効く）

## 1. 現状（main cc9d7e4 の現物）

- フォント: src/assets/fonts/NotoSansJP-Regular.ttf・NotoSansJP-Bold.ttf（各 約2.36MB・6,886 字の縮小版）。fonts.ts が process.cwd()/src/assets/fonts から登録（family 名 NotoSansJP）
- 欠けている字（fontTools で確認）: ※・～（U+FF5E）・①②③・℃・㎝・→。ある字: 〜（U+301C）・×・÷・・・ー
- 発注書の固定文言「※ 金額未定の明細は合計に含まれません。」（order-document.tsx）の ※ も欠けて出ている見込み
- 欠けた字の置き換えは、請求書・納品書（pdfText・～→〜のみ・src/lib/pdf/invoice-rows.ts）と縫製仕様書（sewing-spec-data.ts の自前の pdfText）だけ。発注書・見積書・量産見積書は無し
- 分綴: fonts.ts の Font.registerHyphenationCallback((word) => Array.from(word))。1文字ごとに折ってよい設定で、折った位置に「-」が入る
- Text ごとの上書きは請求書・納品書だけ（invoice-rows.ts の NO_HYPHEN_BREAK = 文字の間に空の区切りを挟んで「-」を出さない／NO_BREAK = 語を割らない）。発注書・見積書・量産見積書・縫製仕様書は全体の設定のまま
- 発注書の列幅（order-document.tsx の styles）: cName 26%・cCode 15%・cColor（C#）11%・cQty 11%・cUnit 11%（paddingLeft 12）・cPrice 13%・cSub 13%。C# の中身は formatColorCode(it.colorCode)（B-248）。明細行は wrap={false}
- 全字版の入手（11:15 に一時フォルダで試し、repo には入れていない）: Google Fonts 公式 GitHub の ofl/notosansjp/NotoSansJP[wght].ttf（可変フォント・9.59MB・軸 wght 100〜900）と OFL.txt を取得できた。fontTools の instancer で wght 400 / 700 に固定した版は各 約5.77MB・16,732 字で、※ ～ 〜 ①②③⑩ ℃ ㎝ × ÷ → ・ ー 髙 﨑 がすべてある

## 2. 決定事項

- D-1 フォントを全字版に差し替える: Google Fonts 公式 GitHub の可変フォントから、fontTools の instancer で wght 400（Regular）と 700（Bold）の固定版を切り出し、今と同じファイル名 src/assets/fonts/NotoSansJP-Regular.ttf・NotoSansJP-Bold.ttf に上書きする。fonts.ts のファイル名・family 名は変えない
- D-2 ライセンス: 同じ場所から取得した OFL.txt を src/assets/fonts/OFL.txt に置く（SIL Open Font License・同梱と再配布が可）。取得元 URL と可変フォント・切り出した2本の sha256 を PR 本文に書く
- D-3 分綴: fonts.ts の全体の設定を、請求書の NO_HYPHEN_BREAK と同じ形（文字の間で折れるが「-」は出さない）に変える。式は fonts.ts に直接書く（invoice-rows.ts を import しない・循環を作らない）。請求書・納品書の Text ごとの指定はそのまま残す
- D-4 品番などのコードに NO_BREAK は本 PR では足さない。折り返しの「-」が消えるので、まず dev の PDF で見え方を確かめる。コードの途中で折れて読みにくい帳票があれば、列幅を確保してから別の PR で NO_BREAK を足す（shunya-pdf-document スキル §2「コードを折らないなら列幅を先に確保する」）
- D-5 発注書の C# 列を広げる: cColor 11% → 15%。原資は cName 26% → 24%・cUnit 11% → 9%（合計 100% のまま）。単位の列は「一式・枚・m・反」など短い字だけ。cUnit の paddingLeft 12 は数量との間隔なので残す
- D-6 置き換え処理（pdfText）はそのまま残す（全字版では ～ も出るが、害はない）。縫製仕様書の固定文言で ※ を避けた件（B-054 addendum v0.3 D-42）も本 PR では戻さない
- D-7 変えないもの: 帳票の文言・行の並び・ページの寸法・ほかの列幅・データの取り方

## 3. 確認（dev・localhost:3001）

dev サーバは本 PR のブランチで起動し直してから見る（フォントを差し替えるため、Cmd+Shift+R ではなく起動し直す）。

1. 発注書（仕入 PO）: C# に色名（例「カーキグリーン」）が入った明細のある発注書の PDF を開く。C# が1行に収まる。品名・品番の折り返しに「-」が出ない。「※ 金額未定の明細は合計に含まれません。」の ※ が出る（金額未定の明細がある発注書のとき）。dev に色名の明細が無ければ、DRAFT の発注書の1行の C# を「カーキグリーン」にして確かめ、確かめたら元に戻す
2. 作業発注（WO）の PDF: 同じく「-」が出ない
3. 縫製仕様書 PDF: 付属・縫製指示の長い文の折り返しに「-」が出ない。太字（見出し・希望納期）が太字のまま
4. 見積書・量産見積書の PDF: 折り返しに「-」が出ない
5. 請求書・納品書の PDF: 今までと同じ見た目（すでに「-」は出ていない）
6. 各 PDF の大きさ（ダウンロードしたファイルのサイズ）を1つずつ控える。使った字だけを埋め込む仕組みのため大きく増えない見込み。1MB を大きく超えるものがあれば報告

## 4. 本番への影響

- マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）。全帳票の見た目が変わる（字が欠けなくなり、折り返しの「-」が消え、発注書の列幅が変わる）。データは変わらない。migration なし
- repo にフォント2本（各 約5.8MB）が入る。git の履歴には旧版（各 約2.4MB）も残る

## 5. 作業の約束

- ブランチ fix/b208-b250-pdf-font-hyphen（main cc9d7e4 から）。PR 必須
- npx tsc --noEmit・触ったファイルの eslint・repo 全体の lint error 合計が着手前から増えていないこと・PDF のテスト（npx tsx で invoice-rows.test.ts・sewing-spec-format.test.ts・pe-quotation-data.test.ts）・npx next build（dev サーバ 3001 を止めて実行し、終わったら .next を消す。dev の起動し直しは慎太郎さん）が通れば commit → push → PR open まで。マージは慎太郎さん
- 本書を docs/specs/b-208-b-250-implementation-brief-2026-10-05.md として PR に同梱する（ナレッジ claude/b-208-b-250-implementation-brief-2026-10-05.md と同じ本文）

## 6. 本 PR で作らないもの

- 品番などのコードを途中で折らない指定（NO_BREAK）を発注書・見積書・縫製仕様書に足すこと（D-4・dev の PDF を見てから）
- 縫製仕様書で ※ を避けた固定文言を戻すこと（D-6）
- 多言語（中国語・ベトナム語）のフォント（B-151）。Noto Sans JP には簡体字・ベトナム語の一部の字が無い可能性があり、そのときに別に決める
- B-249（デザイン番号の D/#）・B-251（BOM の C/# の残り）

END-OF-BRIEF-B208-B250
