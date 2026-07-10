# 仕様確認議事録 — SKU 設計（カラーウェイ × サイズ）v1.0 確定版

対象プロジェクト: shunya-pms（shintarokoenuma/shunya-pms ・ ~/shunya-production-system ・ shunya-pms-web-production.up.railway.app）。saagara-v2 とは完全に別物。

作成: 2026-06-21 セッション10 / v0.1 の §10 全5点を慎太郎さん確定 → v1.0。

---

## 0. このドキュメントの読み方

- 本書は SKU 生成導線を実装する前の設計確定書。記憶でなく live schema（`prisma/schema.prisma`）と既存 spec を design-reread して書いた。
- v0.1 §10 の未確定5点は全て確定（§10 参照）。本書 v1.0 を基に実装ブリーフ（PR1/PR2）へ落とす。

---

## 1. 最初の山の定義（✓ 確定）

- **SKU 生成導線を作り、北極星の数量マトリクスに実データを載せる**ことが本テーマの山。
- 現状（design-reread で確認）: `prisma.sku` の使用は `products.ts:1022`（count・削除ガード）と `skus.ts:47`（findMany・一覧）の2箇所のみ。create/upsert/update/createMany/delete は grep 0件 = **SKU を作る手段がアプリに存在しない**（dev/本番とも0件）。`quantity-matrix-section.tsx` は `SkuRow[]` を props で受けて描くだけの「箱」。

---

## 2. 上流2点の確定事項

### 2-1. 色軸 = ProductColorway に合流（✓ 確定 = 方向 a）

- SKU の「色」は **shunya 管理の Color マスター（自社色番号）基準**であり、仕入先カラーではない（color-master spec: 仕入色はマスター化せず Material 側でマッピング）。
- よって SKU の色軸は **ProductColorway（colorId/patternId を持つカラーウェイ）に一本化**する。SKU = **ProductColorway × サイズ**。
- color-master §5 / §2 が Phase 1B 送りにしたのは「**既存**インライン色列（Sku.colorCode 等）の FK 化・統合（移行）」。本テーマは「**新設**の SKU 生成導線に最初から colorway 参照を持たせる」ものなので §5 のスコープ外（ProductColorway を前倒し配線できたのと同じ理屈）。既存 colorCode 列の物理削除・移行は Phase 1B のまま据え置く。

### 2-2. 数量の出どころ（✓ 確定 / 実装は段階分け）

- 出口を **SalesOrder に一本化**し、入力経路（saagara-v2 連携 / CSV・Excel・メール取り込み / 受注ページ先方入力 / カルテ手入力）はすべて SalesOrder を作る手段として後付けする。SKU 別「受注数」の正は常に SalesOrder。
- SalesOrder は JSON（設計の `sku_quantities`）でなく **SalesOrderItem（SKU × 数量の行）で正規化**する。
- 段階分け:
  - **フェーズ1（本テーマの実装範囲）**: 品番カルテで数量を手入力 → カラーウェイ × サイズで SKU 雛形を生成。受注前の企画段階の数量はこれで足り、SalesOrder 不要。
  - **フェーズ2（別テーマ・スコープ外）**: SalesOrder / SalesOrderItem を建て、Excel/メール取り込み → saagara 連携 → 受注ページの順に流入経路を足す。

---

## 3. Sku スキーマ変更（✓ 確定）

### 3-1. カラーウェイ参照の追加（✓ 確定 = §10-1）

- **`colorwayId String`（NOT NULL）＋ `@relation(ProductColorway, onDelete: Cascade)`** を Sku に追加する。
- 参照方式の根拠: `BomItemColorway` が `productColorwayId` を `@relation` Cascade で参照しているのが「同一品番配下のカラーウェイ参照」の確立パターン。Sku も既に `productId` で Product に Cascade している品番配下のエンティティなので、外部マスター参照ゆえ純 scalar とした `colorId`/`patternId` とは性質が違い、BomItemColorway と同じ @relation Cascade が筋。
- **NOT NULL の根拠**: SKU = カラーウェイ × サイズ で必ずカラーウェイに属す。既存 SKU は0件なので ADD COLUMN NOT NULL のリスクなし（backfill 不要）。BomItemColorway.productColorwayId（NOT NULL）にも一貫。
- 色（colorId）・柄（patternId）は ProductColorway 経由で一意に決まる。Sku は色・柄を直接持たない（正は ProductColorway 一本）。

### 3-2. 既存色列の扱い（✓ 確定 = §10-4 / §5 と両立）

