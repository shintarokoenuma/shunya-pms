# Seed Scripts

`scripts/seed-categories.ts` で ProductCategory / MaterialCategory の標準セットを CSV から一括投入するためのデータと使い方。

## CSV ファイル

- `seed-product-categories.csv` — ProductCategory(アパレル分類)26 件、Lv1 4 / Lv2 22
- `seed-material-categories.csv` — MaterialCategory(素材分類)35 件、Lv1 9 / Lv2 26

エンコーディングは UTF-8(BOM 付き)、区切りはカンマ、ヘッダー行 1 行、並び順は **Lv1 → Lv2** の順で、Lv2 の `parentCategoryCode` は同一 CSV 内の Lv1 categoryCode を指す。

カラム:

| 列 | 説明 |
|---|---|
| categoryCode | 会社内 unique なコード(英数字 / `-` / `_`) |
| categoryName | 日本語名 |
| categoryNameEn | 英名(任意) |
| parentCategoryCode | Lv2 の場合は Lv1 の categoryCode を入れる。Lv1 は空欄 |
| level | 1(大分類)or 2(中分類)。Lv3 を入れる場合はスクリプト拡張が必要 |
| status | `ACTIVE` or `ARCHIVED` |

## 使い方

```bash
# 1) dry-run で確認(実投入せず、件数だけ確認)
npx tsx scripts/seed-categories.ts --target=product --dry-run
npx tsx scripts/seed-categories.ts --target=material --dry-run

# 2) 実投入
npx tsx scripts/seed-categories.ts --target=product
npx tsx scripts/seed-categories.ts --target=material

# 3) 両方を一気に
npx tsx scripts/seed-categories.ts --target=all

# 4) カスタム CSV パスを指定
npx tsx scripts/seed-categories.ts --target=product --file=path/to/custom.csv

# 5) 別テナントを指定
npx tsx scripts/seed-categories.ts --target=product --tenant=<companyName or UUID>

# 6) 環境変数で companyId を直接指定
SEED_COMPANY_ID=xxxx-xxxx-xxxx npx tsx scripts/seed-categories.ts --target=all
```

## オプション

| オプション | 既定値 | 説明 |
|---|---|---|
| `--target` | (必須) | `product` / `material` / `all` |
| `--dry-run` | `false` | 実投入せず、トランザクションをロールバック |
| `--file` | `scripts/seeds/seed-<target>-categories.csv` | CSV パス |
| `--tenant` | `shunya` | テナント解決キー。後述 |

## テナント解決ロジック

1. 環境変数 `SEED_COMPANY_ID` が設定されていれば、それをそのまま `companyId` として使う(最優先)
2. `--tenant=<UUID>`(36 文字の UUID v4 形式) → `Company.id` として lookup
3. `--tenant=shunya` → `tenantType: MASTER_ADMIN` の Company を 1 件 lookup
4. それ以外の文字列 → `companyName` の部分一致(大文字小文字区別なし)で lookup

## 動作

1. CSV を読み込み(UTF-8 BOM 自動除去)
2. テナントの `companyId` を解決
3. **Lv1 を先に**全件 upsert(`companyId + categoryCode` で重複検出 → 既存は skip)
4. **Lv2 を後に**処理:
   - `parentCategoryCode` から Lv1 の `id` を解決(CSV 内 Lv1 から取得 + DB 検索フォールバック)
   - 親が見つからなければエラー
   - `companyId + categoryCode` で重複検出 → 既存は skip
5. 結果サマリ(成功 / skip / エラー)を出力
6. `--dry-run` の場合はトランザクション全体を ROLLBACK

## エラーハンドリング

- CSV ファイル不存在 → exit 1
- `companyId` 解決失敗 → exit 1
- 親 categoryCode が CSV 内・DB のどちらにも無い → そのカテゴリだけエラーカウントしつつ続行
- DB エラー → トランザクション全体を ROLLBACK / exit 1
- dry-run 完走 → 「実投入は --dry-run を外して再実行してください」を表示

