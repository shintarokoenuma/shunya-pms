# 柄種別マスター（TextilePatternType）実装指示書（Claude Code 向け）

- 作成日: 2026-06-01 / Claude.ai
- 確定仕様: `textile-pattern-master-spec-confirmation-v0_2-2026-06-01.md`（確定版）
- 参照実装: `MaterialCategory` / `CostCategory` 系の**軽量カテゴリマスター**（連絡先・住所なし）。`factory`（連絡先付き重厚マスター）ではない方を手本にする。
- 性格: Color マスターより**さらに軽い純カテゴリ表**。構成色・算出フィールド・予約値の特殊処理はいずれも**なし**。

---

## 全体方針（3 PR 構成）

色マスター（13c）と同じく、**schema 変更を含む PR と含まない PR を分離**する。

| PR | 内容 | schema 変更 | 本番 DB |
|---|---|---|---|
| PR-1 | schema + migration + dev seed（9種別） | あり（CREATE TABLE） | スキーマ変更あり（dev で適用。本番は別途指示） |
| PR-2 | validator + actions(8) + UI | なし | 無風 |
| PR-3 | 本番投入用エントリ（三重ガード） | なし | 投入は別途・明示指示時 |

- 各 PR は feature ブランチ → PR → squash merge。**前 PR マージ後に次 PR へ**。
- TypeScript はファイル保存（ターミナル直貼り禁止）。main 直コミット禁止。
- 動作確認は **dev（`7492` / `hopper`）優先**。本番は smoke test のみ。

---

# PR-1: schema + migration + dev seed

ブランチ: `feat/textile-pattern-type-schema`

## STEP 0: 着手前の確認（safety-check 準拠）

- `git checkout main && git pull` で最新。
- **本 PR は migration を含む＝本番 DB スキーマ変更対象**。dev へ流す前に `railway run printenv DATABASE_URL | sed ...` で **dev（`7492`）であること**を確認してから `prisma migrate dev`。
- 本番への migration 適用は**このPRでは行わない**（別途・明示指示時）。

## schema（確定）

型紙の `PatternVersion` とは別物。個別柄インスタンスは持たない（種別分類のみ）。

```prisma
/// 自社柄種別マスター（柄の分類共通言語）
model TextilePatternType {
  id          String   @id @default(uuid())
  companyId   String   @map("company_id")

  typeCode    String   @map("type_code") @db.VarChar(10)   // "SOLID" / "BD" / "ST" ...
  typeName    String   @map("type_name") @db.VarChar(100)  // "無地" / "ボーダー" ...
  description String?  @db.Text

  sortOrder   Int      @map("sort_order")

  status      String   @default("ACTIVE") @db.VarChar(20)  // enum 化しない（カテゴリ系前例に倣う）
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")

  @@unique([companyId, typeCode])
  @@map("textile_pattern_types")
}
```

- migration 名: `add_textile_pattern_type_master`。**CREATE TABLE のみ・既存テーブルへの変更なし**（無風）。

## dev seed（`scripts/seeds/textile-pattern-types-core.ts` 新規）

- 9種別を投入。**AuditLog エントリ書き込み込み**（B-010 の方針に準拠。CREATE 9件）。
- 冪等（再 seed で既存 skip・新規のみ created）。
- `sortOrder` は配列順で採番（SOLID を先頭）。

```ts
const PATTERN_TYPES = [
  { typeCode: "SOLID", typeName: "無地",       description: "単色・柄なし" },
  { typeCode: "BD",    typeName: "ボーダー",   description: "横縞" },
  { typeCode: "ST",    typeName: "ストライプ", description: "縦縞" },
  { typeCode: "CK",    typeName: "チェック",   description: "格子（ギンガム/タータン等を内包）" },
  { typeCode: "DT",    typeName: "ドット",     description: "水玉" },
  { typeCode: "PR",    typeName: "プリント",   description: "図案・グラフィックプリント" },
  { typeCode: "AO",    typeName: "総柄",       description: "オールオーバー（全面反復柄）" },
  { typeCode: "ML",    typeName: "マルチ",     description: "多色・配色指定なしの混在" },
  { typeCode: "OT",    typeName: "その他",     description: "上記に当てはまらない柄" },
]
// sortOrder は index で採番（0,1,2... または 10,20,30...）。AuditLog は colors seed と同形。
```

## 動作確認（dev）

1. `prisma migrate dev` 成功・`textile_pattern_types` 生成。
2. seed 実行 → 9件 created・AuditLog（TextilePatternType / CREATE）9件。
3. 再 seed → 全 skip（created 0 / 件数9維持）＝冪等。
4. `typeCode` 重複制約（`@@unique`）が効く。

---

# PR-2: validator + actions + UI

ブランチ: `feat/textile-pattern-type-ui`
前提: **PR-1 マージ後**（`textile_pattern_types` が存在）。**schema 変更なし＝本番 DB 無風**。

## validator（`src/lib/validators/textile-pattern-type.ts` 新規）

