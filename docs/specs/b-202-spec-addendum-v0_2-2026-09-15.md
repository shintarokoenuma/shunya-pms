# B-202 品番カルテ 1画面化 仕様確認書 addendum v0.2 (2026-09-15)

- 種別: addendum。`docs/specs/b-202-product-karte-one-screen-spec-confirmation-v1_0-2026-09-12.md` と `docs/specs/b-202-spec-addendum-v0_1-2026-09-13.md` を補完する（どちらも破棄しない）
- ★本書にしかない識別文字列: **RECON-M**
- 実測: RECON-M（2026-09-14 23:22 〜 2026-09-15 01:16 JST・main d7e1725・read-only・DB 無書込）
- ★日付: 本セッションは 09-14 23:22 JST に開始し、09-15 01:16 JST に日をまたいだ。ファイル名は JST の 09-15 を採る
- ★正本は repo の本ファイル。プロジェクトナレッジ `claude/b-202-spec-addendum-v0_2-2026-09-15.md` は同期先（claude.ai 側で登録する）

---

## 0. 本書で変わったこと（3行）

1. ★**B-202 の schema 変更・migration はゼロになった。** addendum v0.1 の「`Comment` を起こす1本」は不要。DDL は 2026-05-16 の init で適用済みだった
2. Q2 の補完: caption を入力する UI が存在しないため、**caption 入力欄を1つ足す**（B-027 の極小拡張・B-202 に含める・新規起票なし）
3. Q4 の補完: `CompanySetting` は0行かつ必須 Json 列が7本あるため、**アプリ側の既定値で upsert する**（migration を足さない）

---

## 1. RECON-M の実測

### 1-1. migration 運用（変更なし）

- `prisma/migrations/` は52本。最新は `20260908000000_b170_product_colorway_client_color_name`
- ★その `migration.sql` は**手書き・ADD COLUMN のみ・冒頭に根拠コメント5行**。B-202 で将来 migration を書く場合の手本にする
- `package.json:9` = `"start": "prisma migrate deploy && next start"`（本番の適用経路）
- ★`npx prisma migrate status` は52本を列挙したうえで "To apply migrations in development run prisma migrate dev." を出す。これは dev DB に `_prisma_migrations` が無い状態の挙動で、**`prisma migrate dev` は今も使えない**（DB 全体の reset を要求する）
- ★migration ファイルが52本あることと、dev DB に履歴テーブルが無いことは**両立する**。食い違いではない。引き継ぎメモ ⑨ の記載は有効

### 1-2. ★Comment の DDL は init で適用済み＝migration 不要

`prisma/migrations/20260516075911_init/migration.sql` の実測:

| 行 | 内容 |
|---|---|
| 344 | `CREATE TYPE "CommentFormat"` |
| 347 | `CREATE TYPE "CommentType"` |
| 350 | `CREATE TYPE "CommentPriority"` |
| 1093 | `CREATE TABLE "products"` |
| 1159 | `CREATE TABLE "skus"` |
| 3604 | `CREATE TABLE "comments"` |
| 3639 | `CREATE TABLE "comment_mentions"` |
| 3930 | `CREATE TABLE "company_settings"` |

- dev の実在確認: `comments` / `comment_mentions` / `company_settings` の3つとも `information_schema.tables` にある
- ★**本番の判定は、本番 DB に接続せずに確定できる。** migration は1本が1単位で適用される。本番で `products` を使った品番画面が動いている以上 init は適用済みであり、**同じファイル内の `comments` も本番に存在する**
- ★残る唯一の未確認: 本番での物理実在を SELECT で見ていない。**PR-2 のマージ前に本番で1回 count を取る**ことを受け入れ条件に入れる（smoke のみ・書き込みなし）

### 1-3. 休眠の確認（陽性対照つき）

- `grep -rn 'prisma\.comment\|prisma\.companySetting' src/` = **0件**
- ★陽性対照 `grep -rn 'prisma\.product\b' src/` = **56件**。grep は機能しており、0件は測定結果である

### 1-4. 絵型と caption

- dev: products **4件** / `sketch_images` を持つ **1件**（AOI-26SS-M-TS-001）/ 画像 **3枚** / caption 記入 **0件**
- ★この0件を「caption は使われていない」の根拠にしない。**分母が4品番・絵型1件で、標本として成立しない**
- ★空である真の理由は **caption を入力する UI が存在しないこと**。`src/app/(app)/products/_components/sketch-section.tsx`（208行）の caption ヒットは 159 / 162 / 164 行の**表示のみ**で、Input / Dialog / form / onSubmit のヒットはゼロ
- 型と action は既に対応済み: `src/lib/types/product-sketch.ts`（22行）に `ProductSketch.caption?: string` があり、`src/lib/actions/product-sketches.ts:280` が `caption: img.caption` を保存経路に通している

