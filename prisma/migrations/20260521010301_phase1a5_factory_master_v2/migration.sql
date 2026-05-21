/*
  Warnings:

  - The `status` column on the `factories` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `company_id` to the `factory_contacts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FactoryStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- DropIndex
DROP INDEX "factory_contacts_factory_id_idx";

-- AlterTable
ALTER TABLE "factories" ADD COLUMN     "address_line2" VARCHAR(255),
ADD COLUMN     "assigned_to_user_id" TEXT,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "prefecture" VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "FactoryStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "factory_contacts" ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "department" VARCHAR(255);

-- CreateIndex
CREATE INDEX "factories_company_id_status_idx" ON "factories"("company_id", "status");

-- CreateIndex
CREATE INDEX "factories_assigned_to_user_id_idx" ON "factories"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "factory_contacts_factory_id_is_primary_idx" ON "factory_contacts"("factory_id", "is_primary");
