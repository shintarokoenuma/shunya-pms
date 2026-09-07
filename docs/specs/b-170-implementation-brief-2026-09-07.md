# B-170 実装ブリーフ (2026-09-07)

- 種別: implementation brief
- 根拠: docs/specs/b-170-client-name-mapping-spec-confirmation-v1_0-2026-09-07.md（§5 データモデル・§6 画面）
- コード実測: 2026-09-07 read-only recon（BLOCK-I・main HEAD aaf4bb9 時点）
- ★本ブリーフは v1.0 で確定した内容だけを実装対象とする。**設計の再検討はしない。** 実装中に設計上の疑問が出たら、手を止めて慎太郎さんに確認する
- 対象ブランチ: feature/b-170-client-color-name（main 直 push 禁止・migration を含むため PR 必須）

---

## 0. このPRでやること・やらないこと

### やること

1. ProductColorway に clientColorName（先方色名）を1列追加する
2. その migration を1本作る（ADD COLUMN・NOT NULL なし・DEFAULT なし＝非破壊）
3. Sku.clientSkuCode に休眠コメントを入れる（列定義は変えない・migration に出ない）
4. validator に clientColorName を足す
5. action（型・select・create・update・変更履歴）に clientColorName を通す
6. カラーウェイの入力フォームと一覧表示に先方色名を出す

### やらないこと（行き先を明記）

| やらないこと | 理由 | 行き先 |
|---|---|---|
| 先方コードの表記ゆれの正規化・文字列照合 | v1.0 §7 で B-149 へ移管済み | B-149 |
| 対応が付かない行の突き合わせ画面 | 同上 | B-149 |
| 専用オーダーページでの未登録品番・未登録配色の非表示 | 先方ページ自体がまだ無い | B-171 |
| 未入力の能動的な警告（バナー・件数バッジ・公開前チェック） | 警告が効くのは先方ページで非表示になる結果があってこそ（§5） | B-171 |
| 先方の色コード列 | v1.0 Q3 で「色名だけ」と確定 | 必要になれば非破壊で追加 |
| 品番×クライアントの新テーブル | v1.0 Q1 で不要と確定 | — |
| サイズの対応表 | v1.0 §8 でスコープ外 | B-195 |

---

## 1. 手本にする既存実装（★推測で書かない）

**BomItemColorway.supplierColorName が「任意の外部色名をカラーウェイ単位で持つ」完成形**であり、4層すべてに実装がある。clientColorName はこれを ProductColorway 側に写す。

| 層 | 手本の実物 |
|---|---|
| validator | src/lib/validators/bom-item-colorway.ts:38（8行目に「supplierColorName は任意メモ」のコメント） |
| action | src/lib/actions/bom-item-colorways.ts:28（型）／64（select）／73（返却）／131（trim）／170・196（書き込み）／181・185（変更履歴） |
| UI | src/app/(app)/products/_components/bom-section.tsx:115（型）／1261（初期値） |

★**特に重要なのが bom-item-colorways.ts:131 と 170/196 の組み合わせ**である。

    const name = data.supplierColorName.trim()
    ... data: { supplierColorCode: code, supplierColorName: name || null }

trim してから `name || null` で**空文字を null に落としている**。clientColorName も必ず同じにする。空文字と null が混在すると「未登録」の判定が2通りになり、v1.0 §6-2 の「未登録の配色は先方ページに出さない」がどちらか一方でしか効かなくなる。

同時に、**追加先の ProductColorway 側では colorwayName が同じ4層を通っている**ので、置き場所はそれに倣う。

| 層 | colorwayName の実物 |
|---|---|
| validator | src/lib/validators/product-colorway.ts:24 |
| action | src/lib/actions/product-colorways.ts:26（型）／52・87（select）／153・172・242（create/update）／259・266（変更履歴） |
| UI | src/app/(app)/products/_components/colorway-section.tsx:148（一覧表示）／267（新規の初期値）／289（編集時の流し込み）／372（input name） |

**要するに「supplierColorName の書き方」で「colorwayName と同じ箇所」に足す。**

---

## 2. 変更点（この順で進める）

### 2-1. prisma/schema.prisma（2箇所・migration に出るのは (a) だけ）

**(a) ProductColorway に1列追加。** colorwayName の直後・colorId の前に置く。

    clientColorName String? @map("client_color_name") @db.VarChar(100) // 先方色名（B-170）。クライアントが呼ぶ配色名。未登録可・空文字は保存せず null にする

- 長さ 100 は BomItemColorway.supplierColorName に合わせた（v1.0 §5-1）
- nullable。既存行はすべて null＝未登録で始まる

**(b) Sku.clientSkuCode の行末コメントを差し替える。** 現物は次のとおり（BLOCK-I §6 で実測）。

    clientSkuCode String? @map("client_sku_code") @db.VarChar(100) // 先方SKUコード

コメントを次に差し替える。**列の型・属性・@map は1文字も変えない。**

    clientSkuCode String? @map("client_sku_code") @db.VarChar(100) // 先方SKUコード。★未使用（src 参照ゼロ・2026-09-07 実測）。B-170 では使わない（SKU 単位では粒度が細かすぎるため、品番＝Product.clientProductCode・配色＝ProductColorway.clientColorName で持つ）。廃止せず残置（v1.0 Q5）

★**(b) が migration に現れないことを確認すること。** 現れたら列定義を触ってしまっている。止めて差分を見直す。

### 2-2. migration（1本）

