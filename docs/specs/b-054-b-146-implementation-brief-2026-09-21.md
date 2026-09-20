# 実装ブリーフ — B-054 縫製仕様書 PDF ／ B-146 型紙（最小範囲）

- 作成日: 2026-09-21 JST / claude.ai
- 元になる仕様: `docs/specs/b-054-b-146-spec-confirmation-v1_0-2026-09-20.md`（D-1〜D-21）
- 参考画面: https://claude.ai/artifact/TNoYjVPYR5HuR6BT61tAqp （v8 を正とする）
- 起点 commit: eb829e6（2026-09-20 23:00 JST 実測）
- ライフサイクル: 5（型紙の記録）／9（工場へ渡す帳票）
- **実装状況（2026-09-21 締め時点）**: PR-1 = マージ済み（#149・squash 5779a49）／PR-2 = open（#150・`feat/b-054-pr2-pattern-version-registry`）／PR-3・PR-4 = 未着手

---

## 0. 実測で分かったこと（2026-09-20 21:54 / 23:00 JST・read-only）

| # | 実測 | 設計への影響 |
|---|---|---|
| 1 | **WO の入力画面に「希望納期」の欄はある**（`work-order-form.tsx:574`・`<FormLabel>希望納期</FormLabel>`・`type="date"`）。詳細・編集画面にも表示あり | 「入力箇所が無い」という前提は外れ。**希望納期の追加実装は不要**。PDF はこの値を読むだけ |
| 2 | 職出し予定日に当たる列は WO に無い（実績の `productionStartedAt` のみ） | **ADD COLUMN 1本**（`plannedStartDate`） |
| 3 | dev の `factory_contacts` / `contractor_contacts` は **0件**（工場2・外注先2） | PDF の「ご担当」は**空なら行ごと省く**。dev では確認できないので、動作確認用に工場の担当者を1件入れてから見る |
| 4 | react-pdf の `<Image>` は **repo に前例ゼロ**。`src/lib/gcs.ts` の export は upload 系4本と `getSignedReadUrl`（署名URL）だけで、**Buffer を読む関数が無い** | 絵型を載せる技術検証を**先に1本**。`gcs.ts` に読み出し関数を1つ足す |
| 5 | 工場の種類の表示名・選択肢は `src/app/(app)/factories/_components/labels.ts`（`FACTORY_TYPE_OPTIONS` 12件・`FACTORY_TYPE_LABELS`）。検品は無い | enum に `INSPECTION` を足し、この2か所にも足す |
| 6 | `patternVersionId` は action の戻り値マッピング2か所のみ。**画面での使用はゼロ** | B-146 は「型紙の登録画面」から。SP / WO への紐付け UI は後続 |
| 7 | migration は 52本・最新 `20260908000000_b170_product_colorway_client_color_name`。`migrate status` は従来どおり「dev に `_prisma_migrations` 無し」の表示 | 運用は **diff ドライラン → dev に db push → 手書き migration → 一致検証 → 本番 migrate deploy**。`migrate dev` / `migrate reset` / `--accept-data-loss` は使わない |

---

## 1. PR の分け方（4本・この順で）

### PR-1 ― 器の追加（migration + マスター画面）★マージ済み（#149・5779a49）
**目的**: パターン番号・職出し予定日・工場の種類「検品」の3点を入れる。

実装した内容:
1. `prisma/schema.prisma`
   - `model ModelCode` に `patternNumber String? @map("pattern_number") @db.VarChar(50)`
   - `model WorkOrder` に `plannedStartDate DateTime? @map("planned_start_date") @db.Date`
   - `enum FactoryType` に `INSPECTION // 検品（検品所）`
2. migration（手書き・**2ファイルに分割**）
   - `20260921000000_b054_pattern_number_planned_start/migration.sql` … ADD COLUMN 2本
   - `20260921000100_b054_factory_type_inspection/migration.sql` … `ALTER TYPE "FactoryType" ADD VALUE 'INSPECTION';`
   - ★分けた理由: PostgreSQL では ADD VALUE を同一トランザクション内で使えないため
3. `src/app/(app)/factories/_components/labels.ts` の `FACTORY_TYPE_OPTIONS` / `FACTORY_TYPE_LABELS` に「検品」を追加（12→13件）
4. WO の入力・編集・詳細に「職出し予定日」を追加（`work-order-form.tsx` の希望納期の欄のすぐ上／`validators/work-order.ts`／`actions/work-orders.ts`／詳細・編集ページ）
5. 型番（ModelCode）の編集画面に「パターンNO」を追加。品番カルテの「品番・分類」にも表示。品番から自動生成される型番には**社内品番を初期値**として入れる（D-17）

検証（実施済み）:
- `migrate diff --from-url "$DATABASE_PUBLIC_URL" --to-schema-datamodel prisma/schema.prisma --script` が **空**
- 触ったファイルの `tsc --noEmit` クリーン・全体 lint は 11 errors / 24 warnings から増えていない
- dev（localhost:3001）で 工場の種類に「検品」が出る／WO に職出し予定日が保存できる／型番にパターンNO が保存・再表示される

### PR-2 ― B-146 最小（型紙の記録）★open（#150）
**目的**: 型紙の受領を1件ずつ記録し、品番カルテから見えるようにする。

実装した内容:
- 新規 `src/lib/validators/pattern-version.ts`（受領日必須・種別・グレーディング・修正内容・Drive URL は `^https?://`・パタンナー）
- 新規 `src/lib/types/pattern-version.ts`（`PatternVersionView`・`PATTERN_WORK_TYPE_LABELS`）
- 新規 `src/lib/actions/pattern-versions.ts`: 一覧（modelCodeId 指定）・作成・更新・論理削除。**全クエリに companyId**・AuditLog 3本
  - `version` / `versionNumber` は `$transaction` 内で「最大 versionNumber + 1」を取り自動採番（`version = "v" + n`）。`@@unique([modelCodeId, version])` があるため P2002 は最大3回リトライ。**論理削除済みの行も採番の母数に数える**
  - 一覧は `receivedAt` の新しい順（nulls last）。更新で version は変えない
