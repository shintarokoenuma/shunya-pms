# 仕様確認書 — B-082 + B-090 + B-091 品番カルテ一覧の情報設計（v1.0 確定）

- 種別: 仕様確認書 v1.0（確定・実装ブリーフ着手可）
- 作成日: 2026-09-05
- 対象: B-082（絵型サムネ）／B-090（2段表示・カテゴリ日本語名）／B-091（状態表現）／B-190（アーカイブ既定非表示）
- 上位: ライフサイクル外（横断・UI）。原マイルストーン M1〜M8 のいずれにも属さない
- 起点 commit: e4bada3
- 現物確認: 2026-09-05 15:40-15:58 JST の read-only recon（main `70ce8e0` 時点・DB 非書き込み）
- migration: **なし**
- 根拠:
  - s-1-product-crud-implementation-brief-2026-06-06.md §4 / §9（品番の主従表示ヘルパー・一覧の構成）
  - product-sample-spec-confirmation-v1_0-2026-06-06.md（社内品番が背骨・先方品番は別フィールド）
  - docs/SALES_ORDER_QUANTITY_DESIGN.md §1-2（Sku.productionQuantity は SO 由来）
  - b-168-production-quantity-spec-confirmation-v0_1-2026-08-19.md D-1（量産数量の正は SO 由来に一本化）
  - docs/REFERENCE_INDEX.md（★参考資料の帰属。えにし提案用 UI の扱い）

---

## 0. recon で確定した事実（本書の前提）

main `70ce8e0` の実コード・実 schema から採取した。

- `listProducts`（`src/lib/actions/products.ts:288`）の `where` は **`companyId` と `deletedAt: null` のみが固定**。
  `status` / `brandId` / `categoryId` / `season` はいずれも「指定があれば絞る」任意条件。
  ★したがって**既定では ARCHIVED の品番が一覧に混ざる**。
- 検索は `productCode` / `clientProductCode` / `productName` / `productNameEn` の OR（insensitive）。
- `select` は id / productCode / clientProductCode / productName / productNameEn / brandId /
  categoryId / season / status / `sketchThumbPath`（B-027）。`orderBy` は season desc → productCode asc。
- ブランドとカテゴリは **ID 群でまとめて引いて Map にする方式**
  （`fetchBrandSummariesByIds` / `fetchCategorySummariesByIds`）。N+1 になっていない。
- ★**`CategorySummary` は既に `categoryName` を保持している**（`products.ts:82`
  = id / categoryCode / categoryName / level）。
  一覧が `categoryCode` しか描画していないだけで、**select も DTO も拡張不要**。
  （★引き継ぎメモ 2026-09-05 ④ の「CategorySummary に name を足せば」は誤り。本書で訂正する）
- 一覧の列は8つで、固定幅の合計 834px:
  絵型64 / 品名（可変） / 品番200 / ブランド160 / カテゴリ120 / シーズン90 / ステータス120 / 詳細80。
  可変が品名だけのため、品名が広く他が窮屈に見える。コンテナは `max-w-7xl`（1280px）。
- 絵型サムネは `h-10 w-10`（40px）固定。
- フィルタ UI（`products-search.tsx`）は 検索語 / status / brandId / season の4つ。
  ★**カテゴリのフィルタは無い**（B-028 が別途未着手）。status の既定値は `"all"`。
- `Product` には数量列が実在する:
  `expectedQuantity` / `receivedOrderQty` / `productionQty` / `deliveredQty` / `defectQty` /
  `defectRate` / `grossProfitRate`。★ただし **B-168 で「量産数量の正は SO 由来」と確定済み**であり、
  これらは旧列である。
- ★**採番済みの `productCode` は `categoryId` を変更しても変わらない**（`products.ts:679` のコメント）。
  品番の文字列は「発番時」の属性、カテゴリ列は「現在」の属性で、両者は食い違いうる。
- 品番の表示は主従ヘルパー方式で、`clientProductCode` があれば**先方品番が主表示**になる
  （例 `27S-PT01`）。この行は品番からブランド・シーズン・カテゴリを読み取れない。

## 1. 設計軸

**一覧だけで大枠を把握できること。** 主役は 絵型・品名・品番・ステータス・量産数 の5つ。
分類（ブランド／シーズン／カテゴリ）は主役の座を明け渡すが、**消さない**（§2 P-4 の理由）。

## 2. 確定事項

