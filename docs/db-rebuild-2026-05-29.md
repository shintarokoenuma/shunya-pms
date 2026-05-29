# DB 環境再構築 (案 Z) - 2026-05-29

## サマリ

shunya 生産管理システムの Railway PostgreSQL 環境を再構築した。サービス名と実態の乖離を解消し、本番 / dev 環境を完全分離した。

### 変更前

| サービス | 名前 | 実態 |
|---|---|---|
| `postgres-dev-shunya-pms` | "dev" を含む名前 | **本番として稼働中** (`shunya-pms-web` から参照) |
| (dev DB) | 存在しない | - |

### 変更後

| サービス | 名前 | 実態 |
|---|---|---|
| `postgres-production` | production を明示 | 本番 (`shunya-pms-web` から `${{ ... }}` 変数参照で接続) |
| `postgres-development` | development を明示 | dev (慎太郎さんのローカル `.env` から接続) |

### 達成事項

- 名前と実態の一致 (B-012 解消)
- DATABASE_URL を変数参照型 `${{ postgres-production.DATABASE_URL }}` に変更 (B-013 解消)
- dev DB 構築 (B-011 解消)
- データロスゼロで移行
- 本番 + dev で同じデータ状態でスタート

---

## 背景

### 2026-05-28 までに判明していた問題

引き継ぎメモには「dev DB は実在しない、`.env` は本番 Railway のみを指す」と記載されていた。Phase 1A-15 動作確認時に本番 DB に検証用データが投入される事故が発生し、`shunya-environment-safety-check` スキルを新規作成した経緯がある。

### 2026-05-29 のセッションで追加判明した事実

B-011 (dev 環境構築) の設計議論を開始した時点で、Railway プロジェクト内の DB サービス名が **`postgres-dev-shunya-pms`** であることを確認。`shunya-pms-web` の `DATABASE_URL` を調べたところ:

- このサービスが現在の**本番 DB そのもの**だった
- 名前に `dev` が含まれているが、実態は本番
- `shunya-pms-web` の `DATABASE_URL` がリテラル直書きで、Railway ベストプラクティス (`${{ Postgres.DATABASE_URL }}` 形式) から外れていた

つまり、引き継ぎメモの「dev DB は実在しない」は正しく、`postgres-dev-shunya-pms` は名前に反して本番 DB だった。

---

## 設計判断

### 検討した 3 つの案

#### 案 X: 既存サービスをリネーム + 新規 dev DB を追加

- 旧 `postgres-dev-shunya-pms` → `postgres-production` にリネーム
- 別途 `postgres-development` を新規追加

**評価**: Railway 公式ドキュメントによると、サービス名のリネームは内部 DNS 名 (`*.railway.internal`) も連動して変わる。本番に対する影響が予測しきれない。

#### 案 Y: 既存サービスはそのまま、新規 dev DB のみ追加

- `postgres-dev-shunya-pms` (本番) はそのまま放置
- 新規 `postgres-local-dev` 等を追加

**評価**: 名前の混乱が永続的に残る。「`postgres-dev-shunya-pms` は名前に反して本番」という注意書きが今後の開発で必要になる。技術負債を残す。

#### 案 Z: バックアップ取得 + 新規 2 サービス作成 + データ移行 + 旧削除

- ローカル `pg_dump` でフルバックアップ取得
- 新規 `postgres-production` + `postgres-development` を作成
- 両方に schema + データを構築
- `shunya-pms-web` の `DATABASE_URL` を新本番に切り替え + 変数参照型に変更
- ローカル `.env` を新 dev に切り替え
- 旧 `postgres-dev-shunya-pms` + volume を削除

**評価**: 名前の混乱を完全解消、ベストプラクティス遵守 (`${{ ... }}` 形式)、技術負債ゼロ。リスクは Phase 1A 時点 (Material 0 件) なら最小。

### 採用: 案 Z

採用根拠:

1. Phase 1A 時点の Material 0 件 = データ量が極小、今を逃すと将来コストが雪だるま式に増加
2. B-011 (dev 環境構築) の目的が「本番を汚さない」ことであり、名前の混乱を残したまま dev を追加すると目的の一部しか達成できない
3. ベストプラクティス (変数参照型) への移行を同時に達成可能
4. リスク対策 (ローカル dump、三重ガード、空 DB チェック) で発生確率を抑えられる

### 細目の判断

