# 品質表示メーカーアプリ 引き継ぎ書

> **次のチャットでの目的**: 本アプリを **shunya-pms (生産管理システム) に統合・取り込みする** ための引き継ぎ。
> 単体運用していたアプリを、shunya-pms の機能の一部 (商品マスター・発注機能と紐づける) として再設計する。

最終更新: 2026-05-09  
担当: Shin (合同会社 shunya / 株式会社shunya)

---

## 1. アプリ概要

### プロダクト名
**品質表示メーカー (Quality Label Maker)**

### 目的
アパレル製品の以下 3 種類の表示物を、縫製仕様書から自動生成し、印刷メーカーへ発注メール送信まで一貫処理する Web アプリ。

| 出力物 | サイズ | 法令対応 |
|---|---|---|
| 品質表示 (洗濯ネーム) | 60×110mm | 家庭用品品質表示法 + JIS L 0001 |
| 下げ札 (ハングタグ) | 55×95mm | 上代総額表示義務 (消費税法63条) |
| アテンションタグ | 80×110mm | (任意) 注意喚起 |

### 主要機能
1. **縫製仕様書の AI 自動読取** (Claude Vision API)
2. **数量マトリックス** (カラー × サイズ) で生産数量管理
3. **予備枚数自動加算** (各SKUに +N枚)
4. **JIS L 0001 絵表示 7 区分** の選択 (48 種 SVG, 法令固定順序)
5. **パーツ別組成** (表地/裏地/リブ 各 100% チェック)
6. **付記用語マスター** (DB管理、カテゴリ別)
7. **印刷メーカーマスター** (発注先・宛先管理)
8. **発注メール送信** (Resend API, 添付つき)
9. **発注書サマリー PDF** 動的生成

### 想定ユーザー
- shunya (Shin) 自身: 内部管理用
- MARKA さん向け: 中谷タスクさん・福田さん (石川さんの会社スタッフ) が使用

---

## 2. 本番環境

### URL
**https://quality-label-app-production.up.railway.app/**

### 認証
- ユーザー名: `admin`
- パスワード: `admin123`
- 環境変数 `ADMIN_USER` / `ADMIN_PASS` で設定 (Railway Variables)
- セッション認証 (`express-session` + cookie)
- Cookie はリバースプロキシ対応: `trust proxy=1`, `secure='auto'`, `sameSite='lax'`

### Railway 構成
- **Workspace**: shintarokoenuma's Projects
- **Project**: `wholesome-unity` (EarnPulse と相乗り)
- **Service 1**: `quality-label-app` (Web サーバー / Express)
- **Service 2**: `quality-label-db` (Railway Postgres)

### GitHub
- **Repository**: https://github.com/shintarokoenuma/quality-label-app (Private)
- **Branch**: `main` (直 push)
- **Deploy**: Railway 自動デプロイ on push

---

## 3. 技術スタック

### バックエンド
| 項目 | 詳細 |
|---|---|
| 言語 | Node.js 20+ |
| フレームワーク | Express 4.x (saagara-v2 流モノリス) |
| DB | Railway Postgres |
| DB クライアント | pg 8.x |
| セッション | express-session |
| ファイルアップロード | multer |
| AI | @anthropic-ai/sdk (Claude Opus 4.7) |
| PDF生成 | puppeteer 23.x (Chromium Nix Store 検出, snap shim 除外, バンドル fallback) |
| ストレージ | Cloudflare R2 (@aws-sdk/client-s3) |
| メール | resend 4.x |

### フロントエンド
- 素の HTML/CSS/JS (フレームワーク無し)
- フォント: Noto Sans JP, Noto Serif JP, DM Mono
- カラー: Stone Apple HIG 風 (`#1c1917` ink, `#fafaf7` bg)

---

## 4. データベーススキーマ

