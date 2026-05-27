# Phase 1A-13a Material（素材マスター・基本コア）仕様確定議事録

**作成日**: 2026 年 5 月 27 日
**作成者**: Shin（肥沼慎太郎） + Claude
**バージョン**: v1.0
**ステータス**: 確定（実装着手可能）

---

## 1. 目的

shunya 生産管理システム Phase 1A-13a にあたる Material（素材マスター）の基本コアフィールドの実装仕様を確定する。

Material は仕様書 Part 2 で「生地・副資材マスター。貿易データ（HSコード、原産国、組成等）を含む」と定義されている。これまでのマスターの中で最もフィールド数が多く（約 25）、生地特有 / 貿易特有 / Json 型 / 画像など多様な性質のフィールドを含む。そのため Phase 1A-13 は 3 段階に分割して実装する。

### Phase 1A-13 の分割

| サブフェーズ | 対象 | 状態 |
|---|---|---|
| **1A-13a** | 基本コア（本議事録の対象） | 今回実装 |
| 1A-13b | 生地特有 + 規格 + 貿易データ | 後追い |
| 1A-13c | 画像 + 色展開 + 参考サイト | 後追い |

---

## 2. 確定事項サマリー

| # | 論点 | 確定内容 |
|---|---|---|
| A-1 | 実装範囲 | **段階的実装**（13a/13b/13c の 3 段階） |
| A-2 | ステータス値 | **4 値 enum 化**（ACTIVE / INACTIVE / DISCONTINUED / ARCHIVED） |
| A-3 | materialType | **15 値すべて UI 露出**（既存 enum をそのまま使用） |
| A-4 | 採番方式 | **手動入力**（ユーザーが materialCode を直接入力） |
| B-1 | 参考サイト | **Phase 1A-13c で追加**（本議事録の対象外） |
| B-2 | MaterialCategory | **categoryId を optional のまま**（MaterialCategory は別タスクで実装） |
| D-1 | UI カード構成 | **4 カード**（基本情報 / 分類・仕入先 / 単価 / メモ・ステータス） |
| D-2 | 一覧フィルタ | **4 軸**（キーワード + Type + Supplier + Status） |
| D-4 | 多言語フィールド | **En のみ含める**（Zh/Vi は Phase 1A-13c） |

---

## 3. 論点 A: 実装方針

### A-1: 段階的実装

Material は約 25 フィールドあり、ModelCode の 2-3 倍の規模。一度に実装するとレビューも動作確認も重くなる。

Phase 1A-13a 対象フィールド（約 13 個）:

```
基本情報:
  materialCode (手動入力、必須)
  materialName (必須)
  materialNameEn

分類・仕入先:
  materialType (15 値 enum、必須)
  categoryId (optional、Select disabled)
  primarySupplierId (Select、必須)

単価:
  unitPrice
  currency (デフォルト JPY)
  unit (m / 個 / kg / 巻き 等、必須)
  minimumOrderQty

メモ:
  specification
  notes

ステータス:
  status (4 値 enum)
```

Phase 1A-13b 以降の対象（本議事録対象外）:

```
生地特有: fabricWeight / fabricWidth / composition / compositionData
規格:     standardUsage / standardLossRate
貿易:     hsCode / originCountry
画像:     imageUrl / swatchImageUrl
色展開:   availableColors
参考サイト: referenceSites (新規追加)
多言語:   materialNameZh / materialNameVi
```

### A-2: ステータスの 4 値 enum 化

既存スキーマでは `status String @default("ACTIVE") @db.VarChar(20)` と enum 化されていない。Phase 1A-13a で **MaterialStatus enum を新規追加** する。

```prisma
enum MaterialStatus {
  ACTIVE        // 現役素材
  INACTIVE      // 一時休止（仕入先在庫切れ等）
  DISCONTINUED  // 廃番
  ARCHIVED      // アーカイブ
}
```

ModelCode と同じ 4 値構成。Buyer/DD の 2 値構成とは異なる理由:

- 素材は仕入先在庫切れによる「一時休止」が業務上発生する
- 廃番（DISCONTINUED）は明示的な状態区別が必要

### A-3: materialType 15 値の扱い

既存 enum をそのまま使用する。Phase 1A-13a で日本語ラベルを定義する。

```
FABRIC          → 生地
LINING          → 裏地
INTERLINING     → 芯地
ZIPPER          → ファスナー
BUTTON          → ボタン
THREAD          → 糸
ELASTIC         → ゴム
TAPE            → テープ
LABEL           → ネーム
HANG_TAG        → 下げ札
CARE_LABEL      → 品質表示
PACKAGING_BAG   → 袋
POLYBAG         → ポリ袋
BOX             → 箱
OTHER           → その他
```

