-- CreateEnum
CREATE TYPE "ProcessingTypeStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "processing_types" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "ProcessingTypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "processing_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processing_types_company_id_status_idx" ON "processing_types"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "processing_types_company_id_code_key" ON "processing_types"("company_id", "code");
