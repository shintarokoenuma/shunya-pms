-- CreateEnum
CREATE TYPE "BillingClassification" AS ENUM ('INDIVIDUAL_BILLING', 'UNIT_PRICE_INCLUDED');

-- AlterEnum
ALTER TYPE "ProgressTaskType" ADD VALUE 'BODY';

-- AlterTable
ALTER TABLE "po_items" ADD COLUMN     "asset_storage_expiry_date" DATE,
ADD COLUMN     "asset_storage_start_date" DATE,
ADD COLUMN     "billing_classification" "BillingClassification",
ADD COLUMN     "cost_category_id" TEXT,
ADD COLUMN     "is_physical_asset" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "progress_task_id" TEXT,
ADD COLUMN     "sample_production_id" TEXT;

-- AlterTable
ALTER TABLE "wo_items" ADD COLUMN     "billing_classification" "BillingClassification",
ADD COLUMN     "cost_category_id" TEXT;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN     "processing_type_id" TEXT,
ADD COLUMN     "progress_task_id" TEXT;

-- CreateIndex
CREATE INDEX "po_items_cost_category_id_idx" ON "po_items"("cost_category_id");

-- CreateIndex
CREATE INDEX "purchase_orders_progress_task_id_idx" ON "purchase_orders"("progress_task_id");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_sample_production_id_idx" ON "purchase_orders"("company_id", "sample_production_id");

-- CreateIndex
CREATE INDEX "wo_items_cost_category_id_idx" ON "wo_items"("cost_category_id");

-- CreateIndex
CREATE INDEX "work_orders_progress_task_id_idx" ON "work_orders"("progress_task_id");

-- CreateIndex
CREATE INDEX "work_orders_company_id_processing_type_id_idx" ON "work_orders"("company_id", "processing_type_id");
