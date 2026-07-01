-- QE-1R: 概算量産見積（Rough estimate）。量産軸の概算レーン。
-- 純増（CREATE TYPE ×3・CREATE TABLE ×2・index・FK のみ）。既存テーブルの ALTER はゼロ＝非破壊。
-- 仕様: docs/specs/quotation-rough-estimate-spec-confirmation-v0_1-2026-07-01.md
--       docs/specs/quotation-rough-estimate-implementation-brief-2026-07-01.md

-- CreateEnum
CREATE TYPE "RoughEstimateCategory" AS ENUM ('MATERIAL', 'LABOR', 'INITIAL_COST');

-- CreateEnum
CREATE TYPE "RoughEstimateItemSource" AS ENUM ('MANUAL', 'PAST_PO', 'PAST_WO');

-- CreateEnum
CREATE TYPE "MarginRateSource" AS ENUM ('BRAND_DEFAULT', 'MANUAL_OVERRIDE');

-- CreateTable
CREATE TABLE "rough_estimates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "estimate_number" VARCHAR(50) NOT NULL,
    "product_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(255),
    "notes" TEXT,
    "presented_moq" INTEGER,
    "expected_quantity_band" VARCHAR(100),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "valid_until" DATE,
    "margin_rate" DECIMAL(5,2),
    "margin_rate_source" "MarginRateSource" NOT NULL,
    "auto_cost_total_jpy" DECIMAL(15,2),
    "auto_price_total_jpy" DECIMAL(15,2),
    "final_price_manual_jpy" DECIMAL(15,2),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rough_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rough_estimate_items" (
    "id" TEXT NOT NULL,
    "rough_estimate_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "item_category" "RoughEstimateCategory" NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "item_name_en" VARCHAR(255),
    "material_id" TEXT,
    "cost_category_id" TEXT,
    "source" "RoughEstimateItemSource" NOT NULL,
    "source_po_item_id" TEXT,
    "source_wo_item_id" TEXT,
    "quantity" DECIMAL(15,4),
    "unit" VARCHAR(20),
    "unit_price" DECIMAL(15,4),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "subtotal" DECIMAL(15,2),
    "subtotal_jpy" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rough_estimate_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rough_estimates_company_id_estimate_number_key" ON "rough_estimates"("company_id", "estimate_number");

-- CreateIndex
CREATE INDEX "rough_estimates_company_id_product_id_idx" ON "rough_estimates"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "rough_estimate_items_rough_estimate_id_item_order_idx" ON "rough_estimate_items"("rough_estimate_id", "item_order");

-- CreateIndex
CREATE INDEX "rough_estimate_items_material_id_idx" ON "rough_estimate_items"("material_id");

-- AddForeignKey
ALTER TABLE "rough_estimate_items" ADD CONSTRAINT "rough_estimate_items_rough_estimate_id_fkey" FOREIGN KEY ("rough_estimate_id") REFERENCES "rough_estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
