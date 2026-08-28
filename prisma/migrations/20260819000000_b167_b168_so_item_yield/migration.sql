-- B-167 / B-168 PR-2a: SoItem に歩留まり列を追加し、単価・小計を nullable 化する。
-- 非破壊: CREATE TYPE / ADD COLUMN / DROP NOT NULL のみ。
--   DROP COLUMN / DROP TABLE / DROP TYPE は書かない。
-- 対象は so_items のみ。sales_orders（ヘッダの subtotal / total_amount）には触れない。
-- 前例: 20260813000000_b148_sales_order_product_nullable（B-148 の DROP NOT NULL）。
CREATE TYPE "YieldMode" AS ENUM ('RATE', 'QUANTITY');
ALTER TABLE "so_items" ALTER COLUMN "unit_price" DROP NOT NULL;
ALTER TABLE "so_items" ALTER COLUMN "subtotal" DROP NOT NULL;
ALTER TABLE "so_items" ADD COLUMN "yield_mode" "YieldMode";
ALTER TABLE "so_items" ADD COLUMN "yield_quantity" INTEGER;
