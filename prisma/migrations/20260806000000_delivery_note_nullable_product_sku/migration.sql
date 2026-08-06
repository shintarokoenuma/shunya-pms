-- B-108 §3-1: サンプル納品書のための制約緩和（片道切符・4ゲート厳守）。
-- delivery_notes.product_id: 1枚に複数品番を載せるため代表 productId を持たせない。
-- delivery_note_items.sku_id: ビーカー等 SKU を持たない見本を載せるため。
-- 非破壊: DROP NOT NULL のみ。列・既存データには触れない（DML なし）。
ALTER TABLE "delivery_notes" ALTER COLUMN "product_id" DROP NOT NULL;
ALTER TABLE "delivery_note_items" ALTER COLUMN "sku_id" DROP NOT NULL;
