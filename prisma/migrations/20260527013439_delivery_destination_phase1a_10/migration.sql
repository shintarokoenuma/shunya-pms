/*
  Warnings:

  - The `status` column on the `delivery_destinations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DeliveryDestinationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "delivery_destinations" ADD COLUMN     "address_line2" VARCHAR(255),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "timezone" VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "DeliveryDestinationStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "delivery_destinations_company_id_status_idx" ON "delivery_destinations"("company_id", "status");