ラベルは `MATERIAL_TYPE_LABELS` 定数として `_components/labels.ts` に定義。

### A-4: 採番方式

**手動入力** とする。ModelCode の自動採番とは異なる方針。

理由:
- 素材コードは業界慣習（`COT-100`）、仕入先呼称（`SUP-A-12`）、自社略号（`FAB-AZURE-001`）が混在しがち
- 生地は色番、ボタンは形状番（`BTN-SQR-12mm`）など、materialType ごとに命名規則が異なる
- 自動採番にすると materialType ごとの prefix 連番という複雑な仕組みが必要になる

バリデーション:
- `materialCode`: 必須、1〜50 文字、英数字・記号（`A-Z0-9-_/.`）
- `@@unique([companyId, materialCode])` で重複防止

UI ヘルプテキスト:
> 例: FAB-COT-001（生地）/ BTN-SQR-12mm（ボタン）/ ZIP-METAL-15cm（ファスナー）など、自由に命名できます

---

## 4. 論点 B: スキーマ変更

### B-1: 参考サイトフィールド（Phase 1A-13c 対象）

ユーザーメモリにある「素材マスター等で『参考サイト』フィールドを追加する際はカテゴリ別整理（生地・ボタン・ファスナー・付属等）」は **Phase 1A-13c で実装** する。

Phase 1A-13c での想定構造:
```prisma
referenceSites Json?  @map("reference_sites")
// 例: { "生地": [...], "ボタン": [...], "ファスナー": [...], "付属": [...] }
```

Phase 1A-13a では対象外。

### B-2: MaterialCategory（別タスク）

ModelCode における ProductCategory と同じ問題。MaterialCategory は階層構造（`parentCategoryId` による自己参照）が組まれており、実装が複雑。

対応方針:
- **categoryId は optional のまま** 実装（既存スキーマ通り）
- フォームの Category Select は表示するが、disabled で「素材カテゴリマスター実装後に選択可能になります」のヘルプを表示
- MaterialCategory 実装は別タスク（Phase 1A-14 など）

### B-3: その他のスキーマ変更

Phase 1A-13a で必要なスキーマ変更は MaterialStatus enum の追加のみ。

```prisma
// 変更前
status String @default("ACTIVE") @db.VarChar(20)

// 変更後
status MaterialStatus @default(ACTIVE)
```

マイグレーション必要:
- `npx prisma migrate dev --name add_material_status_enum`
- 既存データの status が文字列で "ACTIVE" 等の場合は USING で enum にキャストするマイグレーションが自動生成される想定
- 既存データが 0 件の場合は単純な ALTER TABLE で済む

---

## 5. 論点 C: 依存関係

### C-1: Supplier（実装済み）への依存

Supplier は Phase 1A-?（既に実装済み）。primarySupplierId で参照する。

問題: 既存スキーマでは `primarySupplierId String?` の FK 列はあるが **Prisma relation も DB FK 制約も未定義**（ModelCode の brandId と同じ穴）。

Phase 1A-13a での対応:
- スキーマ変更を避けるため、Supplier サマリは別クエリで取得して JS merge
- `fetchSupplierSummariesByIds()` ヘルパーを定義
- ModelCode の `fetchBrandSummariesByIds` と同じパターン

将来の整備候補（Phase 1B 以降）:
- Material.primarySupplierId に Prisma relation 追加
- DB レベルで FK 制約追加

### C-2: MaterialCategory（未実装）への依存

既存スキーマでは `category MaterialCategory? @relation(fields: [categoryId], references: [id])` と **relation 定義済み**（ModelCode の brandId と異なる点）。

ただし MaterialCategory データが存在しないため、Phase 1A-13a では:
- categoryId は null のままで Material を作成可能
- Category Select は disabled（選択肢は空）
- MaterialCategory 実装後、自動的に選択肢が埋まる

### C-3: 必須 vs オプション

Phase 1A-13a で必須にするフィールド:
- materialCode、materialName、materialType、primarySupplierId、unit

その他はすべて optional。

primarySupplierId を必須にする理由:
- 素材は「どこから仕入れるか」が業務上常に必要
- BOM / PO で参照する際、仕入先情報がないと発注書が作れない

---

## 6. 論点 D: UI 設計

### D-1: 4 カード構成

