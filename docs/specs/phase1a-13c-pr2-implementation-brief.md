# Phase 1A-13c 色マスター PR-2（UI）実装指示書（Claude Code 向け）

- 作成日: 2026-06-01 / Claude.ai
- 前提: **PR-1（PR #49）マージ後に着手**（`colors` テーブルが存在すること）
- 参照実装: `MaterialCategory` / `CostCategory` 系の**軽量カテゴリマスター UI**（連絡先・住所なし）。`factory`（連絡先付き重厚マスター）ではない方を手本にする。

---

## STEP 0: 着手前の確認（簡略）

- PR-1 マージ済み・`git checkout main && git pull` で `colors` を含む最新であること。
- feature ブランチ: `feat/phase1a-13c-color-master-ui`
- 動作確認は **dev（`7492` / `hopper`）優先**。本番は smoke test のみ。
- **本 PR は schema 変更なし＝migration 非含＝本番 DB スキーマ無風**（`00` は seed データの追加のみ）。

---

## 追加データ: `00` = カラー未定（マルチ／プリント）

`00` は「単色で指定できないもの（マルチカラー・プリント・総柄等）」を表す**予約値**。柄そのもの（ボーダー/ストライプ等）は別軸（将来のデザイン番号マスター）で持つ。`Color` 側の `00` は「単色指定なし」の入口。

### seed への追加（`scripts/seeds/colors-core.ts`）

`COLORS` 配列の先頭に1行追加（計51色）。`00` だけ cmyk/hex は**空文字**（色値なし）。

```ts
{ colorNumber: "00", colorName: "カラー未定", cmyk: "", hex: "" },
```

- `seedColors` 内の算出はそのまま動く（`hueGroup=0 / toneStep=0 / sortOrder=0`）。
- cmyk/hex が空でも schema は `NOT NULL` を満たす（空文字は可）。
- 再 seed で `00` のみ created（既存50は skip）＝冪等を維持。
- dev で再 seed → 件数51・AuditLog +1 を確認。

---

## validator（`src/lib/validators/color.ts` 新規）

| フィールド | ルール |
|---|---|
| colorNumber | 2桁数字 `"00"`〜`"99"`（`/^\d{2}$/`）。`@@unique([companyId, colorNumber])` |
| colorName | 必須・1〜100文字 |
| cmyk | `colorNumber !== "00"` のとき `C.M.Y.K` 形式（`/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/`、各0–100）必須。`"00"` は空文字を許可 |
| hex | `colorNumber !== "00"` のとき `#RRGGBB`（`/^#[0-9A-Fa-f]{6}$/`）必須。`"00"` は空文字を許可 |
| hueGroup / toneStep / sortOrder | **フォーム入力させず** `colorNumber` から導出（`hueGroup=parseInt(n[0])`, `toneStep=parseInt(n[1])`, `sortOrder=parseInt(n)`）。validator / actions 層で算出 |
| impression | 任意・0〜100文字 |
| status | `ACTIVE` / `ARCHIVED` |

- `superRefine` で `colorNumber === "00"` のときだけ cmyk/hex の空を許可、それ以外は形式必須。
- バリデータ命名は patterns 準拠: `colorInputSchema` / `ColorInput` / `ColorFormValues` / `colorListParamsSchema` / `ColorListParams`。

---

## actions（`src/lib/actions/colors.ts` 新規・8関数）

patterns §5 の8関数構成。すべて auditLog 記録。

| 関数 | 備考 |
|---|---|
| `listColors` | `sortOrder` 昇順。検索: `colorNumber` / `colorName` 部分一致。フィルタ: `hueGroup`（0–9）、`status`。ページネーション |
| `getColor` | 詳細取得 |
| `createColor` | `hueGroup/toneStep/sortOrder` を `colorNumber` から算出して保存 |
| `updateColor` | 同上（`colorNumber` 変更時は再算出） |
| `archiveColor` | status → ARCHIVED |
| `restoreColor` | ARCHIVED → ACTIVE |
| `checkColorUsage` | Color を参照する先（将来の Material.availableColors / SKU 等）の件数確認。**現時点では参照先が未接続のため 0 件を返す最小実装**。PR-3 で Material 連携時に拡張 |
| `deleteColorPermanently` | MASTER_ADMIN のみ・ARCHIVED のみ・`confirmationName === color.colorName`・`checkColorUsage` 0件ガード |

