/*
  Warnings:

  - The values [WEIGHT_BASED,VOLUME_BASED,DISTANCE_BASED] on the enum `CalculationType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `expense_name` on the `expense_categories` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(100)`.
  - You are about to alter the column `expense_name_en` on the `expense_categories` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(100)`.
  - The `status` column on the `expense_categories` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ExpenseCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterEnum
BEGIN;
CREATE TYPE "CalculationType_new" AS ENUM ('FIXED', 'PER_UNIT', 'PERCENTAGE');
ALTER TABLE "public"."expense_categories" ALTER COLUMN "calculation_type" DROP DEFAULT;
ALTER TABLE "public"."quotation_cost_breakdowns" ALTER COLUMN "calculation_type" DROP DEFAULT;
ALTER TABLE "expense_categories" ALTER COLUMN "calculation_type" TYPE "CalculationType_new" USING ("calculation_type"::text::"CalculationType_new");
ALTER TABLE "quotation_cost_breakdowns" ALTER COLUMN "calculation_type" TYPE "CalculationType_new" USING ("calculation_type"::text::"CalculationType_new");
ALTER TYPE "CalculationType" RENAME TO "CalculationType_old";
ALTER TYPE "CalculationType_new" RENAME TO "CalculationType";
DROP TYPE "public"."CalculationType_old";
ALTER TABLE "expense_categories" ALTER COLUMN "calculation_type" SET DEFAULT 'FIXED';
ALTER TABLE "quotation_cost_breakdowns" ALTER COLUMN "calculation_type" SET DEFAULT 'FIXED';
COMMIT;

-- AlterTable
ALTER TABLE "expense_categories" ALTER COLUMN "expense_name" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "expense_name_en" SET DATA TYPE VARCHAR(100),
DROP COLUMN "status",
ADD COLUMN     "status" "ExpenseCategoryStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "expense_categories_company_id_status_idx" ON "expense_categories"("company_id", "status");

-- CreateIndex
CREATE INDEX "expense_categories_company_id_expense_type_idx" ON "expense_categories"("company_id", "expense_type");
