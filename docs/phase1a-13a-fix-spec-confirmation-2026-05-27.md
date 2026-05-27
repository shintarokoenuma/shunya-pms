# Phase 1A-13a-fix Material 修正パッチ仕様確定議事録

**作成日**: 2026 年 5 月 27 日
**作成者**: Shin（肥沼慎太郎） + Claude
**バージョン**: v1.0
**ステータス**: 確定（実装着手可能）
**対象**: Phase 1A-13a（PR #29 マージ済み）への修正パッチ

---

## 1. 目的

Phase 1A-13a 完了後の動作確認において、業務実態に合わない設計上の問題が発見された。本 fix パッチで以下を修正する。

### 発見された問題

| # | 問題 | 業務インパクト |
|---|---|---|
| 1 | 同じ会社内で materialCode が一意のため、ニチメンとサンウエルそれぞれの「1000」を登録できない | 業界実務と乖離。仕入先ごとに独立した品番採番が業界標準 |
| 2 | FABRIC のラベルが「生地」となっており、表地と裏地の区別が曖昧 | 業務感覚と乖離（生地 = 表地 + 裏地 + 芯地という階層） |
| 3 | Material.primarySupplierId に Prisma relation / DB FK 制約が未定義 | データ整合性のリスク。13a 時点で技術的負債として記録済み |

### Phase 1B 以降の論点として議事録化する項目

| # | 論点 | 確定方針 |
|---|---|---|
| 4 | 仕様書 / BOM での素材検索 UX | 案 B（フリー検索 + 仕入先併記） |
| 5 | サンプル / 量産で一度使った素材の自動登録 | BOM 作成時にトリガー、status: DRAFT で自動作成想定 |

---

## 2. 確定事項サマリー

| # | 論点 | 確定内容 |
|---|---|---|
| 1 | unique 制約 | **`(companyId, primarySupplierId, materialCode)`** の複合 unique に変更 |
| 2 | FABRIC ラベル | **「生地」→「表地」** に変更（enum 値は変えずラベルのみ） |
| 3 | PR 構成 | **1 PR にまとめる**（Phase 1A-13a-fix） |
| 4 | 検索 UX | 案 B 採用（Phase 1B 実装時に作る、本 fix では何もしない） |
| 5 | 自動登録 | α 採用（議事録のみ、スキーマ追加なし、Phase 1B で実装） |

---

## 3. スキーマ変更

### 3.1 unique 制約の変更

```prisma
model Material {
  // ... 既存フィールド ...

  // 変更前
  // primarySupplierId String?  @map("primary_supplier_id")
  // ...
  // @@unique([companyId, materialCode])

  // 変更後
  primarySupplierId String   @map("primary_supplier_id")  // optional → required
  // ...

  primarySupplier Supplier @relation(fields: [primarySupplierId], references: [id], onDelete: Restrict)

  @@unique([companyId, primarySupplierId, materialCode])

  // ... 既存インデックス ...
}
```

変更点:
- `primarySupplierId` を `String?` → `String`（必須化）
- `primarySupplier Supplier @relation(...)` を新規追加
- DB FK 制約は `onDelete: Restrict`（Supplier 削除時に Material が紐づいていたら削除を拒否）
- unique 制約を `(companyId, materialCode)` → `(companyId, primarySupplierId, materialCode)` に変更

### 3.2 Supplier 側の relation 追加

Supplier モデル側にも逆方向の relation を追加する。

```prisma
model Supplier {
  // ... 既存フィールド ...

  // 新規追加
  materials Material[]
}
```

### 3.3 Migration

```bash
npx prisma migrate dev --name fix_material_supplier_relation_and_unique
```

想定される SQL:
```sql
-- 1. 既存 unique 制約を削除
DROP INDEX "materials_company_id_material_code_key";

-- 2. primary_supplier_id を NOT NULL に変更
--    (既存データが NULL の場合は事前に値を埋める必要あり。Phase 1A-13a は 0 件なので安全)
ALTER TABLE "materials" ALTER COLUMN "primary_supplier_id" SET NOT NULL;

-- 3. FK 制約を追加
ALTER TABLE "materials"
  ADD CONSTRAINT "materials_primary_supplier_id_fkey"
  FOREIGN KEY ("primary_supplier_id") REFERENCES "suppliers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. 新しい unique 制約を追加
CREATE UNIQUE INDEX "materials_company_id_primary_supplier_id_material_code_key"
  ON "materials"("company_id", "primary_supplier_id", "material_code");
```