```
カード 1: 基本情報
├─ materialCode (手動入力、必須)
├─ materialName (必須)
└─ materialNameEn

カード 2: 分類・仕入先
├─ materialType (15 値 Select、必須)
├─ categoryId (Select、optional、disabled)
└─ primarySupplierId (Select、必須)

カード 3: 単価
├─ unitPrice
├─ currency (デフォルト JPY)
├─ unit (必須、自由入力。プレースホルダ: 「m / 個 / kg / 巻き」)
└─ minimumOrderQty (MOQ)

カード 4: メモ・ステータス
├─ specification (Textarea)
├─ notes (Textarea)
└─ status (4 値 Select)
```

### D-2: 一覧画面のフィルタ（4 軸）

- **キーワード検索**: `materialCode` / `materialName` / `materialNameEn` の部分一致
- **Type フィルタ**: ALL / 15 値の各 materialType
- **Supplier フィルタ**: ALL / ACTIVE な Supplier 一覧
- **Status フィルタ**: ALL / 4 値

Phase 1A-13a 時点では Category フィルタは含めない（別タスクで MaterialCategory 実装後）。

### D-3: 一覧テーブルのカラム構成

```
| Code | Name | Type | Supplier | Price | Status | [詳細] |
```

- Code: materialCode（font-mono）
- Name: materialName + materialNameEn（サブ）
- Type: バッジ表示（materialType のラベル）
- Supplier: supplier.supplierName（リンクで /suppliers/{id} へ）
- Price: `{unitPrice} {currency}/{unit}` （例: 1,200 JPY/m）
- Status: バッジ表示（4 値の色分け）

### D-4: 多言語フィールド（En のみ）

Phase 1A-13a では materialNameEn のみ UI に露出。materialNameZh / materialNameVi は Phase 1A-13c で UI 追加。

理由:
- Client/Brand/Supplier の precedent と整合
- 海外取引が始まってからでも UI 露出は遅くない
- スキーマには既に存在するため、データ自体は Phase 1A-13c で UI から入力可能になる

### D-5: 詳細画面の構成

フォームの 4 カードに加え、以下を表示:

- セクション「Phase 1A-13b / 13c で表示予定の項目」: プレースホルダ表示
  - 「生地特有データ（fabricWeight / composition 等）は Phase 1A-13b で追加されます」
  - 「画像 / 色展開 / 参考サイトは Phase 1A-13c で追加されます」

- 詳細画面の編集ボタン、archive / restore / 物理削除ボタンも master-patterns に従って配置

---

## 7. データモデル（最終版）

### 既存スキーマからの変更点

```prisma
model Material {
  // ... 既存フィールドは変更なし ...

  // 変更前
  // status String @default("ACTIVE") @db.VarChar(20)

  // 変更後
  status MaterialStatus @default(ACTIVE)

  // ... 既存リレーション・インデックスは変更なし ...
}

// 新規追加
enum MaterialStatus {
  ACTIVE
  INACTIVE
  DISCONTINUED
  ARCHIVED
}
```

### マイグレーション

```bash
npx prisma migrate dev --name add_material_status_enum
```

既存データが存在する場合の SQL イメージ:
```sql
-- 1. enum 型を作成
CREATE TYPE "MaterialStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'ARCHIVED');

-- 2. 列の型を変換（既存の文字列値を enum にキャスト）
ALTER TABLE "materials"
ALTER COLUMN "status" TYPE "MaterialStatus"
USING "status"::"MaterialStatus";

-- 3. デフォルト値を設定
ALTER TABLE "materials" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
```

既存データが 0 件であれば、単純な DROP + ADD でも可。

---

## 8. 実装手順（master-patterns v1.2 準拠）

### Phase 1: スキーマ変更

1. `prisma/schema.prisma` に `enum MaterialStatus` 追加
2. `Material.status` の型を `String` → `MaterialStatus` に変更
3. `npx prisma migrate dev --name add_material_status_enum` を実行
4. `npx prisma generate` で型再生成

### Phase 2: 論理層

- `src/lib/validators/material.ts` 作成
  - materialCode の正規表現（`/^[A-Za-z0-9\-_./]+$/`）
  - materialName 必須、materialType 必須、primarySupplierId 必須、unit 必須
  - currency / unit / minimumOrderQty の数値検証

- `src/app/(app)/materials/_components/labels.ts` 作成
  - MATERIAL_STATUS_LABELS / _OPTIONS / _BADGE_VARIANT（4 値、ModelCode と同じ構成）
  - MATERIAL_TYPE_LABELS / _OPTIONS / _BADGE_VARIANT（15 値）
    - FABRIC は default（青系）、ZIPPER/BUTTON 等の副資材は secondary（灰系）など視覚的に区別
  - CURRENCY_OPTIONS は既存定数あれば re-export（JPY/USD/EUR/CNY/VND）