### 4.1 `companies` (会社マスター)
表示者として法令必須情報を保持
```sql
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  postal_code VARCHAR(20),
  address TEXT,
  phone VARCHAR(50),
  fax VARCHAR(50),
  email VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
**初期データ**:
- shunya (合同会社shunya)
- MARKA (株式会社マーカ)

### 4.2 `brands` (ブランドマスター)
```sql
CREATE TABLE brands (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id),
  code VARCHAR(50) UNIQUE,
  name VARCHAR(100),
  display_name VARCHAR(100),
  default_origin VARCHAR(50) DEFAULT '日本',
  default_care JSONB DEFAULT '{}'::jsonb,    -- 既定の取扱い記号
  default_notes JSONB DEFAULT '[]'::jsonb,   -- 既定の付記用語 (文字列配列)
  is_active BOOLEAN DEFAULT TRUE
);
```
**初期データ**:
- shunya, shunya basics
- MARKA, MARKAWARE, MARKAWARE WHITE LINE

### 4.3 `jis_symbols` (JIS L 0001 絵表示マスター)
```sql
CREATE TABLE jis_symbols (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  jis_number VARCHAR(10),
  category VARCHAR(30) NOT NULL,   -- wash | bleach | dry_tumble | dry_natural | iron | dryclean | wetclean
  label_jp VARCHAR(200),
  label_en VARCHAR(200),
  image_url TEXT,                  -- R2 上の SVG URL
  display_order INT,
  is_active BOOLEAN DEFAULT TRUE
);
```
**初期データ**: 48 件 (JIS L 0001 全カテゴリ網羅)  
**SVG**: R2 上 (`saagara-images/quality-labels/jis-symbols/{code}.svg`)  
**生成スクリプト**: `scripts/generate-jis-svgs.js` (幾何学的形状で SVG 生成、JIS 規格準拠)

### 4.4 `fiber_names` (繊維名マスター)
家庭用品品質表示法 別表第二 準拠の 27 種類
- 綿、麻、リネン、ラミー、毛、ウール、カシミヤ、アンゴラ、モヘヤ、アルパカ、絹、シルク、レーヨン、ビスコース、キュプラ、リヨセル、テンセル、ポリノジック、アセテート、トリアセテート、ナイロン、ポリエステル、アクリル、ポリウレタン、ポリプロピレン、ビニロン、指定外繊維

### 4.5 `care_notes_master` (付記用語マスター) ★新規
```sql
CREATE TABLE care_notes_master (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) UNIQUE NOT NULL,
  category VARCHAR(50),              -- 洗濯 | 乾燥 | アイロン | 全般 | その他
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);
```
**初期データ** (13件):
- 洗濯: 洗濯ネット使用、裏返しにして洗う、単独洗い、色落ちの恐れあり、蛍光増白剤の入っていない洗剤を使用、弱く絞る
- 乾燥: 形を整えて干す、陰干し
- アイロン: あて布使用、飾り部分アイロン禁止、プリント部分の上からのアイロン禁止
- 全般: ドライクリーニング推奨、シミがついた場合は早めにご相談ください

### 4.6 `print_makers` (印刷メーカーマスター) ★新規
```sql
CREATE TABLE print_makers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,         -- 例: アパレルックス
  email VARCHAR(200) NOT NULL,        -- 主担当
  cc_emails JSONB DEFAULT '[]'::jsonb,
  contact_person VARCHAR(100),
  default_message TEXT,
  notes TEXT,                         -- 社内メモ
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0
);
```
**初期データ**: 空 (運用時に登録)

### 4.7 `labels` (作成済みラベルの履歴)
```sql
CREATE TABLE labels (
  id SERIAL PRIMARY KEY,
  company_id INT, brand_id INT,
  product_code VARCHAR(100),
  product_name VARCHAR(200),
  origin VARCHAR(50),
  composition JSONB,                  -- [{part, fibers:[{name,percent}]}]
  size_quantities JSONB,              -- (互換性のため残置)
  colors JSONB,                       -- ['黒','ネイビー']
  quantity_matrix JSONB,              -- {color: {size: qty}}
  extra_qty INT DEFAULT 0,
  care_symbols JSONB,                 -- {wash: 'C100', bleach: 'B10', ...}
  care_notes JSONB,                   -- ['洗濯ネット使用', ...]
  features TEXT, cautions TEXT,
  wholesale_price INT,
  tax_rate DECIMAL(5,2) DEFAULT 10,
  spec_file_url TEXT,                 -- R2上の縫製仕様書URL
  spec_file_name VARCHAR(255),
  output_files JSONB,                 -- 生成PDFのR2URL集合 + last_sent
  extracted_by VARCHAR(20),           -- 'ai' | 'manual'
  extraction_raw JSONB,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### スキーマ自動マイグレーション ★重要
`server.js` 起動時に `sql/schema.sql` を自動実行。
- すべての `CREATE TABLE` は `IF NOT EXISTS`
- すべての `INSERT` は `ON CONFLICT DO NOTHING`
- カラム追加は `DO $$ BEGIN ... ALTER TABLE ... ADD COLUMN IF NOT EXISTS ... END $$`
- `AUTO_MIGRATE=false` 環境変数で無効化可能
- ログ出力: `[migrate] schema applied` / `[migrate] failed: ...`

これにより、Railway 側で `railway run` する必要なく、`git push` だけでスキーマ更新が反映される。

---

## 5. 環境変数 (Railway Variables)

### quality-label-app サービス
```
# 認証
ADMIN_USER=admin
ADMIN_PASS=admin123
SESSION_SECRET=(ランダム)

# DB (Railway 自動注入)
DATABASE_URL=postgresql://...
DATABASE_PUBLIC_URL=postgresql://...  ← railway run 用

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# R2 (saagara-v2 と共有)
R2_ENDPOINT=https://...r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=saagara-images
R2_PUBLIC_URL=https://images.shunya.cc
R2_PREFIX=quality-labels        ← この prefix で saagara-v2 と分離

# Resend (saagara-v2 と共有)
RESEND_API_KEY=re_...            ← saagara-v2 と同じ値
RESEND_FROM=info@shunya.cc       ← saagara-v2 と同じ
SMTP_FROM_NAME=Shunya            ← saagara-v2 では 'sAagara SHOWROOM'、ここは別途

# 自動マイグレーション制御 (オプション)
AUTO_MIGRATE=true   # false で無効化

# Puppeteer 関連は不要 (削除済み)
# PUPPETEER_EXECUTABLE_PATH ← 設定不要
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD ← 設定不要
```

### 重要な過去のハマリポイント
- **Railway CLI で env 設定すると `<>` で値が wrap される**: Web UI から手動編集を推奨
- **Puppeteer**: Nix Store 検出 + snap shim 除外 + バンドル fallback で解決済み (`lib/pdf-renderer.js`)
- **セッション cookie**: `app.set('trust proxy', 1)` + `secure: 'auto'` で解決済み

---

## 6. ファイル構成 (現状の本番コード)

```
quality-label-app/
├── server.js                          ← Express エントリ + 自動マイグレーション
├── database.js                        ← pg プール (singleton)
├── package.json                       ← deps: express, pg, multer, puppeteer, @anthropic-ai/sdk, @aws-sdk/client-s3, resend
├── railway.json                       ← Nixpacks 設定
├── .env.example
├── .gitignore                         ← .env, .env.bak, package-lock.json, node_modules
├── README.md
│
├── lib/
│   ├── claude.js                      ← Claude Vision API ラッパー (quantity_matrix 対応)
│   ├── jis-symbols.js                 ← 48 種 JIS 記号メタデータ + CATEGORY_ORDER エクスポート
│   ├── pdf-renderer.js                ← Puppeteer ラッパー (Chromium 自動検出)
│   ├── pdf-templates.js               ← 品質表示/下げ札/アテンション の HTML テンプレート
│   ├── r2.js                          ← Cloudflare R2 ラッパー (upload, listObjects)
│   ├── resend.js                      ← Resend API ラッパー (saagara-v2 方式)
│   └── order-pdf.js                   ← 発注書サマリー PDF テンプレート (A4)
│
├── middleware/
│   └── auth.js                        ← セッション認証 (requireAuth)
│
├── routes/
│   ├── auth.js                        ← /api/auth/login, /api/auth/logout
│   ├── master.js                      ← 会社/ブランド/JIS/繊維 + 付記用語/印刷メーカー CRUD
│   ├── extract.js                     ← /api/extract (Claude Vision 仕様書解析)
│   ├── labels.js                      ← /api/labels (ラベル保存・履歴)
│   ├── pdf.js                         ← /api/pdf/preview, /api/pdf/generate
│   └── orders.js                      ← /api/orders/preview, /api/orders/send (Resend送信)
│
├── public/
│   ├── index.html                     ← ラベル作成画面
│   ├── login.html                     ← ログイン
│   ├── master.html                    ← マスター管理 (タブ式: 会社/ブランド/付記用語/印刷メーカー)
│   ├── history.html                   ← 作成履歴
│   ├── css/common.css                 ← Apple HIG 風スタイル
│   └── js/
│       ├── header.js                  ← ヘッダー共通
│       ├── app.js                     ← ラベル作成ロジック
│       ├── master.js                  ← マスター管理ロジック
│       └── history.js                 ← 履歴ロジック
│
├── scripts/
│   ├── init-db.js                     ← DB 初期化スクリプト (現在は不要、自動マイグレーション)
│   ├── download-jis-symbols.js        ← (未使用、廃止予定)
│   └── generate-jis-svgs.js           ← JIS 記号 SVG 生成 (48 種)
│
└── sql/
    └── schema.sql                     ← 全テーブル定義 + 初期データ (再実行安全)
```

---

## 7. R2 ストレージ構造

**Bucket**: `saagara-images` (saagara-v2 と共有)  
**Prefix**: `quality-labels/`

```
saagara-images/
├── quality-labels/                    ← このアプリ専用 prefix
│   ├── specs/                         ← 縫製仕様書 (元データ)
│   │   └── {timestamp}-{filename}.pdf
│   ├── outputs/                       ← 生成済み PDF
│   │   ├── {sku}-quality.pdf
│   │   ├── {sku}-hangtag.pdf
│   │   └── {sku}-attention.pdf
│   └── jis-symbols/                   ← JIS L 0001 SVG (48種)
│       ├── W10.svg                    ← 95℃以下で洗濯機洗い
│       ├── W11.svg
│       ├── B10.svg                    ← 塩素・酸素系漂白剤使用可
│       ├── ...
│       └── E10.svg
├── (saagara-v2 が使う他の prefix)
└── ...
```

**公開アクセス URL**: `https://images.shunya.cc/quality-labels/...`

---

## 8. API エンドポイント一覧

### 認証
- `POST /api/auth/login` ── 認証
- `POST /api/auth/logout` ── ログアウト

### マスター CRUD
- `GET /api/master/companies`, `POST`, `PUT /:id`, `DELETE /:id`
- `GET /api/master/brands`, `POST`, `PUT /:id`, `DELETE /:id`
- `GET /api/master/jis-symbols`
- `GET /api/master/fibers`
- `GET /api/master/care-notes`, `POST`, `PUT /:id`, `DELETE /:id` ★新規
- `GET /api/master/print-makers`, `POST`, `PUT /:id`, `DELETE /:id` ★新規

### ラベル
- `POST /api/extract` ── 縫製仕様書アップロード + AI 解析  
  - body: multipart/form-data (file)
  - returns: `{ extracted, spec_file_url, spec_file_key, spec_file_name, raw }`
- `POST /api/labels` ── ラベル保存
- `GET /api/labels` ── 履歴一覧
- `GET /api/labels/:id` ── 単体取得
- `POST /api/pdf/preview` ── プレビュー PDF (単体)
- `POST /api/pdf/generate` ── 本生成 (複数SKU一括 + R2アップロード)

### 発注メール ★新規
- `POST /api/orders/preview` ── 送信プレビュー (宛先・件名・From確認)
- `POST /api/orders/send` ── メール送信実行 (添付付き)

---

## 9. 主要ロジックの抜粋

### 9.1 SKU 命名規則
- **品質表示**: `{品番}-{サイズ}` (例: `25SY-15-2nd-1`)
  - 組成・取扱いは色問わず同一だが、サイズ表記を入れる
  - 数量は **サイズ単位で集計** (全カラーの合計)
- **下げ札**: `{品番}-{カラー}-{サイズ}` (例: `25SY-15-2nd-黒-1`)
  - **カラー × サイズ単位** の SKU
- **アテンション**: `{品番}` のみ
  - 全 SKU 共通の1ファイル

### 9.2 数量計算
```js
quantity_matrix = {
  "黒":     { "1": 1, "2": 1 },
  "ネイビー": { "2": 1, "3": 2 },
  "グレー":   { "3": 2, "4": 2 }
}
extra_qty = 1   // 各SKU+1枚

// 品質表示の出力枚数 (サイズ別集計)
size_1: 黒(1) → 1+1=2
size_2: 黒(1)+ネイビー(1) → 2+1=3
size_3: ネイビー(2)+グレー(2) → 4+1=5
size_4: グレー(2) → 2+1=3
合計13枚 (4SKU)

// 下げ札の出力枚数 (カラー×サイズ別)
黒-1:    1+1=2 / 黒-2: 1+1=2 / ネイビー-2: 1+1=2 / ネイビー-3: 2+1=3 / グレー-3: 2+1=3 / グレー-4: 2+1=3
合計16枚 (6SKU、本来枚数9 + 予備6 ※実際の値)

// アテンションの出力枚数
1 + 1 = 2枚 (1SKU)
```

### 9.3 メール送信フロー
1. ユーザーが「保存 + 一括生成」 → labels テーブルに保存、PDF を R2 にアップロード
2. 「メーカーへ発注メール送信」ボタンクリック
3. モーダルで送信先メーカー選択 + 件名 + 連絡事項を編集
4. `/api/orders/send` 実行:
   - 発注書サマリー PDF を**動的生成** (`lib/order-pdf.js`)
   - 縫製仕様書を R2 から downloadUrl で取得
   - 全 PDF (品質表示・下げ札・アテンション) を R2 から取得
   - `lib/resend.js` で送信
5. `labels.output_files.last_sent` に送信ログを追記

### 9.4 メール本文テンプレート
件名: `【発注】{ブランド} {品番} タグ・ラベル製作のご依頼`

本文 (HTML):
```
{担当者} 様

いつもお世話になっております。
{会社名}でございます。

下記製品のタグ・ラベル製作をお願いいたします。
詳細は添付の発注書PDFをご確認ください。

■ 商品情報
ブランド: {ブランド}
品番: {品番}
品名: {品名}
生産数量: {総枚数}枚 (各SKU 予備+{N}枚)

■ 製作物
品質表示: {数}種
下げ札: {数}種
アテンション: {数}種
合計 必要枚数: {N}枚

■ 添付ファイル
- 発注書サマリー (本書の詳細)
- 縫製仕様書 (元データ)
- 品質表示 PDF (各SKU)
- 下げ札 PDF (各SKU)
- アテンション PDF

{custom_message があれば連絡事項として追記}

ご不明点がございましたらお気軽にご連絡ください。
よろしくお願いいたします。

--
{会社名}
{住所}
TEL {電話}
Email: {メール}
```

---

## 10. 引き継ぎ書としての shunya-pms 統合への提言

### 10.1 shunya-pms 側の現状 (記憶情報)
- **デプロイ**: `https://shunya-pms-web-production.up.railway.app`
- **GitHub**: `shintarokoenuma/shunya-pms`
- **ローカル**: `~/shunya-production-system`
- **Stack**: Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4, Prisma 6, Railway Postgres, NextAuth.js v5
- **Phase 0 完了**: 119 models, 135 Enum types, 8,909 lines across 10 schema files
- **Phase 1A**: マスター管理 (clients, suppliers, factories) — 次の開発段階

### 10.2 統合戦略の検討ポイント

#### A. データモデルの統合
shunya-pms の既存スキーマ (Prisma) と本アプリの Postgres スキーマを **どう整合させるか**:

| 本アプリのテーブル | shunya-pms 側で対応するモデル(想定) |
|---|---|
| `companies` | `companies` または `tenant` (multi-tenant) |
| `brands` | `brands` (おそらく既存) |
| `jis_symbols` | 新規 `JisSymbol` モデル |
| `fiber_names` | 新規 `FiberName` モデル |
| `care_notes_master` | 新規 `CareNote` モデル |
| `print_makers` | **既存 `suppliers` や `factories` に統合可能?** (Phase 1A スコープ) |
| `labels` | **新規 `QualityLabel` モデル**, または **`Product` モデルに紐づく `LabelData` リレーション** |

→ shunya-pms の `Product` モデル / `Order` モデルとの紐付けが鍵。
→ 「製品マスター」を発注書発行のソース・オブ・トゥルース化できる。

#### B. 機能の取捨選択
shunya-pms 側で **既に持っている機能** は、本アプリから移植不要:
- 認証 (NextAuth.js v5 にすでに移行している可能性)
- 会社・ブランドマスター CRUD
- ファイルアップロード基盤

本アプリ固有の **移植すべきコア機能**:
1. JIS L 0001 SVG マスター (48 種) ← 完全に流用可能
2. 繊維名マスター (家庭用品品質表示法 別表第二) ← 完全に流用可能
3. 縫製仕様書 AI 自動読取 (Claude Vision プロンプト) ← `lib/claude.js`
4. 数量マトリックス (カラー × サイズ) ロジック
5. 3 種 PDF テンプレート (品質表示・下げ札・アテンション) ← `lib/pdf-templates.js`
6. 発注書サマリー PDF テンプレート ← `lib/order-pdf.js`
7. Resend 送信ラッパー ← `lib/resend.js` (saagara-v2 と共有)

#### C. UI フレームワークの差異
- 本アプリ: 素の HTML/CSS/JS (Apple HIG 風)
- shunya-pms: Next.js + Tailwind CSS v4

→ React コンポーネントへの **書き直し** が必要 (ロジックは流用可)。  
→ 数量マトリックス UI は重要な部品 (React Hook ベースで再実装)。

#### D. PDF 生成基盤
本アプリは Puppeteer (重い、Chromium 必要)。  
shunya-pms 側ですでに PDF 生成手段がある場合:
- `@react-pdf/renderer` (React Native ベース、軽量)
- `pdfkit` + node-canvas
- Puppeteer 流用 (Railway デプロイ実績あり)

→ shunya-pms 側の選定に合わせる。`lib/pdf-templates.js` の HTML 構造は流用可能。

#### E. R2 prefix の整理
- 現状: `saagara-images/quality-labels/`
- shunya-pms 統合後: `saagara-images/shunya-pms/labels/` などに移行?

→ saagara-v2, quality-label-app, shunya-pms の 3 アプリで R2 バケットを共有しているため、 prefix 設計の見直しが必要。

#### F. Resend ドメイン認証
- saagara-v2, quality-label-app は `info@shunya.cc` を使用
- shunya-pms も同ドメインを使用予定なら、特別な追加設定なし

---

## 11. 引き継ぎ時点での未解決問題

### 11.1 直近の本番反映状態の確認が必要
最終 push (`f247a91 Use saagara-v2 mail env vars`) 後に Shin が「**何も変わってない**」と報告。
具体的な状態を切り分けていない。可能性:

| 仮説 | 確認方法 |
|---|---|
| ブラウザキャッシュ | 強制リロード (Cmd+Shift+R) |
| Railway デプロイ未完了 | `railway logs` で `[server] running on :8080` 確認 |
| 環境変数未設定 | Railway → Variables で `RESEND_API_KEY`, `RESEND_FROM`, `SMTP_FROM_NAME` 確認 |
| マイグレーション失敗 | `railway logs` で `[migrate] schema applied` 確認 |
| ファイル上書き漏れ | `grep -c "openEmailModal" public/js/app.js` 等で反映確認 |

### 11.2 動作確認できていない機能
- 印刷メーカーマスターの CRUD (UI 動作)
- 付記用語マスターのCRUD (UI 動作)
- 発注メール送信 (実送信テスト未実施)
- 添付ファイル付きメールの実際の挙動

### 11.3 仕様調整候補 (将来)
- 品質表示・下げ札・アテンションの **正式フォーマット** を MARKA さんに確認 → レイアウト微調整
- GINETEX ライセンス取得 (海外展開時)
- 縫製仕様書 AI 抽出精度の検証
- 履歴ページの動作確認、再発注機能
- 発注書テンプレートのカスタマイズ機能 (ブランド毎にロゴ・配色変更)

---

## 12. デプロイ・運用手順

### 通常デプロイ (コード変更のみ)
```bash
cd ~/Downloads/quality-label-app
git add .
git commit -m "..."
git push
# → Railway 自動デプロイ
# → 自動マイグレーション (sql/schema.sql 適用)
```

### Railway ログ確認
```bash
cd ~/Downloads/quality-label-app
railway link   # quality-label-app を選択
railway logs
```

期待出力:
```
[migrate] schema applied
[server] running on :8080
```

### DB に直接接続したい場合
```bash
railway link   # quality-label-db を選択
railway run sh -c 'psql $DATABASE_PUBLIC_URL'
# または特定の SQL を実行:
railway run sh -c 'psql $DATABASE_PUBLIC_URL -c "SELECT COUNT(*) FROM labels;"'
```

### 環境変数の追加 (推奨方法)
ブラウザで Railway → wholesome-unity → quality-label-app → Variables → New Variable → 手動入力  
※ CLI (`railway variables set`) は `<>` 自動付加バグがあるため避ける

---

## 13. 関連リンク・参照

### Anthropic 関連
- Claude Vision API: https://docs.claude.com/en/docs/build-with-claude/vision
- モデル: claude-opus-4-7

### 法令関連
- 家庭用品品質表示法: https://www.caa.go.jp/policies/policy/representation/household_goods/
- JIS L 0001 (繊維製品の取扱いに関する表示記号): https://www.jisc.go.jp/
- 消費税法 第63条 (総額表示義務): https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/202004sogakuhyoji.htm

### 同業者参考
- ApparelX (アパレル品質表示について): https://apparelx-news.jp/apparel-material/qualittag
- カケンテストセンター (GINETEX 公認機関): https://www.kaken.or.jp/foundation/business/ginetex
- 消費者庁 取扱い表示ガイド: https://www.caa.go.jp/policies/policy/representation/household_goods/guide/wash_02.html

### 関連アプリ
- saagara-v2 (B2B ショールーム): https://saagara-v2-production.up.railway.app/
  - GitHub: shintarokoenuma/saagara-v2
- EarnPulse (US 決算 IR): wholesome-unity プロジェクト内
  - GitHub: shintarokoenuma/earnpulse
- shunya-pms (生産管理 ★統合先): https://shunya-pms-web-production.up.railway.app
  - GitHub: shintarokoenuma/shunya-pms

---

## 14. クライアント関係者

### MARKA (発注元)
- ブランド: MARKA, MARKAWARE, MARKAWARE WHITE LINE
- 主要連絡先: 中谷タスクさん、福田さん (石川さんの会社スタッフ)

### 印刷メーカー候補 (発注先)
- アパレルックス
- トップトータル
- ナケシ
- (運用開始時に Shin が追加登録)

---

## 15. 次のチャットへの引き継ぎ事項

### 即時アクション (シーケンシャル)
1. **直近の動作確認**: 上記「11.1 直近の本番反映状態」を切り分け、メール送信機能まで動作確認する
2. **shunya-pms 側のスキーマ確認**: `~/shunya-production-system/prisma/schema.prisma` を読み、本アプリのデータモデルとの対応を整理
3. **統合方針の決定**: 完全統合 (本アプリ廃止) か、API 連携 (両者並立) かを選択
4. **移植計画**: コア機能 (JIS, 繊維名, AI 抽出, PDF テンプレ, 数量ロジック) の優先順位付け

### 中期アクション
5. shunya-pms の Phase 1A (master 管理) 完了後に統合開始
6. Next.js + Prisma 環境への移植実装
7. React コンポーネント化された数量マトリックス UI の再実装
8. PDF 生成方式の選定 (Puppeteer 継続 or 別ライブラリ)

### 長期アクション
9. MARKA さん向け正式フォーマット反映
10. GINETEX 正規 SVG への差替 (海外展開時)
11. 多言語対応 (英語版品質表示)

---

## 引き継ぎ書 作成情報

- **作成者**: Claude (Anthropic Opus 4.7)
- **作成日**: 2026-05-09
- **対象開発者**: Shin (合同会社shunya)
- **次のチャットでの想定担当**: Claude (新しいセッション、または Claude Code)

何か不明点があれば、このアプリの GitHub リポジトリ (`shintarokoenuma/quality-label-app`) のコードと、本書を併読してください。