### P-1 絵型を主役にする（B-082 の案 b）

現行 40px を **96px 級に拡大**し、行を2段構成にする。単純なサムネ拡大（案 a）ではなく
**絵型メインの2段方式（案 b）**を採る。行高は増えるが、コンテナ幅 1280px の中で完結させる。

### P-2 行の2段構成（B-090）

- **1段目**: 絵型（大）／品名／品番／ステータス／量産数
- **2段目**: ブランド ／ シーズン ／ カテゴリ（日本語名）を、1段目より小さい文字で

### P-3 カテゴリは日本語名で出す（B-090）

`categoryCode`（例 `M-TS`）ではなく `categoryName` を表示する。
★`CategorySummary` に既に載っているため、**変更は `products-table.tsx` の表示層のみ**。
`listProducts` の select・DTO・クエリ本数はいずれも不変。

### P-4 分類3列は消さない。ただし2段目に降ろす（B-090）

「品番を見ればシーズンとカテゴリは読める」は**一般には成り立たない**。反証が2つある。

1. 採番済みの `productCode` は `categoryId` を変えても変わらない（`products.ts:679`）。
   品番の文字列は発番時の値であり、現在の属性と食い違いうる
2. 先方品番が主表示の行（例 `27S-PT01`）は、品番から何も読み取れない

したがって列は残す。ただし**読める行では邪魔にならないよう2段目に降ろす**（P-2）。

### P-5 食い違いのバッジ（B-191 を本書で消化）

`productCode` から導かれる分類と、現在の `categoryId` / `season` / `brandId` が**食い違う行にだけ**、
カテゴリ側に小さくバッジを出す。一致する行には何も出さない（普段は無音）。

★先方品番が主表示の行は、社内品番の文字列自体は保持しているため判定は可能。

### P-6 量産数（1列のみ・出どころは SO 由来）

- 出す数量は **量産数の1つだけ**。受注数・納品数・不良率は出さない
  （納品数と不良率は**正が存在しない**。B-106 / B-150 が未実装）
- 出どころは **`Sku.productionQuantity` を品番単位で合計**したもの。
  ★`Product.productionQty` は**使わない**。B-168 で「正は SO 由来」と確定しており、
  旧列を一覧に出すと画面に2つ目の正が生まれるため
- ★**取得方法**: `Product` の select 拡張では出せない（Sku 側の列のため）。
  `prisma.sku.groupBy({ by: ["productId"], _sum: { productionQuantity: true } })` を**1本追加**し、
  `fetchBrandSummariesByIds` / `fetchCategorySummariesByIds` と同じ「ID 群 → Map」の型に揃える。
  **行ごとにクエリを撃たない（N+1 にしない）**
- **合計が 0 の行は `0` ではなく `—` と表示する。** `0` は「量産数ゼロで確定」と読めてしまうため。
  ★量産数が真に 0 の量産は業務上存在しないので、この扱いで実害は出ない
- ★**本番の受注は現在 0 件**のため、当面ほぼ全行が `—` になる。
  これは仕様どおりであり不具合ではない。受注が入り次第、値が出る

### P-7 アーカイブを既定で隠す（B-190）

`status` フィルタの既定値を変え、**ARCHIVED を既定で一覧に出さない**。
フィルタで明示的に選べば表示できる（隠すのであって消すのではない）。

★`where` に固定条件を足すのではなく、**フィルタ既定値の変更で実現する**。
固定条件にすると「アーカイブを見たい」が実現できなくなるため。

### P-8 状態表現は「形」まで。色は今回やらない（B-091）

ステータスの区別に**形（アイコン・枠線・塗り）の差**を導入する。
★**色の体系（B-188）は本書のスコープ外。** 色を触ると `.dark` と色覚多様性の設計が必要になり、
PR が重くなるため分ける。

参考にしてよい実装例は `docs/REFERENCE_INDEX.md` に記載の叩き台 HTML の**状態表現の作法のみ**
（白丸／半分塗り／黒丸／二重丸＋「!」／点線、遅延行は左端の太罫）。
★同 HTML の業務モデル・画面構成は**別案件のもので、参照しない**。

## 3. 触るファイル（予定）

- `src/lib/actions/products.ts` … 量産数の集計を1本追加し、`ProductListItem` に量産数を載せる（P-6）
- `src/app/(app)/products/_components/products-table.tsx` … 2段構成・絵型拡大・カテゴリ日本語名・
  食い違いバッジ・ステータスの形（P-1〜P-5・P-8）