| # | 判断項目 | 採用 |
|---|---|---|
| 1 | 新サービス命名 | `postgres-production` + `postgres-development` (用途明示型、`postgres` + `postgres-development` より拡張性高い) |
| 2 | DATABASE_URL 形式 | 変数参照型 `${{ postgres-production.DATABASE_URL }}` (Railway ベストプラクティス遵守) |
| 3 | dev 初期データ | 本番 dump と同じデータを流し込み (本番と dev が同一データでスタート、シード CSV と整合) |

---

## 実施手順 (8 ステップ)

### Step 1: ローカル Mac に PostgreSQL クライアントツールをインストール

- Homebrew で `libpq` インストール (既存検出 → スキップ)
- `~/.zshrc` に PATH 追記
- `psql` / `pg_dump` 共に PostgreSQL 18.4 で動作可能 (Railway 本番と完全一致)

### Step 2: 旧本番 DB のフルバックアップ取得

- 対話スクリプト `~/shunya-pms-backups/run-backup.sh` を配置
- `read -s` で DATABASE_PUBLIC_URL を対話入力 (シェル履歴に残さない)
- 取得結果:
  - `full_backup_20260529_104452.dump` (custom 形式、506K)
  - `full_backup_20260529_104452.sql` (plain SQL、418K)
- chmod 600 で保護
- TABLE DATA 121 件、TOC 988 エントリ

### Step 3: dump 内容の検証 (本番に触れない)

- ローカル dump ファイルの解析のみ
- 件数照合:
  - product_categories: 27 件 ✓
  - material_categories: 36 件 ✓
  - materials: 0 件 ✓
  - audit_logs: 128 件 (引き継ぎメモの「5 件 = 当日 DELETE 分」を含む全期間データ)
  - companies/users/suppliers: 1/1/2 件 ✓
  - `_prisma_migrations`: 17 件 = ローカル main の `prisma/migrations/` と完全一致 (diff = 0)
  - enum 型: 145 件 ✓

### Step 4: Railway に新規 2 サービスを追加

- `postgres-production` + `postgres-development` を作成
- 本番 `postgres-dev-shunya-pms` には一切触らない
- 4 サービス並列構成を確認

### Step 5: 新 `postgres-production` に schema 構築

- 対話スクリプト `run-migrate-production.sh` を配置
- 三重ガード (旧本番ホスト + ハードコード防御) で誤入力ガード
- 空 DB 確認 + `prisma migrate deploy` で 17 マイグレーション適用
- 適用後検証: テーブル 121、enum 145

### Step 6: 旧 dump から新 `postgres-production` にデータ復元

- 対話スクリプト `run-restore-production.sh` を配置
- `pg_restore --data-only --disable-triggers` で復元
- 復元結果: 7 主要テーブル全件期待値一致、エラー 0、警告 0

### Step 7: Web 切り替え + ローカル `.env` 切り替え

#### 7-1〜7-4: Railway 上の `shunya-pms-web` 切り替え

- `DATABASE_URL` を `${{ postgres-production.DATABASE_URL }}` に変更 (変数参照型)
- Railway 自動再デプロイ (Next.js 16.2.6 起動成功)
- Web 動作確認: 3 ページ (product-categories 27 / material-categories 36 / materials 0) すべて期待件数で表示

#### 7-5a: 新 `postgres-development` に schema + データ構築

- 既存スクリプトを `cp + sed` で dev 用に複製
- 三重ガード再設計 (旧本番 + 新本番を拒否、新 dev のみ通過)
- migrate + restore 完了、新本番と同じデータ状態を実現

#### 7-5b: ローカル `.env` を新 dev に切り替え

- 対話スクリプト `run-switch-dotenv-to-dev.sh` を配置
- 書き換え前に `.env.backup-20260529-171630` を作成 (chmod 600)
- 接続テスト OK 確認後に `.env` を原子的に書き換え

### Step 8: 旧 `postgres-dev-shunya-pms` + volume 削除

- Railway GUI から旧サービス削除
- 孤児 `postgres-volume` を別途削除
- Railway docs より「Volume 削除後 48 時間は復元可能」(復元メールは保管)

---

## 安全装置の設計

### 共通設計原則

1. **DATABASE_URL は対話入力**: `read -s` でシェル履歴に残さない
2. **bash サブシェル経由**: 親シェルに環境変数を漏らさない
3. **`unset` で二重保険**: スクリプト末尾でクリーンアップ
4. **chmod 600/700**: ファイル権限の最小化

### 三重ガード

各スクリプトで以下のいずれかにマッチする URL を拒否:

| ガード | 対象 |
|---|---|
| `.env` 動的抽出 | スクリプト実行時点の現行本番ホスト |
| ハードコード 1 | `hopper.proxy.rlwy.net:57014` (旧本番) |
| ハードコード 2 | 各スクリプトで「触ってはいけない他環境」を追加 |

