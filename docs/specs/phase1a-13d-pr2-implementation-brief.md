# Phase 1A-13d 柄種別マスター PR-2（validator + actions + UI）実装指示書（Claude Code 向け）

- 作成日: 2026-06-01 / Claude.ai
- 前提: **PR-1（PR #52）マージ済み**（`textile_pattern_types` テーブルが存在、dev に9種別投入済み）
- 参照実装: 色マスター PR-2（PR #50）/ `MaterialCategory`・`CostCategory` 系の**軽量カテゴリマスター UI**（連絡先・住所なし）。`factory`（連絡先付き重厚マスター）ではない方を手本にする。
- 確定仕様: `textile-pattern-master-spec-confirmation-v0_2-2026-06-01.md`
- 性格: 色マスター PR-2 から**構成色 UI・色チップ・色プレビュー・算出フィールド・`00` の条件付き分岐をすべて除いた**、純カテゴリ CRUD。

---

## STEP 0: 着手前の確認（簡略）

- PR-1 マージ済み・`git checkout main && git pull` で `textile_pattern_types` を含む最新であること。
- feature ブランチ: `feat/textile-pattern-type-ui`
- 動作確認は **dev（`7492` / `hopper`）優先**。本番は触らない。
- **本 PR は schema 変更なし＝migration 非含＝本番 DB 無風**（UI/actions/validator のみ）。PR-1 のような migrate 前 dev リンク確認は不要。

---

## validator（`src/lib/validators/textile-pattern-type.ts` 新規）

| フィールド | ルール |
|---|---|
| typeCode | 必須・1〜10文字・`/^[A-Z0-9_]{1,10}$/`（英大文字/数字/アンダースコア）。`@@unique([companyId, typeCode])` |
| typeName | 必須・1〜100文字 |
| description | 任意・0〜500文字 |
| sortOrder | 整数（フォーム入力可。未指定時は末尾＝既存最大+10 を actions で補完） |
| status | `ACTIVE` / `ARCHIVED` |

- 命名は patterns 準拠: `textilePatternTypeInputSchema` / `TextilePatternTypeInput` / `TextilePatternTypeFormValues` / `textilePatternTypeListParamsSchema` / `TextilePatternTypeListParams`。
- 色のような `superRefine` 条件分岐は不要。

---

## actions（`src/lib/actions/textile-pattern-types.ts` 新規・8関数）

patterns §5 の8関数構成。**すべて auditLog 記録**。レスポンスは `{ ok, error }` 統一。

> **AuditLog の entityType は seed と揃えて `"TextilePatternType"` で統一**（create/update/archive/restore/delete を一貫させる）。

| 関数 | 備考 |
|---|---|
| `listTextilePatternTypes` | `sortOrder` 昇順。検索: `typeCode` / `typeName` 部分一致。フィルタ: `status`。ページネーション（patterns 準拠） |
| `getTextilePatternType` | 詳細取得 |
| `createTextilePatternType` | `sortOrder` 未指定時は末尾採番（既存最大+10） |
| `updateTextilePatternType` | |
| `archiveTextilePatternType` | status → ARCHIVED |
| `restoreTextilePatternType` | ARCHIVED → ACTIVE |
| `checkTextilePatternTypeUsage` | 参照先（将来の `Material` 側柄種別参照など）の件数確認。**現時点では参照先が未接続のため 0 件を返す最小実装**。color の `checkColorUsage` と同じ扱い。Material 連携が入る将来 PR で拡張 |
| `deleteTextilePatternTypePermanently` | MASTER_ADMIN のみ・ARCHIVED のみ・`confirmationName === typeName`・`checkTextilePatternTypeUsage` 0件ガード |

---

## UI（`src/app/(app)/textile-pattern-types/`）

色マスター PR-2 ではなく **`material-categories` の構成にほぼそのまま倣う**（色チップ・構成色・カラープレビューは一切なし）。

### 一覧 `page.tsx` + `_components/textile-pattern-types-table.tsx`

- `sortOrder` 昇順（SOLID が先頭）。
- 各行: `typeCode`（バッジ）+ `typeName` + `description`（省略表示）+ status バッジ。
- `textile-pattern-types-search.tsx`（typeCode/typeName 検索 + status 絞り込み）、`textile-pattern-types-pagination.tsx`。`material-categories` 同形。

### フォーム `_components/textile-pattern-type-form.tsx`

- 入力: `typeCode` / `typeName` / `description`（任意）/ `sortOrder`（任意）/ `status`。
- 色フォームのようなプレビュー・カラーピッカーは**不要**。
- `textile-pattern-type-delete-button.tsx`（patterns の物理削除ガード踏襲）。

### labels（`_components/labels.ts`）

- 種別ラベルの辞書は**不要**（`typeName` がそのまま表示名）。`STATUS_OPTIONS`（ACTIVE / ARCHIVED）のみ。

### ナビ

- `nav-items.ts` に `/textile-pattern-types`（表示名「**柄種別**」）を追加（`enabled: true`）。マスター群の並びで **Color（カラー）の近く**に配置。

---

## 動作確認（dev 優先）

patterns §11 の7項目 + 柄固有:

1. 新規作成: テスト種別（例 `TEST` / 「テスト柄」）を1件作成 → sortOrder 末尾採番（100）
2. 詳細表示: 全フィールド表示
3. 一覧表示: 9種別 + テスト分が sortOrder 昇順（SOLID 先頭）
4. 編集: typeName / description を変更して保存・反映
5. アーカイブ → 6. 復元
7. 物理削除（MASTER_ADMIN、ARCHIVED のテスト種別で）
8. validator: 重複 `typeCode`、typeCode 形式不正（小文字・10文字超）が弾かれること
9. `npx tsc --noEmit` clean

---

## 注意点

- **status は `VarChar(20)`**。enum 化しない（`Color` / `CostCategory` / `MaterialCategory` の軽量カテゴリ前例）。
- `textile-pattern-type-delete-button.tsx` の `setState-in-effect` lint は、流用元 `material-category-delete-button.tsx` / `color-delete-button.tsx` と同じ**既存パターン**（新規持ち込みではない）。**本 PR で無理に直さない**。横断的に直すなら別チケット（バックログ送り）。
- 個別柄（構成色・ピッチ等）、A柄/B柄の図案番号は**持たない**。本マスターは種別分類のみ。
- Material 側からの柄種別参照は**先回りして作らない**（必要が出てから別 PR）。
- 本 PR は **schema 変更なし＝migration 非含＝本番 DB 無風**。マージ＝本番アプリ UI 反映だが本番 DB は変わらない。本番への9種別 seed 投入は PR-3 + 明示指示時。
- TypeScript はファイル保存（ターミナル直貼り禁止）。main 直コミット禁止。feature ブランチ → PR → squash merge。
- Co-Authored-By は現行のモデル表記に揃える。
