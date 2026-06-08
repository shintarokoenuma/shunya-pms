-- AlterTable
ALTER TABLE "po_items" ADD COLUMN     "design_code" VARCHAR(100),
ADD COLUMN     "size_spec" VARCHAR(100),
ADD COLUMN     "supplier_item_code" VARCHAR(100),
ALTER COLUMN "unit_price" DROP NOT NULL,
ALTER COLUMN "subtotal" DROP NOT NULL;