既存データが 0 件であれば安全に実行可能。

---

## 4. コード変更

### 4.1 actions の重複チェック修正

`src/lib/actions/materials.ts` の以下 2 箇所:

**createMaterial 内:**
```typescript
// 変更前
const dup = await prisma.material.findFirst({
  where: {
    companyId: sess.companyId,
    materialCode: data.materialCode,
    deletedAt: null,
  },
})
if (dup) {
  return {
    ok: false,
    error: `素材コード "${data.materialCode}" は既に使用されています`,
  }
}

// 変更後
const dup = await prisma.material.findFirst({
  where: {
    companyId: sess.companyId,
    primarySupplierId: data.primarySupplierId,
    materialCode: data.materialCode,
    deletedAt: null,
  },
  include: {
    primarySupplier: { select: { companyName: true } },
  },
})
if (dup) {
  return {
    ok: false,
    error: `仕入先「${dup.primarySupplier.companyName}」には既に素材コード "${data.materialCode}" が登録されています`,
  }
}
```

**updateMaterial 内:** materialCode または primarySupplierId が変更された場合に同様の重複チェック。

### 4.2 actions の fetchSupplierSummariesByIds 不要化（任意）

primarySupplier の Prisma relation が追加されたため、include で取得可能になる。ただし Phase 1A-13a-fix では **既存のヘルパー関数をそのまま残す方針**（Phase 1B でクエリ最適化時に整理する）。

理由:
- 既存テストや UI からの呼び出しを変更すると影響範囲が広がる
- include 化はリファクタとして別途実施

### 4.3 validator の修正

`src/lib/validators/material.ts`:

```typescript
// 変更前
primarySupplierId: z.string().min(1, "仕入先は必須です"),

// 変更後（現状のまま、必須は維持）
primarySupplierId: z.string().min(1, "仕入先は必須です"),
```

validator は既に必須扱いだったため、変更なし。

### 4.4 ラベル変更（FABRIC → 表地）

`src/app/(app)/materials/_components/labels.ts`:

```typescript
// 変更前
export const MATERIAL_TYPE_LABELS: Record = {
  FABRIC: "生地",
  // ...
}

// 変更後
export const MATERIAL_TYPE_LABELS: Record = {
  FABRIC: "表地",
  // ...
}

// MATERIAL_TYPE_OPTIONS の FABRIC の label も同様に変更
```

enum 値 `FABRIC` 自体は変更しない（既存データへの影響を回避）。

---

## 5. 実装手順

### Phase 1: スキーマ変更

1. `prisma/schema.prisma` の Material モデルを修正
   - `primarySupplierId` を必須化
   - `primarySupplier Supplier @relation(...)` を追加
   - `@@unique` を複合キーに変更
2. Supplier モデルに `materials Material[]` を追加
3. `npx prisma format`
4. `npx prisma migrate dev --create-only --name fix_material_supplier_relation_and_unique` で SQL 生成
5. SQL 内容を view で確認
6. `materials.count()` = 0 を確認
7. `npx prisma migrate dev` で適用
8. `npx prisma generate`

### Phase 2: コード修正

1. `src/lib/actions/materials.ts` の createMaterial / updateMaterial の重複チェックを修正
2. エラーメッセージに仕入先名を含める（include で primarySupplier 取得）
3. `src/app/(app)/materials/_components/labels.ts` の FABRIC ラベルを「表地」に変更
4. `npx tsc --noEmit` で型チェック

### Phase 3: PR & デプロイ

- 2 コミット構成
  - Commit 1: schema migration（unique 制約変更 + FK 制約追加）
  - Commit 2: actions の重複チェック修正 + FABRIC ラベル変更 + 議事録
- PR タイトル: `fix(phase1a-13a): unique 制約を仕入先込みに変更 + FABRIC ラベル「表地」に変更`
- PR 作成、動作確認、マージ、Railway 自動デプロイ

---

## 6. 動作確認チェックリスト

### Phase 1A-13a-fix 固有

- [ ] 同じ materialCode で異なる仕入先 → 両方登録できる
  - 例: 「ニチメン + 1000」と「サンウエル + 1000」が共存できる
