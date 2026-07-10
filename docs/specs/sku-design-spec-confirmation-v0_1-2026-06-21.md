# 仕様確認議事録 — SKU 設計（カラーウェイ × サイズ）v0.1 ドラフト

対象プロジェクト: shunya-pms（shintarokoenuma/shunya-pms ・ ~/shunya-production-system ・ shunya-pms-web-production.up.railway.app）。saagara-v2 とは完全に別物。

作成: 2026-06-21 セッション10 / SKU 設計の上流確定後・コード着手前のドラフト。

---

## 0. このドキュメントの読み方

- 本書は SKU 生成導線を実装する前の設計確定書。記憶でなく live schema（`prisma/schema.prisma`）と既存 spec を design-reread して書いた。
- 「✓ 確定」= 慎太郎さんと合意済み。「要確認」= 本書で慎太郎さんの確定を仰ぐ論点（§10 に集約）。
- スキーマ変更・migration・実装は本書確定後の別ブリーフで行う。本書時点でコードは未着手。

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

### 2-2. 数量の出どころ（✓ 方向確定 / 実装は段階分け）

- 出口を **SalesOrder に一本化**し、入力経路（saagara-v2 連携 / CSV・Excel・メール取り込み / 受注ページ先方入力 / カルテ手入力）はすべて SalesOrder を作る手段として後付けする。SKU 別「受注数」の正は常に SalesOrder。
- SalesOrder は JSON（設計の `sku_quantities`）でなく **SalesOrderItem（SKU × 数量の行）で正規化**する（集計・MOQ判定・在庫引き当てが SQL で素直になる）。
- 段階分け:
  - **フェーズ1（本テーマの実装範囲）**: 品番カルテで数量を手入力 → カラーウェイ × サイズで SKU 雛形を生成。受注前の企画段階の数量はこれで足り、SalesOrder 不要。北極星マトリクスを最短で埋める。
  - **フェーズ2（別テーマ・スコープ外）**: SalesOrder / SalesOrderItem を建て、Excel/メール取り込み → saagara 連携 → 受注ページの順に流入経路を足す。

---

## 3. Sku スキーマ変更（要確認 = §10-1, §10-4）

### 3-1. カラーウェイ参照の追加

- **`colorwayId String` ＋ `@relation(ProductColorway, onDelete: Cascade)`** を Sku に追加する。
- 参照方式の根拠（design-reread で前回推奨を訂正）: `BomItemColorway` は `productColorwayId` を `@relation` Cascade で参照しており、これが「同一品番配下のカラーウェイ参照」の確立パターン。Sku も既に `productId` で Product に Cascade している品番配下のエンティティなので、`colorId`/`patternId`（外部マスター参照ゆえ純 scalar）とは性質が違い、**BomItemColorway と同じ @relation Cascade が筋**。
- 色（colorId）・柄（patternId）は ProductColorway 経由で一意に決まる。Sku は色・柄を直接持たない（正は ProductColorway 一本）。

### 3-2. 既存色列の扱い（§5 と両立）

- 既存の `colorCode`(NOT NULL) / `colorName`(NOT NULL) / `colorNameEn` / `colorHex` / `pantone` は **物理削除しない**（§5 通り Phase 1B 送り・本テーマでは触らない）。
- 新規 SKU 生成時、NOT NULL 制約を満たすため `colorCode ← ProductColorway.colorwayCode` / `colorName ← ProductColorway.colorwayName` を**コピー（非正規化キャッシュ）**して埋める。これで既存マトリクス描画との後方互換も保てる。

---

## 4. SKU 生成導線（フェーズ1・要確認 = §10-3, §10-5）

- 新アクション（仮）`createSkusForProduct(productId, sizes[], quantities)`:
  - 行（色軸）= その品番の ProductColorway 全件（`listColorways(productId)` を再利用）。
  - 列（サイズ軸）= 後述 §6 のサイズ入力。
  - カラーウェイ × サイズの直積で Sku を upsert。`skuCode` は §5 の規則で採番。
  - 数量は当面手入力（フェーズ1）。受注数の正は将来 SalesOrder（フェーズ2）。
- 8関数 CRUD パターン（shunya-master-patterns）に準拠。ActionResult 判別 union。

---

## 5. skuCode 採番規則（要確認 = §10-2）

