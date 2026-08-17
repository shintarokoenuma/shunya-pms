-- B-148 PR-1: SO は複数品番を含むため代表 productId を必須にしない（受注 spec v1.0 R-5）
-- 非破壊: DROP NOT NULL のみ。列・既存データには触れない（DML なし）。
-- 前例: 20260806000000_delivery_note_nullable_product_sku（B-108）
ALTER TABLE "sales_orders" ALTER COLUMN "product_id" DROP NOT NULL;