### 1-5. CompanySetting

- companies **1行** / company_settings **0行**
- 必須 Json（`?` なし・`@default` なし）が **7本**: `numberingRules` / `emailSettings` / `expiryWarningDays` / `quotationValidityDays` / `automationSettings` / `aiSettings` / `securitySettings`
- 任意: `uiPreferences Json?` / `customFields Json?`
- ★行を新規に作るには、必須7本すべてに値が要る

### 1-6. 手本4層

- `src/lib/validators/` 32本 ／ `src/lib/actions/` 41本
- ★action の手本は `src/lib/actions/product-sketches.ts`（289行）。`"use server"` / `requireSession()`（companyId・userId を返す）/ `ActionResult<T>` / `auth()` / `revalidatePath` / 方針をファイル冒頭コメントに置く / 物理削除しない
- ★型は `src/lib/types/` の中立モジュールに置く。client component が `"use server"` の actions から型を import すると `@prisma/client` がブラウザバンドルに漏れる（`product-sketch.ts` 冒頭の PR #85 の轍）

---

## 2. 確定事項（v1.0 / addendum v0.1 の補完）

### D-9 ★B-202 に schema 変更・migration は無い（addendum v0.1 §0 の訂正）

addendum v0.1 は「B-202 の schema 変更は `Comment` / `CommentMention` を起こす1本のみ」としていたが、RECON-M により **DDL は 2026-05-16 の init で適用済み**と判明した。B-202 で必要なのは配線（validator / action / UI）だけである。

★**B-202 の全 PR が `git revert` で戻せる。不可逆なステップは1つも無い。** 引き継ぎメモ（2026-09-13 締め）④ の「順3: migration の適用は不可逆」は解消した。

### D-10 caption の入力欄を足す（Q2 の補完）

慎太郎さんの確定（2026-09-15）: **caption 入力欄を足す**。

- 絵型セクションに1行のテキスト入力を追加し、`caption` を編集できるようにする
- タブ名は `caption`。**空のときの既定は `絵型 {i+1}`**（`sketch-section.tsx:159` の既存 alt と同じ文言に揃える）
- ★型変更なし・action 変更なし（既に caption を保存経路に通している）・schema 変更なし
- ★**新規起票しない。B-202 に含める。** 絵型の既存番号 B-027 / B-082 / B-090 はいずれも完了済み（v1.0 §2-4）

### D-11 表示スイッチの行は、アプリ側の既定値で upsert する（Q4 の補完）

慎太郎さんの確定（2026-09-15）: **必須7列を既定値で埋めて upsert する。migration を足さない。**

- 既定値は1箇所の定数にまとめる（`src/lib/company-setting-defaults.ts` を新設）。必須 Json 7本は `{}`、Decimal / Int / enum / String は schema の `@default` がそのまま効く
- ★`{}` は「**未設定**」の意味である。将来 採番ルール・メール・AI・セキュリティ設定を実装するときは `{}` を未設定として扱う。**この1行を定数ファイルの先頭コメントに書く**
- ★`uiPreferences` の名前空間は段階3（B-203）へ移せる形にする: `uiPreferences.productKarte.memo.*`
- **不採用**: 7列に `@default('{}')` を足す非破壊 migration。★1本でも migration が入ると B-202 に不可逆なステップが戻るため（D-9 の利点を失う）

---

## 3. 3本セットで正（読む順）

1. `b-202-product-karte-one-screen-spec-confirmation-v1_0-2026-09-12.md`（識別子 RECON-L）— D-1〜D-8
2. `b-202-spec-addendum-v0_1-2026-09-13.md`（識別子 QLOG-B202）— Q2〜Q11 の確定・D-7 / D-4 の訂正
3. **本書**（識別子 RECON-M）— D-9 / D-10 / D-11

- v1.0 の D-1〜D-8 は有効。ただし D-7 の「migration は ADD TABLE 相当」の記述のみ **D-9 で無効**
- addendum v0.1 の Q2〜Q11 は有効。Q2 に D-10、Q4 に D-11 を上乗せする

---

## 4. スコープ外と受け先（新規採番ゼロ）

addendum v0.1 §4 の表から変更なし。**本書で新たに繰り延べた要件は無い。浮いている要件はゼロ。**

---

## 改訂履歴

| 日付 | 版 | 内容 |
|---|---|---|
| 2026-09-15 | addendum v0.2 | RECON-M を収載。D-9（schema / migration ゼロ）・D-10（caption 入力欄を足す）・D-11（CompanySetting はアプリ側既定値で upsert）を確定 |
