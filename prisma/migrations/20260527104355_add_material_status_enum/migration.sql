/*
  Warnings:

  - The `status` column on the `materials` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "materials" DROP COLUMN "status",
ADD COLUMN     "status" "MaterialStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "materials_company_id_status_idx" ON "materials"("company_id", "status");