- 新規 `src/app/(app)/products/_components/pattern-version-section.tsx`（品番カルテの引き出し「型紙」＝一覧＋登録ダイアログ）
- `src/app/(app)/products/[id]/page.tsx` に「型紙」の引き出しを追加（「カラー展開（編集）」の直後・8→9グループ）
- 表示の主役は**受領日と種別**（例: `2026-08-12 修正`）。version は画面に出さない

★マージ時の注意: PR-1 が squash されたため、PR-2 ブランチには squash 前の commit が残っている。マージ前に `git rebase --onto main abaac0f` して差分を PR-2 分だけにする（force-with-lease）。

### PR-3 ― 絵型を PDF に載せる技術検証（小さく1本）★未着手
**目的**: react-pdf の `<Image>` 初使用の risk を先に潰す。

- `src/lib/gcs.ts` に読み出しを1本追加（案）: `export async function downloadToBuffer(gcsPath: string): Promise<Buffer | null>`（`bucket.file(object).download()`）
- 既存の PDF ルート1本（発注書）に影響を出さないよう、**検証用の新ルート**で1枚だけ描画し、目視したら本番実装（PR-4）に取り込む
- 確認する点: 画像が出るか／PNG と JPEG／解像度と PDF の容量（目安: 1ページ 1MB 以下）／実行時間
- 署名URL（`getSignedReadUrl`）を `<Image src>` に渡す方式も可。**どちらを採るかは検証の結果で決め、PR の説明に理由を書く**

### PR-4 ― 縫製仕様書 PDF 本体 ★未着手
**目的**: 3枚の PDF と、出力ページを選ぶ画面。

- `src/lib/pdf/sewing-spec-document.tsx`（新規・既存の `order-document.tsx` の書き方に揃える。フォントは `fonts.ts` の NotoSansJP）
- ルート: `src/app/api/products/[id]/sewing-spec/route.ts`（`auth()` → companyId → データ取得 → `renderToBuffer` → `application/pdf`）
- 入力（クエリ）: 出すページ（1/2/3）と、ページごとの宛先 WO の id、載せる絵型の指定
- 紙面は参考画面 v8 のとおり:
  - 表題＋区分の札（量産／サンプル n次／量産（追加）／量産（やり直し）＝D-15・D-16）＋発行日＋ページ番号
  - 宛先枠（工場名 御中・ご担当・職出し予定日・希望納期）／弊社枠（社判ブロック・弊社担当）
  - 品番の帯（品番・先方品番・パターンNO・型紙の日付）★約束納期は載せない（D-3）
  - 1枚目: 絵型（大）／数量（色×サイズ）／仕様（縫製指示）／付属（最大15行）
  - 2枚目: 採寸位置の絵型／サイズ表は画像／数量／仕様
  - 3枚目: 加工位置の絵型（大）／加工指示／追加画像（横長2枠）
- 型紙の日付: 宛先 WO の `patternVersionId` があればその行、無ければ型番の最新 `receivedAt`
- ご担当: 主担当（`isPrimary`）が無ければ行ごと省く
- 出力ページを選ぶダイアログは品番カルテから開く

検証（dev・localhost:3001）:
- 3枚とも B4（横 257mm × 縦 364mm）で、はみ出しと文字切れが無い
- 付属15行・カラー5色で1枚に収まる
- 宛先の違う工場で2枚出したときに、宛先・日付・区分の札が入れ替わる
- 担当者が未登録の工場でも崩れない

---

## 2. 守ること（毎回）

- feature ブランチを切る。main への直 push はしない（ドキュメントのみの変更は例外）
- `git add` はファイルを明示して行う（`-A` / `.` は使わない）。`.env` は commit しない
- `prisma migrate dev` / `migrate reset` / `--accept-data-loss` は実行も提案もしない
- 接続文字列は `DATABASE_PUBLIC_URL`。host と DB 名の末尾まで確認してから使う（dev = hopper:12921 / 本番 = shuttle:16099）
- db push のあとは `sample_productions_pe_base_one_per_product_key`（partial unique index）が残っているかを確認する
- 動作確認は dev（`PORT=3001 npm run dev` → localhost:3001）。本番 URL は確認手順に並べない
- 型・lint がクリーンなら commit → push → PR open までは自走してよい。**マージは慎太郎さんだけ**（マージ＝本番反映＝不可逆）

---

## 3. 残っている確認・申し送り

- PR #150 のマージ（rebase が要る・上記 PR-2 の注意）
- 本番の `factory_contacts` の件数（dev は 0）。運用として工場の担当者を登録するかどうか
- SP / WO から `patternVersionId` を選ぶ UI（§5-2・PR-4 と同時か直前）
- 見積依頼・相見積もりで発注前に仕様書を送る用途（D-21）は初版の範囲外 → **B-135 / B-174** が受ける
- サイズ表の器（B-039）・Excel 取込（B-056）・メール取込（B-206）は別番号のまま

---

## 改訂履歴

| 日付 | 内容 |
|---|---|
| 2026-09-21（締め） | repo 収載。PR-1 マージ済み・PR-2 open の実装結果を反映し、PR-2 の rebase 注意と D-21 の受け先を追記 |
| 2026-09-21 | 新規。2026-09-20 21:54 / 23:00 の read-only 実測（①〜⑦）を反映。希望納期は既存欄で足りることが判明し、追加実装から外した |

<!-- END-OF-BRIEF-2026-09-21 -->