| フィールド | ルール |
|---|---|
| typeCode | 必須・1〜10文字・`/^[A-Z0-9_]{1,10}$/`（英大文字/数字/アンダースコア）。`@@unique([companyId, typeCode])` |
| typeName | 必須・1〜100文字 |
| description | 任意・0〜500文字程度 |
| sortOrder | 整数（フォーム入力可。未指定時は末尾＝既存最大+1 を actions で補完） |
| status | `ACTIVE` / `ARCHIVED` |

- 命名は patterns 準拠: `textilePatternTypeInputSchema` / `TextilePatternTypeInput` / `TextilePatternTypeFormValues` / `textilePatternTypeListParamsSchema` / `TextilePatternTypeListParams`。
- 色のような条件付き（`superRefine`）分岐は不要。

## actions（`src/lib/actions/textile-pattern-types.ts` 新規・8関数）

patterns §5 の8関数構成。すべて auditLog 記録。レスポンスは `{ ok, error }` 統一。

| 関数 | 備考 |
|---|---|
| `listTextilePatternTypes` | `sortOrder` 昇順。検索: `typeCode` / `typeName` 部分一致。フィルタ: `status`。ページネーション（patterns 準拠） |
| `getTextilePatternType` | 詳細取得 |
| `createTextilePatternType` | `sortOrder` 未指定時は末尾採番 |
| `updateTextilePatternType` | |
| `archiveTextilePatternType` | status → ARCHIVED |
| `restoreTextilePatternType` | ARCHIVED → ACTIVE |
| `checkTextilePatternTypeUsage` | 参照先（将来の `Material` 側柄種別参照など）の件数確認。**現時点では参照先が未接続のため 0 件を返す最小実装**。Material 連携が入る将来 PR で拡張 |
| `deleteTextilePatternTypePermanently` | MASTER_ADMIN のみ・ARCHIVED のみ・`confirmationName === typeName`・`checkTextilePatternTypeUsage` 0件ガード |

## UI（`src/app/(app)/textile-pattern-types/`）

`material-categories` の構成にほぼそのまま倣う。**色チップ・構成色 UI・色プレビューはすべてなし**。

### 一覧 `page.tsx` + `_components/textile-pattern-types-table.tsx`

- `sortOrder` 昇順。各行: `typeCode`（バッジ）+ `typeName` + `description`（省略表示）+ status バッジ。
- 検索（typeCode/typeName）+ status 絞り込み + ページネーション（`material-categories` 同形）。

### フォーム `_components/textile-pattern-type-form.tsx`

- 入力: `typeCode` / `typeName` / `description`（任意）/ `sortOrder`（任意）/ `status`。
- 色フォームのようなプレビュー・カラーピッカーは不要。
- `textile-pattern-type-delete-button.tsx`（patterns の物理削除ガード踏襲）。

### labels（`_components/labels.ts`）

- 種別ラベルの辞書は不要（`typeName` がそのまま表示名）。`STATUS_OPTIONS`（ACTIVE / ARCHIVED）のみ。

### ナビ

- `nav-items.ts` に `/textile-pattern-types`（表示名「**柄種別**」）を追加（`enabled: true`）。マスター群の並びで Color（カラー）の近くに配置。

## 動作確認（dev 優先）

patterns §11 の7項目に準拠:

1. 新規作成: テスト種別（例 `TEST` / 「テスト柄」）を1件作成 → sortOrder 末尾採番
2. 詳細表示: 全フィールド表示
3. 一覧表示: 9種別 + テスト分が sortOrder 昇順
4. 編集: typeName / description を変更して保存・反映
5. アーカイブ → 6. 復元
7. 物理削除（MASTER_ADMIN、ARCHIVED のテスト種別で）
8. validator: 重複 `typeCode`、typeCode 形式不正（小文字/長すぎ）が弾かれること

---

# PR-3: 本番投入用エントリ

ブランチ: `feat/textile-pattern-type-prod-seed`
前提: PR-1 マージ後。`cost-categories-prod` / `seed-colors-prod` と**同形の三重ガード**。

- `scripts/seeds/seed-textile-pattern-types-prod.ts`（公開プロキシ `DATABASE_PUBLIC_URL` 経由・host 完全一致を banner で三者確認してから実行する前提のガード）。
- 本体は PR-1 の `textile-pattern-types-core.ts` を呼ぶだけ（ロジック重複なし）。
- **このPRは投入の実行を含まない**。本番投入は別途・明示指示時に、safety-check の手順（host banner 一致確認・不可視文字除去 `tr -d '[:space:]'`）で実施。

---

## 共通注意点

- **status は `VarChar(20)`**。enum 化しない（`CostCategory` / `MaterialCategory` / `Color` の軽量カテゴリ前例）。
- 個別柄（構成色・ピッチ等）、A柄/B柄の図案番号は**持たない**。本マスターは種別分類のみ（確定仕様 §2・§3）。
- Material 側からの柄種別参照は**先回りして作らない**（必要が出てから別 PR）。
- TypeScript はファイル保存（ターミナル直貼り禁止）。main 直コミット禁止。feature ブランチ → PR → squash merge。
- Co-Authored-By は現行のモデル表記に揃える。