## マスター管理者でのみ実行

`shunya` テナントへの初期投入を想定しているため、本スクリプトは production DB に対して直接書き込む。
事故防止のため、本番 `DATABASE_URL` を指している場合は必ず `--dry-run` で確認してから実投入すること。

## B-070 名寄せマスター（仕入先・工場・外注先の一括登録・B-212 付帯）

`scripts/seed-b070-master.ts`（dev）/ `scripts/seed-b070-master-prod.ts`（本番）で、B-070（請求書インテーク）の名寄せマスター v0.3 から
Supplier / Factory / Contractor を一括登録する。ロジックは `scripts/seeds/b070-master-core.ts`。データは `scripts/seeds/b070-master-seed-v0_3.csv`
（UTF-8 BOM 付き・見出し 1 行・541 行・md5 `7f1262d56b9e736aa1f6dd2cf65eccc5`）。

カラム:

| 列 | 説明 |
|---|---|
| code | B-070 の仕入先コード（7 桁数字）。そのまま supplierCode / factoryCode / contractorCode に入れる（`/^[A-Z0-9-_]+$/`・50 文字以内） |
| name | 社名（読み取ったまま・255 文字以内） |
| target | `SUPPLIER` / `FACTORY` / `CONTRACTOR` |
| types | 「\|」区切りの enum 値（SUPPLIER→SupplierType、FACTORY→FactoryType、CONTRACTOR→ContractorSpecialty） |
| status | `ACTIVE`（最近の取引先）/ `PAUSED`（それ以外） |
| isIndividual | `true` / `false`（CONTRACTOR だけ使う） |
| kubun | B-070 の区分コード（notes にも入っている） |
| notes | 「B-070名寄せマスターv0.3から登録。区分NNN …」 |

決まり:

- 1 行でも不正（code の形・name の長さ・types の enum・status）があれば、書き込みを始める前に全件を出して失敗する
- CSV 内で code が重複、または社名（NFKC → 空白除去 → 法人の種類を除く）が重複していれば失敗する
- 既存（削除済みを含む）に **同じ code が同じマスター**にあればスキップ（UPDATE しない）。**別マスターに同じ code** があればスキップして一覧に出す。
  **社名が同じ既存**（コード違い・3 マスター横断）があれば作らずに一覧に出す（重複登録の防止・人が後で決める）
- 作る列は最小（code・name・種別・status・notes・country JP・外注先は isIndividual と contractType PER_TASK）。取引条件・住所・口座・主担当は入れない
- 1 行ごとに create と AuditLog（CREATE・entityType "Supplier" / "Factory" / "Contractor"・afterData に `source: "seed-b070-master-v0_3"`）を 1 つの $transaction で書く。userId は OWNER
- 冪等（2 回流しても件数は増えない）

使い方（★必ず `--dry-run` を先に流して、作成予定と「社名が同じ既存あり」の一覧を見る）:

```bash
# dev（DATABASE_URL が hopper.proxy.rlwy.net:12921 以外なら止まる。本番ホストは常に止まる）
npx tsx scripts/seed-b070-master.ts --dry-run
npx tsx scripts/seed-b070-master.ts

# 本番（三重ガード: CONFIRM_PROD_SEED=B070_MASTER_541・shuttle.proxy.rlwy.net:16099 必須・対話で yes）。実行は慎太郎さん
DATABASE_URL=<本番 URL> CONFIRM_PROD_SEED=B070_MASTER_541 npx tsx scripts/seed-b070-master-prod.ts --dry-run
DATABASE_URL=<本番 URL> CONFIRM_PROD_SEED=B070_MASTER_541 npx tsx scripts/seed-b070-master-prod.ts
```

`--file=<path>` で CSV を変えられる。本番への投入は PR の merge とは別の操作（merge しても本番には何も入らない）。