- [ ] 同じ materialCode で同じ仕入先 → エラー表示
  - エラーメッセージに **仕入先名が含まれる**（例: 「仕入先「ニチメン」には既に素材コード "1000" が登録されています」）
- [ ] FABRIC のラベルが一覧 / 詳細 / 編集 / 新規作成画面のすべてで「表地」になっている
- [ ] Supplier を削除 / アーカイブしようとした時、Material から参照されていれば削除拒否される（FK Restrict）
- [ ] 編集画面で primarySupplier を変更したとき、新しい仕入先 + materialCode の組み合わせで重複しないことを確認

### Phase 1A-13a 標準項目の回帰

- [ ] 新規作成: 通常通り動作する
- [ ] 編集: materialCode と primarySupplierId の両方を変更しても正常動作する
- [ ] 一覧 / 詳細: 表示が壊れていない
- [ ] アーカイブ / 復元: 正常動作する

---

## 7. Phase 1B 以降のフォローアップ項目

### 7.1 素材検索 UX（案 B: フリー検索 + 仕入先併記）

仕様書 / BOM 作成時の素材検索 UI として、案 B を採用する。

**想定 UI**:
```
[検索ボックス: "1000"]
  ↓ オートコンプリート候補（複数表示）
[1000] ニチメン  表地・コットン  1,200 円/m
[1000] サンウエル  表地・ポリエステル  800 円/m
[クリックで選択 → 仕様書 / BOM に追加]
```

**実装ポイント**:
- 候補表示に supplier.companyName / materialType / unitPrice を必ず含める
- Material.list の戻り値には既に supplier サマリが含まれているため、actions 追加実装は不要
- Phase 1B の仕様書 / BOM 作成画面側で実装する

### 7.2 サンプル / 量産で使った素材の自動登録

**業務フロー想定**:

```
サンプル / 量産案件で「ニチメンの XX-100 という生地を使う」と指定
  ↓
その素材がマスターに未登録 → 自動的に Material 行が作成される
  仕入先: ニチメン
  materialCode: XX-100
  materialType: 表地（デフォルトまたはユーザー指定）
  status: DRAFT（下書き、要レビュー）
  ↓
後で人間が単価 / 仕様などを補完して status: ACTIVE に昇格
  ↓
次回以降のリピート案件では既存マスターから選択
```

**トリガー候補**:

| 候補 | 内容 | 推奨 |
|---|---|---|
| 仕様書作成時 | 仕様書に素材を記入 → 自動登録 | × 早すぎる（検討段階でも登録） |
| **BOM 作成時** | **BOM に素材を追加 → 自動登録** | **○ 推奨** |
| PO 発注時 | 発注書に素材を追加 → 自動登録 | × 遅すぎる |

**Phase 1B で追加するスキーマ（暫定案）**:

```prisma
enum MaterialStatus {
  ACTIVE
  INACTIVE
  DISCONTINUED
  ARCHIVED
  DRAFT          // 新規追加（自動登録、要レビュー）
}

model Material {
  // ... 既存 ...

  // Phase 1B で追加（暫定案、設計変更の可能性あり）
  isAutoCreated         Boolean   @default(false) @map("is_auto_created")
  autoCreatedFromType   String?   @map("auto_created_from_type")  // "BOM" / "Specification"
  autoCreatedFromId     String?   @map("auto_created_from_id")
  autoCreatedAt         DateTime? @map("auto_created_at")
  needsReview           Boolean   @default(false) @map("needs_review")
}
```

**未確定の論点**（Phase 1B 設計時に詰める）:
- DRAFT 素材は仕様書 / BOM で再利用可能か
- DRAFT のまま PO に進めるか
- 自動登録時、unit / unitPrice が空でも作成 OK か
- 自動登録された素材を後で削除した場合の整合性

### 7.3 その他の技術的負債

- MaterialCategory マスター実装（階層構造あり）
- Material.unitPrice の通貨換算ロジック（為替レート連動）
- 仕入先別の単価履歴管理（価格改定対応）

---

## 8. 改訂履歴

| 日付 | バージョン | 内容 | 担当 |
|---|---|---|---|
| 2026-05-27 | v1.0 | 初版作成、確定 | Shin + Claude |