- `src/lib/actions/materials.ts` 作成（8 関数 + 1 ヘルパー）
  - list / get / create / update / archive / restore / checkUsage / deletePermanently
  - `listActiveSuppliersForMaterialSelect()` ヘルパー:Supplier Select 用
  - `fetchSupplierSummariesByIds(companyId, supplierIds)`:一覧 / 詳細の merge 用
  - Brand サマリ取得とは別物。Supplier は Prisma relation 未定義のため別クエリ join

### Phase 3: UI

- `_components/material-form.tsx`（4 カードフォーム）
- `_components/material-delete-button.tsx`（archive / restore / 物理削除）
- `_components/materials-table.tsx`
- `_components/materials-search.tsx`（4 軸フィルタ）
- `_components/materials-pagination.tsx`
- `page.tsx` / `new/page.tsx` / `[id]/page.tsx` / `[id]/edit/page.tsx`
- ナビゲーション（`nav-items.ts`）への追加（「素材」エントリ）

### Phase 4: PR & デプロイ

- 3 コミット構成
  - Commit 1: schema migration（MaterialStatus enum 追加）
  - Commit 2: logic 層（validators / labels / actions）
  - Commit 3: UI（components / pages / nav）
- PR タイトル: `feat(phase1a-13a): 素材マスター・基本コア（MaterialStatus enum + 4 カード CRUD）`
- PR 作成、動作確認、マージ、Railway 自動デプロイ

---

## 9. 動作確認チェックリスト

### master-patterns §11 標準 7 項目

- [ ] 新規作成（materialCode 手動入力、Type / Supplier 選択して作成）
- [ ] 詳細表示（全 4 カード正しく表示）
- [ ] 一覧表示（4 軸フィルタ動作確認）
- [ ] 編集（materialCode は変更可能、その他も更新可能）
- [ ] アーカイブ
- [ ] 復元
- [ ] 物理削除（MASTER_ADMIN、ARCHIVED、名前一致、紐付き 0 件）

### Phase 1A-13a 固有

- [ ] materialType 15 値: すべて Select で選択可能
- [ ] materialType フィルタ: 15 値すべてで絞り込み可能
- [ ] status 4 値: ACTIVE / INACTIVE / DISCONTINUED / ARCHIVED すべて選択 / フィルタ可能
- [ ] DISCONTINUED は destructive バッジで表示される
- [ ] Supplier 必須: 未選択で保存できない
- [ ] Supplier 削除済 / アーカイブ済の場合の挙動（候補に出ない）
- [ ] Category Select: disabled で「実装後に有効化」ヘルプが表示される
- [ ] 単価: 通貨 + 単位の組み合わせ表示（1,200 JPY/m など）
- [ ] materialCode 重複: 同じ companyId 内で重複したらエラー表示
- [ ] materialCode 多様フォーマット: `FAB-COT-001`, `BTN-SQR-12mm`, `ZIP-METAL-15cm` が問題なく登録できる

---

## 10. Phase 1A-13b / 13c のフォローアップ項目

Phase 1A-13a 完了後、以下を順次実装する。

### Phase 1A-13b: 生地特有 + 規格 + 貿易データ

- 新規カード「生地仕様」: fabricWeight / fabricWidth / composition / compositionData
  - materialType === FABRIC のときのみ表示（動的フォーム）
- 新規カード「規格」: standardUsage / standardLossRate
- 新規カード「貿易データ」: hsCode / originCountry
- composition / compositionData は Phase 1A-13b 時点では Textarea + JSON 直入力で OK

### Phase 1A-13c: 画像 + 色展開 + 参考サイト

- 画像: imageUrl / swatchImageUrl（URL 直入力、Cloudflare R2 連携は Phase 1B 以降）
- 色展開: availableColors（Json）、構造化フォーム
  - `[{ name: "赤", code: "RED-01", hex: "#ff0000" }, ...]`
- 参考サイト: referenceSites（新規追加 Json フィールド）
  - スキーマ変更必要（MaterialStatus 追加に続く 2 回目のマイグレーション）
  - 構造: `{ "生地": [{ url, title, notes }], "ボタン": [...], "ファスナー": [...], "付属": [...] }`
- 多言語: materialNameZh / materialNameVi の UI 露出

### Phase 1B 以降

- Material.primarySupplierId に Prisma relation 追加 + DB FK 制約追加
- MaterialCategory マスター実装（階層構造あり）
- BOM / PO との連携時、Material の参照件数自動カウント
- 画像アップロード（Cloudflare R2 連携）
- composition の構造化入力 UI（Cotton 100% を { cotton: 100 } に分解）

---

## 11. 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-05-27 | v1.0 | 初版作成、確定 | Shin + Claude |