- レスポンスは `{ ok, error }` 統一。

---

## UI（`src/app/(app)/colors/`）

`material-categories` の構成に倣う。連絡先・住所カードは**なし**。

### 一覧 `page.tsx` + `_components/colors-table.tsx`

- `sortOrder` 昇順（`00` が先頭）。
- 各行: **hex 色チップ** + `colorNumber` + `colorName` + 色相系統（`HUE_GROUP_LABELS`）+ status バッジ。
- **`colorNumber === "00"` は特別表示**: 色チップの代わりに「カラー未定（マルチ／プリント）」のバッジ or 斜線/市松のプレースホルダ。hex 空でも崩れないこと。
- `colors-search.tsx`（colorNumber/colorName 検索 + hueGroup 絞り込み + status 絞り込み）、`colors-pagination.tsx`。

### フォーム `_components/color-form.tsx`

- 入力: `colorNumber`（2桁）/ `colorName` / `cmyk` / `hex` / `impression`（任意）/ `status`。
- `colorNumber` 入力に応じて `hueGroup`/`toneStep` を**読み取り専用プレビュー表示**（例: 「色相: 5 ブルー / トーン: 7」）。
- hex 入力欄に簡易カラープレビュー（入力 hex を色見本表示）。可能なら `<input type="color">` 併設。
- **`colorNumber === "00"` 入力時**: cmyk/hex を任意（空可）に切り替え、「カラー未定（マルチ／プリント）。色値は不要です」と案内表示。
- `color-delete-button.tsx`（patterns の物理削除ガード踏襲）。

### labels（`_components/labels.ts`）

```ts
export const HUE_GROUP_LABELS: Record<number, string> = {
  0: "グレー（明）", 1: "レッド", 2: "オレンジ", 3: "イエロー", 4: "グリーン",
  5: "ブルー", 6: "パープル", 7: "ピンク", 8: "ブラウン", 9: "グレー（暗）",
}
export const COLOR_STATUS_OPTIONS = [ /* ACTIVE / ARCHIVED */ ]
```

### ナビ

- `nav-items.ts` に `/colors`（「カラー」）を追加（`enabled: true`）。マスター群の並びに沿わせる。

### 色相環（円グラフ）選択 UI

- **本 PR ではスコープ外**（標準 CRUD を優先）。将来 PR で、フォームの `colorNumber` 選択を色相環 UI に差し替える。

---

## 動作確認（dev 優先）

patterns §11 の7項目 + 色固有:

1. 新規作成: イレギュラー色（例 `52`）を1件作成 → `hueGroup=5 / toneStep=2 / sortOrder=52` が自動算出される
2. 詳細表示: 全フィールド表示、hex 色見本表示
3. 一覧表示: 51色（`00` 含む）が `sortOrder` 昇順。`00` が「カラー未定」特別表示で先頭、hex 色チップ崩れなし
4. 編集: colorName / cmyk / hex を変更して保存・反映
5. アーカイブ → 6. 復元
7. 物理削除（MASTER_ADMIN、ARCHIVED のテスト色で）
8. validator: 重複 `colorNumber`、cmyk 形式不正、hex 不正、`00` の cmyk/hex 空が通ること
9. 再 seed で `00` のみ追加・件数51・AuditLog 整合

---

## 注意点

- **status は PR-1 で `VarChar(20)` 確定**。enum 化はしない（`CostCategory` / `MaterialCategory` 等の軽量カテゴリマスター前例に倣う）。patterns §14 の「status を enum 化」は連絡先付き重厚マスター向けの指針で、カテゴリ系は String 運用が前例。
- 本 PR は **schema 変更なし＝migration 非含**。`00` は seed データ追加のみ。マージ＝本番アプリ UI 反映だが本番 DB スキーマは無風。本番への `00` 含む seed 投入は別途・明示指示時。
- TypeScript はファイル保存（ターミナル直貼り禁止）。main 直コミット禁止。feature ブランチ → PR → squash merge。
- Co-Authored-By は現行のモデル表記に揃える。