- 命名は直近の慣習に合わせる（実測: 20260819000000_b167_b168_so_item_yield）
- 名前: 20260907000000_b170_product_colorway_client_color_name
- 期待する SQL は次の1文だけ

    ALTER TABLE "product_colorways" ADD COLUMN "client_color_name" VARCHAR(100);

★**停止条件**: 生成された migration の SQL に、上記以外の DDL が1行でも含まれていたら止める。他テーブルへの ALTER や DROP が出るのは schema と DB のドリフトの兆候であり、B-170 とは無関係の変更を巻き込むことになる。
★NOT NULL を付けない。DEFAULT を付けない。既存行は null のままでよい。

### 2-3. validator（src/lib/validators/product-colorway.ts）

- colorwayName（24行目）の定義の隣に clientColorName を足す
- **任意入力**。bom-item-colorway.ts:38 の supplierColorName の定義をそのまま倣う
- 最大長は 100（schema と一致させる）

### 2-4. action（src/lib/actions/product-colorways.ts）

colorwayName が出てくる箇所と同じ5種類に clientColorName を通す。

1. 型定義（26 付近）に clientColorName を追加
2. select（52・87）に clientColorName を追加
3. create（153 付近）で保存。★trim してから `|| null`
4. update（172・242 付近）で保存。★同上
5. 変更履歴（259・266 付近）に旧値・新値を載せる

★**4 の update を忘れやすい。** create だけ通すと「登録はできるが直せない」状態になる。

### 2-5. UI（src/app/(app)/products/_components/colorway-section.tsx・583行）

1. 一覧表示（148 付近）: colorwayName の隣に先方色名を出す。**未登録の行がひと目で分かるようにする**（v1.0 §6-2 の警告の土台になる）
2. 新規フォームの初期値（267 付近）に clientColorName: "" を追加
3. 編集時の流し込み（289 付近）に editing.clientColorName を追加
4. 入力欄（372 付近の input name="colorwayName" の隣）に name="clientColorName" を追加。ラベルは「先方色名」

★型の追加が必要なら src/lib/types/sku.ts:12 の周辺も見る（colorwayName がそこに居る）。ただし **SKU 経由で先方色名が要るかは v1.0 で決めていない**ので、型を広げる必要が出たら手を止めて確認する。勝手に広げない。

---

## 3. dev での動作確認（localhost:3001 / dev DB = hopper.proxy.rlwy.net:12921）

★**本番では確認しない。** マージ＝Railway の main 自動デプロイ＝本番反映（不可逆）。

**手順0（確認手順を実行する前に必ず）**: dev に配色データがあるかを read-only で調べる。ProductColorway が0件なら、確認のしようがないので先に品番と配色を1つ作る。

1. 対象ブランチに git switch してから PORT=3001 npm run dev を起動する
2. 品番カルテを開き、カラーウェイセクションに「先方色名」欄が出ること
3. 新規カラーウェイを先方色名ありで作成 → 一覧に出ること
4. 新規カラーウェイを**先方色名なし**で作成 → エラーにならず、一覧で未登録と分かること
5. 既存カラーウェイを編集して先方色名を入れる → 保存され、再読込後も残ること（★update の確認）
6. 先方色名を**空にして保存** → DB に空文字ではなく null が入ること（★2-1 の正規化の確認）
7. 複合色名（例: BLACK×襟BLUEDENIM）が入ること（実データにこの形がある・v1.0 §5-1）
8. 100文字ちょうどが通り、101文字が validator で弾かれること
9. 変更履歴に旧値・新値が残ること
10. 既存の品番・発注・見積の画面が壊れていないこと（ProductColorway は10ファイルで現役）

---

## 4. PR の切り方

1本にまとめる。schema・migration・validator・action・UI は分けても互いに動かないため。

- ブランチ: feature/b-170-client-color-name
- 型・lint がクリーンなら commit → push → PR open まで自走してよい
- **マージは慎太郎さんが握る**（shunya-git-workflow）
- PR 作成後は shunya-pr-url-checklist に従い、①ローカル確認 localhost:3001 ②GitHub PR URL ③マージ後の本番確認 の3点を提示する

---

## 5. 未入力警告の切り分け（2026-09-07 確定）

**決定（2026-09-07 慎太郎さん）: 本PRは「一覧で未登録と分かる」ところまで。能動的な警告は B-171 と同時。**

- **本PRの範囲** … §2-5 の1（カラーウェイ一覧で、先方色名が未登録の行がひと目で分かる表示）。ここまで
- **本PRの範囲外** … 「先方色名が未入力の配色が N 件あります」といった能動的な警告バナー・件数バッジ・公開前チェック
- 理由 … 警告が効くのは「先方ページに出ない」という結果があってこそ。先方ページ（B-171）が無い今は、警告を見ても対処の締め切りが無い

★**B-171 の BACKLOG 定義欄に追記済み**（新規起票はしない。roadmap-audit 提案2 の規律を、番号を増やさずに満たす）。

---

## 6. 実装中に手を止める条件

- migration の SQL に ALTER TABLE product_colorways ADD COLUMN 以外の DDL が出た
- Sku.clientSkuCode の変更が migration に現れた
- 型を src/lib/types/sku.ts まで広げる必要が出た（v1.0 で決めていない）
- v1.0 に書かれていない設計判断を求められた

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-07 | v0.1 | 初版。v1.0 の確定内容と BLOCK-I のコード実測を根拠に、4層の変更箇所・migration の停止条件・dev 動作確認10項目を具体化 |
| 2026-09-07 | v0.1（追補） | §5 を確定に格上げ。未入力警告は「一覧で分かる」まで本PR・能動的な警告は B-171 と同時（慎太郎さん確定）。§0 のやらないこと表に1行追加 |
