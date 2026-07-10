# 実装ブリーフ — SKU 生成導線 PR1（スキーマ＋型＋生成action＋マトリクス改修）

## 【対象プロジェクト】
- repo: shintarokoenuma/shunya-pms
- local: ~/shunya-production-system
- prod: shunya-pms-web-production.up.railway.app
- ※ saagara-v2 とは完全に別物。これは shunya-pms。実行前に VS Code が ~/shunya-production-system を開いているか目視。

## 前提 spec
- `docs/specs/sku-design-spec-confirmation-v1_0-2026-06-21.md`（確定版）。
- 本 PR の範囲: スキーマ + migration + 型移設 + 生成 action + マトリクス改修。**生成 UI は PR2**（本 PR では action までで、目視は dev script で行う）。

---

## STEP 0. 着手前確認（read-only・罠抽出）

git:
```bash
cd ~/shunya-production-system
git checkout main && git pull
git log origin/main --oneline -3   # 先頭 5d60da5 を確認
git checkout -b feat/sku-colorway-axis
```

罠抽出 grep（結果を貼り戻してから STEP 1 へ。結果次第で STEP 3 の型移設手順を微調整）:
```bash
# (1) Sku に監査網羅型の罠があるか（Product の ProductAuditField 相当が Sku にあると colorwayId 追加でビルド失敗）
grep -rn "SkuAuditField\|ProductAuditField\|afterData" src/lib/actions/skus.ts src/lib/actions/products.ts 2>/dev/null || echo "(Sku 監査なし)"

# (2) skus.ts が "use server" か（SkuRow を client が import → 中立型移設の必要性の現状確認）
head -5 src/lib/actions/skus.ts

# (3) listColorways の戻り型（id/colorwayCode/colorwayName/patternId/status を持つか・ColorwayRow 名）
grep -nE "export type|export async function listColorways|colorwayCode|colorwayName|patternId|select:" src/lib/actions/product-colorways.ts | head -30

# (4) 既存テスト品番のカラーウェイ件数（生成テスト用・AOI-26AW-CUT_SEWN-001）
grep -rn "listColorways" src/app 2>/dev/null | head
```

判定（機械的に白黒つくもの）: ブランチ作成・tsc/lint・staging 内容は Claude Code 自走可。**マージ（②）と本番デプロイログ確認（③）は慎太郎さんが握る**。

---

## STEP 1. スキーマ

`prisma/schema.prisma` の `model Sku`:
```prisma
  // カラーウェイ参照（B-064 SKU 設計: ProductColorway × サイズ。BomItemColorway と同方式 @relation Cascade）
  colorwayId String @map("colorway_id")
  colorway   ProductColorway @relation(fields: [colorwayId], references: [id], onDelete: Cascade)
```
- 既存 colorCode/colorName 等は**残す**（§3-2・物理削除しない）。
- `@@index([productId])` の隣に `@@index([colorwayId])` を追加。

`model ProductColorway` に逆リレーション:
```prisma
  skus Sku[]
```
- `npx prisma format && npx prisma validate`。

---

## STEP 2. migration

dev（_prisma_migrations なし・db push）:
```bash
npx prisma db push
```

本番用 migration ファイル手書き（36本目・命名 `20260621000000_sku_colorway_id`）:
```sql
ALTER TABLE "skus" ADD COLUMN "colorway_id" TEXT NOT NULL;
ALTER TABLE "skus" ADD CONSTRAINT "skus_colorway_id_fkey"
  FOREIGN KEY ("colorway_id") REFERENCES "product_colorways"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "skus_colorway_id_idx" ON "skus"("colorway_id");
```
- ※ ADD COLUMN NOT NULL は既存行があると失敗するが、skus は dev/本番とも0件なので安全（STEP 0 で要確認なら `prisma studio` で0件確認）。
- 空 diff 検証:
```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --exit-code
# → No difference detected. / exit 0
```
- 本番適用は③（マージ後 Railway デプロイログで `Applying migration 20260621000000_sku_colorway_id` を目視）。