- 設計（Part2）: `{社内品番}-{カラー}-{サイズ}`（例 `MK-26SS-TS-001-BLK-M`）。
- 本設計では「カラー」部を **ProductColorway.colorwayCode**（記号: C / B / A / D / F 等）に置く。
  - 例: `AOI-26AW-CUT_SEWN-001-C-M`（カラーウェイ C × サイズ M）。
- `@@unique([companyId, skuCode])` を満たす（品番 × カラーウェイ × サイズで一意）。

---

## 6. サイズ軸の出どころ（新論点・要確認 = §10-3）

- SKU = カラーウェイ × サイズ のうち、カラーウェイは ProductColorway から供給されるが、**サイズの供給元が現状ない**（サイズマスター・品番別サイズ展開の UI 共に未実装）。
- フェーズ1 の提案: 品番カルテ（または SKU 生成 UI）で「サイズ展開（例 S/M/L/XL）」を**手入力** → カラーウェイ × サイズで雛形生成。サイズマスター化は将来（B-枠で別起票）。

---

## 7. 数量マトリクス・型の改修（✓ 方針 / 実装は本テーマ）

- `quantity-matrix-section.tsx` の色軸を `colorCode` グルーピングから **colorwayId（表示は colorwayCode/Name）** に切替。柄カラーウェイ（patternId 付き）も行を持てる。
- `SkuRow` 型を `skus.ts` 直書きから **中立モジュール `src/lib/types/sku.ts`（prisma 非依存）へ移設**。create/update 導線追加で client 接触が増えるため、index-browser 罠（"use client" が "use server" から型 import → @prisma/client がブラウザ漏れ）を予防する。
- `SkuRow` に `colorwayId` / `colorwayCode` / `colorwayName` を追加（マトリクスのセル参照キーを `colorwayId|size` に）。

---

## 8. migration 方針（✓ 方針）

- `colorwayId` 追加 = ADD COLUMN（非破壊）。既存 SKU は0件なので backfill 不要。
- 手書き SQL + `migrate diff` の空 diff 検証（このリポジトリの確立手順）。dev = db push、本番 = Railway migrate deploy。
- `@relation` を張るため、ProductColorway 側に逆リレーション（`skus Sku[]`）を追加。これは schema 上の関係定義のみで列追加ではない。

---

## 9. 実装の段階分け（✓ 確定）

1. スキーマ: Sku に colorwayId（@relation Cascade）追加 + ProductColorway 逆リレーション + migration。
2. 型: SkuRow を src/lib/types/sku.ts へ移設・colorway 3項目追加。
3. 生成導線: createSkusForProduct（カラーウェイ × サイズ・手入力数量）。
4. 表示: quantity-matrix-section を colorwayId 軸へ改修。
5. （フェーズ2・別テーマ）SalesOrder / SalesOrderItem。

---

## 10. 未確定事項（要・慎太郎さん確認）

1. **colorwayId の参照方式**: `@relation(ProductColorway, onDelete: Cascade)` で確定してよいか（前回の「純 scalar」推奨を、BomItemColorway の手本に合わせて訂正）。
2. **skuCode 採番**: `{productCode}-{colorwayCode}-{size}`（例 `AOI-26AW-CUT_SEWN-001-C-M`）でよいか。colorwayCode は記号（C/B/A/D/F…）。
3. **サイズ軸の出どころ**: フェーズ1 はカルテ（or SKU 生成 UI）でサイズ手入力でよいか。サイズマスター化は将来送りでよいか。
4. **数量マトリクス色軸の切替**: 色軸を colorCode → colorwayId に変える（既存 colorCode グルーピングは廃するが、列自体は §5 通り温存・物理削除しない）でよいか。
5. **フェーズ1 の数量入力**: 当面手入力とするが、品番カルテの `expectedQuantity`（想定数量）と SKU 個別数量の関係は——(a) SKU ごとに手入力し品番側は集計表示、(b) 品番の想定数量を按分、のどちらか。推奨は (a)（按分は実務の歩留まり想定とずれるため）。

---

## 改訂履歴

- v0.1（2026-06-21）: 初版ドラフト。live schema design-reread に基づき作成。前回チャットの「colorwayId 純 scalar」推奨を §3-1 で @relation Cascade に訂正。
