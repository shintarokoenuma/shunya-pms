# 仕様確認議事録 — SKU 設計（カラーウェイ × サイズ）v1.1 確定版

対象プロジェクト: shunya-pms（shintarokoenuma/shunya-pms ・ ~/shunya-production-system ・ shunya-pms-web-production.up.railway.app）。saagara-v2 とは完全に別物。

作成: 2026-06-21 セッション10 / PR1 本番反映済み・PR2 上流確定を反映して v1.0 → v1.1。

---

## 0. このドキュメントの読み方

- 本書は SKU 設計の確定書。記憶でなく live schema（`prisma/schema.prisma`）と既存 spec を design-reread して書いた。
- PR1（スキーマ＋生成action＋マトリクス改修）は本番反映済み（migration 36本目 `20260621000000_sku_colorway_id`・三ゲート通過）。
- v1.1 は PR2（生成 UI ＋数量編集）の上流確定を反映。変更点は §6（サイズの出どころ）・§7（数量編集の対象）・§9（PR2 一括）。

---

## 1. 最初の山の定義（✓ 確定）

- SKU 生成導線を作り、北極星の数量マトリクスに実データを載せる。
- PR1 で SKU = ProductColorway × サイズ の土台（colorwayId）と生成 action・マトリクス改修が入った。PR2 で生成 UI と数量編集を載せ、人が SKU を作り数量を置けるようにする。

---

## 2. 上流2点の確定事項

### 2-1. 色軸 = ProductColorway に合流（✓ 確定 = 方向 a）

- SKU の色は shunya 管理の Color マスター（自社色番号）基準。仕入先カラーではない（color-master spec: 仕入色はマスター化せず Material 側でマッピング）。
- SKU の色軸は ProductColorway（colorId/patternId を持つカラーウェイ）に一本化。SKU = ProductColorway × サイズ。
- color-master §5 が Phase 1B 送りにしたのは「既存インライン色列（Sku.colorCode 等）の FK 化・移行」。本テーマは新設の生成導線に colorway 参照を持たせるもので §5 のスコープ外。既存 colorCode 列の物理削除・移行は Phase 1B 据え置き。

### 2-2. 数量の出どころ（✓ 確定 / 実装は段階分け）

- 出口を SalesOrder に一本化。入力経路（saagara-v2 連携 / CSV・Excel・メール取り込み / 受注ページ先方入力 / カルテ手入力）はすべて SalesOrder を作る手段として後付け。**SKU 別「受注数（orderedQuantity）」の正は常に SalesOrder（フェーズ2）**。
- SalesOrder は JSON でなく SalesOrderItem（SKU × 数量の行）で正規化。
- 段階分け:
  - フェーズ1（本テーマ）: 品番カルテで SKU 雛形生成 ＋ 量産発注数（productionQuantity）を手で置く。受注数は SalesOrder まで暫定 0。
  - フェーズ2（別テーマ）: SalesOrder / SalesOrderItem を建て、orderedQuantity の正を SalesOrder に置く。

---

## 3. Sku スキーマ変更（✓ 確定・PR1 で本番反映済み）

### 3-1. カラーウェイ参照（✓ 確定・実装済み）

- `colorwayId String`（NOT NULL）＋ `@relation(ProductColorway, onDelete: Cascade)`。BomItemColorway（productColorwayId @relation Cascade）と同方式。`@@index([colorwayId])`。ProductColorway に逆リレーション `skus Sku[]`。
- 色（colorId）・柄（patternId）は ProductColorway 経由で一意。Sku は色・柄を直接持たない。

### 3-2. 既存色列の扱い（✓ 確定・実装済み）

- 既存 `colorCode`/`colorName`/`colorNameEn`/`colorHex`/`pantone` は物理削除しない（§5 通り Phase 1B 送り）。生成時 `colorCode ← colorwayCode` / `colorName ← colorwayName` を非正規化コピーして NOT NULL を満たす。

---

## 4. SKU 生成 action（✓ 確定・PR1 で実装済み・PR2 で UI から初実行）

- `createSkusForProduct(productId, sizes: {size,sizeOrder}[], quantities?)`:
  - 行 = `listColorways(productId)` の ACTIVE カラーウェイ。列 = §6 のサイズ。
  - カラーウェイ × サイズの直積を upsert（冪等・skuCode キー）。`skuCode = {productCode}-{colorwayCode}-{size}`。
  - quantities は任意（key `${colorwayId}|${size}` → 数量）。
