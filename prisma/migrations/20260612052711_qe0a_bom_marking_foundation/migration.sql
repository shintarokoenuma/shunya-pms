-- QE-0a: 見積もりエンジン データ基盤
-- 仕様: docs/specs/qe-0-quotation-foundation-spec-confirmation-v1_0-2026-06-12.md（案A）
-- 非破壊: CREATE TYPE/TABLE/INDEX + ADD COLUMN群 + DROP NOT NULL×2 のみ。DROP TABLE/COLUMN・データ変換なし。

-- CreateEnum
CREATE TYPE "FabricProcurementMode" AS ENUM ('ROLL', 'METER');

-- CreateEnum
CREATE TYPE "UsageSource" AS ENUM ('MANUAL', 'MARKING_SHEET', 'CAD');

-- AlterTable
ALTER TABLE "bom" ADD COLUMN     "product_id" TEXT,
ALTER COLUMN "specification_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "bom_items" ADD COLUMN     "marking_record_id" TEXT,
ADD COLUMN     "procurement_mode" "FabricProcurementMode",
ADD COLUMN     "usage_source" "UsageSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "usage_per_unit" DROP NOT NULL,
ALTER COLUMN "unit_price" DROP NOT NULL;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "roll_length" DECIMAL(10,2),
ADD COLUMN     "roll_price" DECIMAL(15,2);

-- CreateTable
CREATE TABLE "marking_records" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "material_id" TEXT,
    "marker_name" VARCHAR(255),
    "fabric_width" DECIMAL(6,1) NOT NULL,
    "total_units" INTEGER NOT NULL,
    "total_length" DECIMAL(10,1) NOT NULL,
    "usage_per_unit_derived" DECIMAL(10,4),
    "yield_rate" DECIMAL(5,1),
    "parts_count" INTEGER,
    "pattern_pitch" DECIMAL(6,1),
    "size_combination" VARCHAR(255),
    "source" "UsageSource" NOT NULL DEFAULT 'MARKING_SHEET',
    "original_file_gcs_path" VARCHAR(500),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "marking_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marking_records_company_id_product_id_idx" ON "marking_records"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "bom_company_id_product_id_idx" ON "bom"("company_id", "product_id");