- 既存の `colorCode`(NOT NULL) / `colorName`(NOT NULL) / `colorNameEn` / `colorHex` / `pantone` は **物理削除しない**（§5 通り Phase 1B 送り・本テーマでは触らない）。
- 新規 SKU 生成時、NOT NULL 制約を満たすため `colorCode ← ProductColorway.colorwayCode` / `colorName ← ProductColorway.colorwayName` を**コピー（非正規化キャッシュ）**して埋める。

---

## 4. SKU 生成導線（フェーズ1・✓ 確定）

- 新アクション（仮）`createSkusForProduct(productId, sizes[], quantities?)`:
  - 行（色軸）= その品番の ProductColorway 全件（`listColorways(productId)` を再利用）。
  - 列（サイズ軸）= §6 のサイズ入力。
  - カラーウェイ × サイズの直積で Sku を upsert。`skuCode` は §5 の規則で採番。
  - 数量は当面手入力（§10-5 = 案 a: SKU ごと手入力・品番側は集計表示）。
- 8関数 CRUD パターン（shunya-master-patterns）に準拠。ActionResult 判別 union。

---

## 5. skuCode 採番規則（✓ 確定 = §10-2）

- `{社内品番}-{colorwayCode}-{size}`。例: `AOI-26AW-CUT_SEWN-001-C-M`（カラーウェイ C × サイズ M）。
- colorwayCode は記号（C / B / A / D / F 等）。`@@unique([companyId, skuCode])` を満たす。

---

## 6. サイズ軸の出どころ（✓ 確定 = §10-3）

- サイズの供給元は現状ない（サイズマスター・品番別サイズ展開 UI 共に未実装）。
- フェーズ1: SKU 生成 UI でサイズ展開（例 S/M/L/XL）を**手入力** → カラーウェイ × サイズで雛形生成。サイズマスター化は将来（別起票）。

---

## 7. 数量マトリクス・型の改修（✓ 確定）

- `quantity-matrix-section.tsx` の色軸を `colorCode` グルーピングから **colorwayId（表示は colorwayCode/Name）** に切替。柄カラーウェイ（patternId 付き）も行を持てる。
- `SkuRow` 型を `skus.ts` 直書きから **中立モジュール `src/lib/types/sku.ts`（prisma 非依存）へ移設**（index-browser 罠の予防）。
- `SkuRow` に `colorwayId` / `colorwayCode` / `colorwayName` を追加。マトリクスのセル参照キーを `colorwayId|size` に。

---

## 8. migration 方針（✓ 確定）

- `colorway_id` 追加 = ADD COLUMN（NOT NULL・既存0件で安全）+ FK 制約（ON DELETE CASCADE）。
- 手書き SQL + `migrate diff` の空 diff 検証。dev = db push、本番 = Railway migrate deploy（③ デプロイログで適用確認）。
- ProductColorway 側に逆リレーション `skus Sku[]` を追加（関係定義のみ・列追加ではない）。

---

## 9. 実装の段階分け（✓ 確定）

- **PR1**: スキーマ（colorwayId @relation Cascade + 逆リレーション）+ migration + 型移設（SkuRow → src/lib/types/sku.ts）+ 生成 action（createSkusForProduct）+ マトリクス改修（colorwayId 軸）。
- **PR2**: 生成 UI（サイズ入力 → 生成ボタン → 数量編集）。
- **フェーズ2（別テーマ）**: SalesOrder / SalesOrderItem。

---

## 10. 確定事項（v0.1 §10 の5論点・全て確定）

1. **colorwayId の参照方式** → ✓ `@relation(ProductColorway, onDelete: Cascade)`・NOT NULL（§3-1）。
2. **skuCode 採番** → ✓ `{productCode}-{colorwayCode}-{size}`（§5）。
3. **サイズ軸の出どころ** → ✓ フェーズ1 は手入力・サイズマスターは将来（§6）。
4. **数量マトリクス色軸の切替** → ✓ colorCode → colorwayId・既存列は温存（§3-2, §7）。
5. **フェーズ1 の数量入力** → ✓ 案 a（SKU ごと手入力・品番側は集計表示）。

---

## 改訂履歴

- v0.1（2026-06-21）: 初版ドラフト。live schema design-reread に基づく。「colorwayId 純 scalar」を @relation Cascade に訂正。
- v1.0（2026-06-21）: §10 全5点を慎太郎さん確定。§3-1 に colorwayId = NOT NULL の根拠を追記。
