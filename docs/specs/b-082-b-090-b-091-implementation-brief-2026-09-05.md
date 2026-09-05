# 実装ブリーフ — B-082 + B-090 + B-091 + B-190 + B-191 品番カルテ一覧

- 作成日: 2026-09-05
- 上位: `docs/specs/b-082-b-090-b-091-product-list-spec-confirmation-v1_0-2026-09-05.md`（v1.0 確定）
- 起点 commit: 7f23fef
- ブランチ: `feature/b-082-b-090-b-091-product-list`（★コードを含むため feature + PR 必須。main 直 push 禁止）
- migration: **なし**（`prisma/schema.prisma` を変更しない）

★本書は上位 spec を置き換えない。確定内容は spec の P-1〜P-8 が正であり、本書は実装手順のみを定める。

---

## 0. 着手前に必ず読むもの

1. 上位 spec の §0（recon で確定した事実）と §2（P-1〜P-8）
2. `src/lib/actions/products.ts` の `listProducts`（288 行〜）と、その周辺の
   `fetchBrandSummariesByIds` / `fetchCategorySummariesByIds`
3. ★**社内品番（`productCode`）の採番ロジック本体**（同ファイル内。679 行付近のコメントを含む）
4. `src/app/(app)/products/_components/products-table.tsx` / `products-search.tsx` / `labels.ts`

★1行目に `gh pr list --state open` を実行し、同じ課題の PR が既に open でないことを確認する。
open なら実装せず停止して報告する。

## 1. スコープ

含む: P-1 絵型拡大 ／ P-2 2段構成 ／ P-3 カテゴリ日本語名 ／ P-4 分類3列を2段目へ ／
P-5 食い違いバッジ ／ P-6 量産数1列 ／ P-7 アーカイブ既定非表示 ／ P-8 状態の形

含まない: 一括操作（B-189）／カテゴリフィルタ（B-028）／色の体系（B-188）／ソート（B-107）。
**これらのコードを1行も書かない。**

## 2. 実装順（この順で進める）

### 手順1: 量産数の供給（P-6・サーバ側）

`listProducts` に、品番ごとの量産数合計を得る処理を **1本だけ**追加する。

- `prisma.sku.groupBy({ by: ["productId"], _sum: { productionQuantity: true }, where: { ... } })`
- ★`where` には **`companyId` を必ず含める**（マルチテナントの鉄則）。
- ★`Sku` に論理削除列（`deletedAt`）があるかを**実測してから** `where` に入れる。
  あるのに入れ忘れると削除済み SKU が合計に乗る。無いのに書くと型エラーになる。
- 対象は `rows` から取った `productId` の集合のみ（`{ in: ids }`）。全件を引かない。
- 結果を `Map<string, number>` にして、ブランド・カテゴリと同じ形で行に載せる。

★**行ごとにクエリを撃たない。** 既存の2つの `fetchXxxByIds` と同じ「ID 群 → Map」の型に揃えること。

`ProductListItem` に量産数を1つ足す。**`Product` の select は拡張しない**
（量産数は `Sku` 側の値であり、`Product` からは取れない）。

### 手順2: カテゴリ日本語名（P-3・表示のみ）

`products-table.tsx` のカテゴリ列を `categoryCode` から `categoryName` に変える。

★`CategorySummary` は既に `categoryName` を持っている（`products.ts:82`）。
**`listProducts` の select・DTO・クエリ本数はいずれも変更しない。**

### 手順3: 2段構成と絵型拡大（P-1・P-2・P-4）

- 1段目: 絵型（大）／品名／品番／ステータス／量産数
- 2段目: ブランド ／ シーズン ／ カテゴリ（日本語名）を1段目より小さい文字で
- 絵型は現行 `h-10 w-10`（40px）から **96px 級**へ。`sketchThumbUrl` は既に一覧に来ている（B-027）
- ★分類3列を**削除しない**。2段目へ移すだけ
- 絵型が無い品番の空状態表示を壊さないこと

### 手順4: 量産数の表示（P-6・表示側）

合計が 0 の行は `0` ではなく `—` と表示する。

### 手順5: アーカイブ既定非表示（P-7）

`products-search.tsx` の `status` 既定値を変え、既定で ARCHIVED を出さないようにする。

★**`listProducts` の `where` に ARCHIVED の固定除外を足さない。**
固定条件にすると「アーカイブを見たい」が実現できなくなる。フィルタで明示選択すれば表示できること。

### 手順6: ステータスの形（P-8）

ステータスを**色に依存せず形で区別できる**ようにする（枠線の実線/破線、塗りの有無、先頭の記号など）。

