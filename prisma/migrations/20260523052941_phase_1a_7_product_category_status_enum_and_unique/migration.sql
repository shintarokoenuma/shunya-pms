/*
  Warnings:

  - The `status` column on the `product_categories` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[company_id,category_name]` on the table `product_categories` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProductCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "product_categories" DROP COLUMN "status",
ADD COLUMN     "status" "ProductCategoryStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "product_categories_company_id_status_idx" ON "product_categories"("company_id", "status");

-- CreateIndex
CREATE INDEX "product_categories_company_id_level_idx" ON "product_categories"("company_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_company_id_category_name_key" ON "product_categories"("company_id", "category_name");
