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