### スクリプトごとのガード詳細

| スクリプト | 通過対象 (ホスト) | 拒否対象 (ハードコード) |
|---|---|---|
| `run-migrate-production.sh` | `shuttle.proxy.rlwy.net:16099` (新本番) | hopper:57014 (旧本番) + hopper:12921 (新 dev) |
| `run-restore-production.sh` | 同上 | 同上 |
| `run-migrate-development.sh` | `hopper.proxy.rlwy.net:12921` (新 dev) | hopper:57014 (旧本番) + shuttle:16099 (新本番) |
| `run-restore-development.sh` | 同上 | 同上 |
| `run-switch-dotenv-to-dev.sh` | 同上 | 同上 |

### 空 DB チェック

migrate 系: `public` スキーマのテーブル数 = 0 を確認してから migrate 実行 (上書き事故防止)
restore 系: テーブル 121 + マイグレーション 17 + product_categories 0 件 を確認してから restore 実行 (空テーブルにのみ復元)

---

## 教訓

### 1. Claude (Claude.ai 側) の幻覚値混入

Step 2 のバックアップスクリプト設計時、私は旧本番のホスト名を `shuttle.proxy.rlwy.net:16099` と推測でハードコードした。実際には旧本番は `hopper.proxy.rlwy.net:57014` で、Claude Code が `.env` を確認して訂正した。

しかし私は Step 5 のスクリプトで「念のための二重保険」として `shuttle.proxy.rlwy.net:16099` をハードコードに残してしまった。これが Railway が新規 `postgres-production` に偶然割り当てた proxy 名と一致し、本物の新本番が三重ガードで誤拒否される事態が起きた。

**学び**: 推測値を「二重保険」として残すと、後で意味不明なガードとして悪影響を及ぼす。情報が更新されたら不要なものは削除すべき。

### 2. Claude Code の動的抽出の価値

Claude Code が `.env` の DATABASE_URL を動的に抽出してホスト名を表示してくれたことで、Claude.ai 側の推測が間違っていたことが早期に判明した。**「現場のファイルが真実の源」**という設計原則は強い。

### 3. サービス命名の重要性

`postgres-dev-shunya-pms` という名前は、当初の意図がどうあれ、後から見れば「dev」と誤解されるリスクが高い。新サービスは `postgres-production` / `postgres-development` と用途明示型に統一した。

### 4. URL 取り違え事故の回避

「postgres-production の URL をコピーしたつもりが、別の URL になっていた」事故が 1 回発生。三重ガードと「期待ホスト不一致時に yes/no 確認」のスクリプト設計で実害ゼロに留まった。

**学び**: クリップボード経由の URL 受け渡しは、ガードがないと事故りやすい。

### 5. pager 中断問題

`psql` のデフォルト pager (`less`) が出力を pager に渡し、対話スクリプトを止める事態が複数回発生 (Step 2 / 5 / 7-5a-1)。restore 系には `PAGER=cat` / `PSQL_PAGER=cat` / `--pset pager=off` を導入して回避。migrate 系には未対応のまま (今後の改善余地)。

---

## 残課題と改善バックログ

### 完了マーク

- **B-011** (dev 環境構築の設計議論): ✓ 完了 (案 Z で実現)
- **B-012** (本番 DB サービス名のリネーム検討): ✓ 完了 (案 Z で実現)
- **B-013** (shunya-pms-web の DATABASE_URL を変数参照型に移行): ✓ 完了 (案 Z で実現)

### 新規追加

- **B-014**: Prisma 6.19.3 → 7.8.0 メジャーアップグレード検討
  - 優先度: 低
  - Phase 1A 完了後に別 PR で対応想定
  - migrate deploy 実行時の通知から発見

### 今後の改善余地 (バックログには未登録)

- `run-migrate-*.sh` 系の pager 中断問題への対応 (`PAGER=cat` 等の追加)
- スクリプトの三重ガードを共通化 (現状は各スクリプトに重複)

---

## 関連 PR / コミット

- 本セッションの docs PR: PR #38 (squash merge: c33dc1d)

## 関連ドキュメント

- `docs/SESSION_HANDOVER.md` (更新)
- `docs/phase1a-improvement-backlog.md` (B-011/B-012/B-013 完了マーク + B-014 追加)
- `~/shunya-pms-backups/` (慎太郎さん Mac、リポジトリ外): dump 2 種類 + .env バックアップ + スクリプト 6 本
