/*
  Warnings:

  - You are about to drop the `expense_categories` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CostCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- DropTable
DROP TABLE "expense_categories";

-- DropEnum
DROP TYPE "ExpenseCategoryStatus";

-- DropEnum
DROP TYPE "ExpenseType";

-- CreateTable
CREATE TABLE "cost_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_code" VARCHAR(50) NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "category_name_en" VARCHAR(100),
    "parent_category_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "external_category" "ExternalCostCategory" NOT NULL,
    "is_system_reserved" BOOLEAN NOT NULL DEFAULT false,
    "standard_amount" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "calculation_type" "CalculationType" NOT NULL DEFAULT 'FIXED',
    "notes" TEXT,
    "status" "CostCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "cost_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_categories_company_id_status_idx" ON "cost_categories"("company_id", "status");

-- CreateIndex
CREATE INDEX "cost_categories_company_id_parent_category_id_idx" ON "cost_categories"("company_id", "parent_category_id");

-- CreateIndex
CREATE INDEX "cost_categories_company_id_external_category_idx" ON "cost_categories"("company_id", "external_category");

-- CreateIndex
CREATE UNIQUE INDEX "cost_categories_company_id_category_code_key" ON "cost_categories"("company_id", "category_code");

-- AddForeignKey
ALTER TABLE "cost_categories" ADD CONSTRAINT "cost_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "cost_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