- `src/app/(app)/products/_components/products-search.tsx` … status 既定値（P-7）
- `src/app/(app)/products/_components/labels.ts` … ステータス表現の定数（P-8）

★`prisma/schema.prisma` は触らない。migration は発生しない。

## 4. 動作確認（dev・localhost:3001 / hopper:12921）

1. 一覧が2段で描画され、絵型が拡大されている
2. カテゴリが日本語名で出る（`M-TS` ではなく日本語）
3. 先方品番が主表示の行でも、2段目からブランド・シーズン・カテゴリが読める
4. 品番の文字列と現在のカテゴリが食い違う行にバッジが出る／一致する行には出ない
5. 量産数の列が出る。SO 未成立の品番は `—`（`0` ではない）
6. SO が成立している品番では、量産数が受注由来の値と一致する
7. 既定で ARCHIVED が一覧に出ない
8. status フィルタで ARCHIVED を選ぶと表示される
9. 検索・ブランド・シーズンの既存フィルタが従来どおり効く
10. 一覧の表示件数・ページングが従来どおり

## 5. 実装上の禁止事項

- `prisma/schema.prisma` を変更しない。migration を作らない
- `Product.productionQty` / `receivedOrderQty` / `deliveredQty` / `defectQty` / `defectRate` を
  一覧に出さない（P-6）
- ブランド／シーズン／カテゴリの3列を削除しない（P-4）
- `listProducts` の `where` に ARCHIVED の固定除外を足さない（P-7）
- 行ごとに Sku を引かない（N+1 禁止・P-6）
- 色トークン（`globals.css`）を触らない。色の体系は B-188（P-8）
- 一括操作・カテゴリフィルタを本 PR に混ぜない（§6）
- `git add` は明示的なファイルパスのみ（`-A` / `.` / `--all` は使わない）
- コードを含む変更のため feature ブランチ + PR 必須。main 直 push は禁止

## 6. スコープ外（★その場で B番号を振る）

| 項目 | B番号 | 状態 |
|---|---|---|
| チェックボックスによる一括ステータス変更 | **B-189** | 本書で新規起票・別 PR |
| カテゴリのフィルタ追加 | B-028 | 既存・未着手 |
| セマンティックカラーの体系 | B-188 | 既存・未着手。B-091 の色部分はこちら |
| 進行表ボード（品番×工程マトリクス） | B-096 | 既存・spec 確定済み／実装未着手 |
| サイドバー自動折りたたみ | B-092 | 既存・未着手 |
| モバイル対応 | B-093 | 既存・未着手 |
| 一覧のソート機能 | B-107 | 既存・未着手 |
| 受注前品番の試算数量の供給（`—` を数値にする案） | B-177 | 既存・未着手。★P-6 の `—` を解消したい場合はこちら |

★**納期ガント・不備確認ページは起票しない。** これらは `docs/REFERENCE_INDEX.md` 記載の
えにし提案用 UI の構成であって、shunya-pms の要件として合意されたものではない（慎太郎さん確認 2026-09-05）。

## 7. 確定一覧

| # | 論点 | 確定内容 |
|---|---|---|
| P-1 | 絵型 | 案 b（絵型メインの2段方式）。40px → 96px 級 |
| P-2 | 行構成 | 1段目=絵型/品名/品番/ステータス/量産数、2段目=ブランド/シーズン/カテゴリ |
| P-3 | カテゴリ | 日本語名（`categoryName`）。★表示層のみ・select 不変 |
| P-4 | 分類3列 | 消さない。2段目に降ろす |
| P-5 | 食い違い | 食い違う行にだけバッジ（B-191 を消化） |
| P-6 | 量産数 | `Sku.productionQuantity` の品番合計を1列。groupBy 1本追加。0 は `—`。★当面ほぼ全行 `—` |
| P-7 | アーカイブ | フィルタ既定値で隠す。`where` に固定条件を足さない |
| P-8 | 状態表現 | 形まで。色は B-188 に分離 |

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-05 | v1.0 | 初版確定。2026-09-05 の read-only recon（main 70ce8e0）に基づき P-1〜P-8 を確定。B-189 / B-190 / B-191 を新規起票。★引き継ぎメモ ④ の「CategorySummary に name を足せば」を誤りとして訂正 |
