-- (A) seed1 PR-1: ProductionEstimate/Item + 確定サンプルフラグ（追加のみ・DROP なし）
CREATE TYPE "ProductionEstimateCategory" AS ENUM ('MATERIAL', 'LABOR');
CREATE TYPE "ProductionEstimateItemSource" AS ENUM ('MANUAL', 'SAMPLE_PO', 'SAMPLE_WO', 'BOM');

CREATE TABLE "production_estimates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "estimate_number" VARCHAR(50) NOT NULL,
    "product_id" TEXT NOT NULL,
    "source_sample_production_id" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(255),
    "notes" TEXT,
    "estimate_quantity" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "exchange_rate_usd_jpy" DECIMAL(15,6),
    "margin_rate" DECIMAL(5,2),
    "margin_rate_source" "MarginRateSource" NOT NULL,
    "initial_cost_billing_mode" "InitialCostBillingMode" NOT NULL DEFAULT 'SEPARATE',
    "auto_unit_cost_jpy" DECIMAL(15,2),
    "auto_unit_price_jpy" DECIMAL(15,2),
    "final_unit_price_manual_jpy" DECIMAL(15,2),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "production_estimates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "production_estimates_company_id_estimate_number_key"
    ON "production_estimates"("company_id", "estimate_number");
CREATE INDEX "production_estimates_company_id_product_id_idx"
    ON "production_estimates"("company_id", "product_id");
CREATE INDEX "production_estimates_source_sample_production_id_idx"
    ON "production_estimates"("source_sample_production_id");

CREATE TABLE "production_estimate_items" (
    "id" TEXT NOT NULL,
    "production_estimate_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "item_category" "ProductionEstimateCategory" NOT NULL,
    "is_separate_billing" BOOLEAN NOT NULL DEFAULT false,
    "item_name" VARCHAR(255) NOT NULL,
    "item_name_en" VARCHAR(255),
    "material_id" TEXT,
    "cost_category_id" TEXT,
    "source" "ProductionEstimateItemSource" NOT NULL,
    "source_po_item_id" TEXT,
    "source_wo_item_id" TEXT,
    "source_bom_item_id" TEXT,
    "unit_price" DECIMAL(15,4),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "usage_per_unit" DECIMAL(10,4),
    "loss_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "procurement_mode" "FabricProcurementMode",
    "roll_length" DECIMAL(10,2),
    "roll_price" DECIMAL(15,4),
    "roll_currency" "Currency",
    "cut_fee" DECIMAL(15,2),
    "quantity" DECIMAL(15,4),
    "unit" VARCHAR(20),
    "subtotal" DECIMAL(15,2),
    "subtotal_jpy" DECIMAL(15,2),
    "presented_price_manual_jpy" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "production_estimate_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "production_estimate_items_production_estimate_id_item_order_idx"
    ON "production_estimate_items"("production_estimate_id", "item_order");
CREATE INDEX "production_estimate_items_material_id_idx"
    ON "production_estimate_items"("material_id");
ALTER TABLE "production_estimate_items"
    ADD CONSTRAINT "production_estimate_items_production_estimate_id_fkey"
    FOREIGN KEY ("production_estimate_id") REFERENCES "production_estimates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sample_productions"
    ADD COLUMN "is_production_estimate_base" BOOLEAN NOT NULL DEFAULT false;
-- 1品番1点制約（Prisma 非表現・SQL のみ）
CREATE UNIQUE INDEX "sample_productions_pe_base_one_per_product_key"
    ON "sample_productions"("product_id")
    WHERE "is_production_estimate_base" = true AND "deleted_at" IS NULL;