---

## STEP 3. 型移設（index-browser 罠の予防）

- `src/lib/types/sku.ts` 新設（prisma 非依存）:
```ts
export type SkuRow = {
  id: string
  colorwayId: string
  colorwayCode: string
  colorwayName: string
  colorCode: string      // 後方互換・非正規化キャッシュ
  colorName: string
  size: string
  sizeOrder: number
  orderedQuantity: number
  productionQuantity: number
  producedQuantity: number
  deliveredQuantity: number
  defectQuantity: number
}
```
- `skus.ts` は `SkuRow` をこの中立モジュールから re-export（既存 import 互換）。
- `quantity-matrix-section.tsx` の `import type { SkuRow }` を `@/lib/types/sku` に向け替え。

---

## STEP 4. 生成 action（`src/lib/actions/skus.ts`）

- `listSkusForProduct` を colorway 情報込みに拡張:
```ts
include: { colorway: { select: { colorwayCode: true, colorwayName: true } } }
// → SkuRow に colorwayId / colorwayCode / colorwayName を詰める
orderBy: [{ colorway: { sortOrder: "asc" } }, { sizeOrder: "asc" }]
```
- 新規 `createSkusForProduct(productId, sizes: {size,sizeOrder}[], quantities?)`:
  - `listColorways(productId)` で ACTIVE カラーウェイ取得 → サイズと直積。
  - 各セル: `skuCode = ${productCode}-${colorwayCode}-${size}`、`colorwayId = colorway.id`、`colorCode = colorwayCode`、`colorName = colorwayName`、数量は引数 or 0。
  - `prisma.sku.upsert`（`@@unique([companyId, skuCode])` キー）で冪等。
  - ActionResult 判別 union（shunya-master-patterns 準拠）。

---

## STEP 5. マトリクス改修（`quantity-matrix-section.tsx`）

- 色軸グルーピングを `colorCode` → `colorwayId` に。表示ラベルは `colorwayCode`（＋ `colorwayName`）。
- セル参照 `cellMap` のキーを `${s.colorwayId}|${s.size}` に。
- 行の出現順は `listSkusForProduct` の orderBy（colorway.sortOrder）に従う。柄カラーウェイ（patternId 付き）も行として出る。

---

## STEP 6. 検証・PR

```bash
npx tsc --noEmit          # 0 errors
npm run lint              # 0 warnings
npm run build             # success
```
ローカル目視（UI は PR2 なので dev script で）:
```bash
# 一時 script で AOI 品番に SKU 生成 → studio + localhost で確認（script はコミットしない）
npx tsx scripts/_tmp_gen_skus.ts   # createSkusForProduct を1回呼ぶ
npx prisma studio                  # skus 行が colorwayId 付きで生成されたか
# npm run dev → localhost:3000 品番詳細 → 数量マトリクスに行が出るか
```
- 【dev起動の罠】schema 変更後に dev が古い Prisma client を掴むと Internal Server Error。順序: `lsof -ti:3000,3001 | xargs kill -9` → `npx prisma generate` → `rm -rf .next` → `npm run dev`。
- 目視 OK なら `git add`（**明示パスのみ**・`_tmp_gen_skus.ts` は add しない）→ commit → push → PR open（自走可）。
- マージ②・本番③は慎太郎さん。migration 入り PR なので③の本体は `Applying migration ...` 行。

---

## 罠リマインド（着手前に再掲）
- `git add -A` / `git add .` 禁止。明示パスのみ。
- index-browser: 型は中立モジュール（STEP 3）。
- 本番確認の罠: SKU は本番0件なので、本番マトリクスは空＝正常（検証データを本番に入れない）。
- dev 起動順序（STEP 6）。

## 次 PR（PR2・予告）
生成 UI: 品番詳細にサイズ入力 → 「SKU 生成」ボタン → カラーウェイ×サイズのマトリクスで数量を直接編集。