- ※ PR1 では auth() セッション必須で headless 直叩き不可だったため prisma 直再現で FK/データを実証。**関数本体のランタイム初実行は PR2 の生成 UI から**。

---

## 5. skuCode 採番規則（✓ 確定・実装済み）

- `{productCode}-{colorwayCode}-{size}`（例 `AOI-26AW-CUT_SEWN-001-C-M`）。colorwayCode は記号（C/B/A/D/F…）。`@@unique([companyId, skuCode])`。

---

## 6. サイズの出どころ（✓ 確定・v1.1 で更新 = 独立マスター不要）

- **独立サイズマスターは新設しない**。既存 `ProductCategory.defaultSizeOptions Json?`（例 `["S","M","L","XL"]`）を正とする。
- 根拠: サイズは品種で体系が大きく違い（トップス S/M/L・ボトムス 28/30/32・靴 cm）、Color のような全社共通辞書に向かない。カテゴリ標準として持つ既存設計が整合的。
- SKU 生成 UI: 品番の `categoryId → ProductCategory.defaultSizeOptions` を引き、**プルダウン（複数選択）**の選択肢として提示。その場で増減も可。
- サイズ定義の編集は既存の商品カテゴリ画面（`/product-categories` の `defaultSizeOptions`）側。本テーマでカテゴリ UI に編集導線が無ければ別起票で補う（サイズ追加が必要になった時）。
- sizeOrder: defaultSizeOptions の配列順を sizeOrder とする（プルダウン提示順＝配列順）。

---

## 7. 数量マトリクス・編集（✓ 確定・v1.1 で更新）

- 表示（PR1 実装済み）: 色軸 colorwayId、行ラベル colorwayName(colorwayCode)、上段 orderedQuantity / 下段 productionQuantity、柄カラーウェイも行。
- **インライン編集の対象は productionQuantity（量産発注数）のみ**（✓ 確定）。orderedQuantity は SalesOrder（フェーズ2）の正に明け渡し、フェーズ1 では編集させない（暫定 0 表示のまま）。
- 編集 action: `updateSkuQuantity(skuId, { productionQuantity })` を新設（現状 SKU 更新 action なし）。8関数パターン・ActionResult union・AuditLog・revalidatePath。

---

## 8. migration 方針（✓ 確定）

- PR1 = migration 36本目で本番反映済み。
- **PR2 は migration なし**（schema は PR1 で確定済み）。サイズは defaultSizeOptions 既存・新カラムなし。updateSkuQuantity は既存列の更新のみ。

---

## 9. 実装の段階分け（✓ 確定・v1.1 で更新）

- **PR1（本番反映済み）**: スキーマ（colorwayId）+ migration + 型移設 + 生成 action + マトリクス改修。
- **PR2（一括・本テーマ）**: 生成 UI（サイズ プルダウン複数選択 → 「SKU 生成」→ createSkusForProduct）＋ マトリクスの productionQuantity インライン編集（updateSkuQuantity 新設）。migration なし。
- **フェーズ2（別テーマ）**: SalesOrder / SalesOrderItem（orderedQuantity の正）。

---

## 10. 確定事項（履歴）

1. colorwayId = @relation(ProductColorway, Cascade)・NOT NULL（§3-1）→ 実装済み。
2. skuCode = `{productCode}-{colorwayCode}-{size}`（§5）→ 実装済み。
3. サイズの出どころ → ✓ ProductCategory.defaultSizeOptions を正・独立マスター不要（§6）。
4. 数量マトリクス色軸 colorCode → colorwayId（§7）→ 実装済み。
5. 数量編集 → ✓ productionQuantity のみインライン編集・orderedQuantity は SalesOrder の正（§7）。
6. サイズ入力 UI → ✓ defaultSizeOptions をプルダウン（複数選択）で提示（§6）。
7. PR2 → ✓ 一括（生成＋数量編集を同一 PR）（§9）。

---

## 改訂履歴

- v0.1（2026-06-21）: 初版ドラフト。
- v1.0（2026-06-21）: §10 全5点確定。colorwayId NOT NULL 根拠追記。
- v1.1（2026-06-21）: PR1 本番反映を反映。PR2 上流確定（§6 サイズ=defaultSizeOptions・独立マスター不要 / §7 productionQuantity のみ編集・updateSkuQuantity / §9 PR2 一括）。