- ★`globals.css` の色トークンを触らない。色の体系は B-188
- ★**すべての `ProductStatus` の値**について、グレースケールでも互いに区別できること。
  1つでも区別できない組があれば、その組み合わせを報告する

### 手順7: 食い違いバッジ（P-5）★最も慎重に

`productCode` から読み取れる分類と、現在の `categoryId` / `season` / `brandId` が
**食い違う行にだけ**、カテゴリ側に小さくバッジを出す。一致する行には何も出さない。

★**実装方法をこちらから指定しない。採番ロジックの実物を読んで決めること。** 理由は次のとおり。

- 本番の `categoryCode` は `M-TS` のように**ハイフンを含む**。
  したがって `productCode.split("-")` で位置決めする実装は**本番で誤判定する**
- 誤判定の害は「バッジが出ない」ではなく「**無関係な行にバッジが出る**」であり、
  出さないより悪い

**進め方**

1. 採番ロジックを読み、`productCode` が何をどの順で連結しているかを**実コードから**確定する
2. その連結規則の**逆**として判定を書く。分解ではなく、
   「現在の属性から期待される部分文字列が `productCode` に含まれるか」の照合でよい
3. dev の実データと、本番のカテゴリ体系（K/L/M/U × 部位の階層）の**両方で成立する**ことを確認する

★**確実な判定が組めないと判断したら、手順7 だけを実装せずに停止し、理由を報告すること。**
手順1〜6 は独立しているので、手順7 を落としても PR は成立する。
**曖昧なまま推測でバッジを出さない。**

## 3. 停止条件（`exit 1` 相当・実装を続けずに報告する）

- `gh pr list --state open` に同じ課題の PR が既にある
- `prisma/schema.prisma` に変更が必要になった（本件は migration なしのはず。必要なら設計に戻る）
- 手順7 の判定が、dev と本番の双方で成立する形に書けない
- 手順6 で、色を使わずに区別できないステータスの組が残る
- `npx tsc --noEmit` が通らない
- `npm run lint` のエラーが **11 件（B-129 の baseline）を超えた**
  ★11 件そのものは既知であり、超過したときだけ止める

## 4. 変更してよいファイル（これ以外を触らない）

- `src/lib/actions/products.ts`
- `src/app/(app)/products/_components/products-table.tsx`
- `src/app/(app)/products/_components/products-search.tsx`
- `src/app/(app)/products/_components/labels.ts`

★上記以外に変更が必要になったら、**変更せずに理由を報告する。**

## 5. 禁止事項（上位 spec §5 と同一）

- `prisma/schema.prisma` を変更しない。migration を作らない
- `Product.productionQty` / `receivedOrderQty` / `deliveredQty` / `defectQty` / `defectRate` を
  一覧に出さない
- ブランド／シーズン／カテゴリの3列を削除しない
- `listProducts` の `where` に ARCHIVED の固定除外を足さない
- 行ごとに `Sku` を引かない（N+1 禁止）
- `globals.css` の色トークンを触らない
- 一括操作・カテゴリフィルタ・ソートを本 PR に混ぜない
- `git add` は**明示的なファイルパスのみ**（`-A` / `.` / `--all` を使わない）
- main に直接 push しない

## 6. コミットと PR

1. `git switch -c feature/b-082-b-090-b-091-product-list`
2. サーバ側（手順1）を先にコミット。`npx tsc --noEmit` が通ってから
3. UI 側（手順2〜7）をコミット。`npx tsc --noEmit` と `npm run lint` を通してから
4. push → PR を open する（base: main）
5. PR 本文に記載する: スコープ（P-1〜P-8）／**migration なし**／変更ファイル4つ／
   手順7 を実装したか（しなかったなら理由）／色を触っていないこと／lint のエラー件数
6. ★**マージはしない。** マージは慎太郎さんが行う（＝本番反映・不可逆）

★型・lint がクリーンなら commit → push → PR open まで自走してよい。
判断を仰ぐのは、上の停止条件に当たったときだけ。

## 7. 動作確認

上位 spec の §4（10項目）に従う。**dev の `localhost:3001`（PORT=3001）で行う。**
本番（`shunya-pms-web-production.up.railway.app`）では行わない。

★確認は PR をマージする**前**に、`feature/b-082-b-090-b-091-product-list` に
`git switch` した状態で dev サーバを起動して行う。

## 8. 完了報告に含めること

- 触ったファイル一覧（4つ以外を触っていないこと）
- `npx tsc --noEmit` の結果
- `npm run lint` のエラー件数（baseline 11 との比較）
- 手順7 を実装したか。しなかった場合はその理由と、採番ロジックから分かった事実
- 量産数の集計クエリが1本であること（N+1 になっていないこと）
- 手順6 で色を使わずに区別できたステータスの一覧
- PR の URL
