/*
  Warnings:

  - The `status` column on the `buyers` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BuyerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "buyers" ADD COLUMN     "address_line2" VARCHAR(255),
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "contact_person" VARCHAR(255),
ADD COLUMN     "country" VARCHAR(2) NOT NULL DEFAULT 'JP',
ADD COLUMN     "postal_code" VARCHAR(20),
ADD COLUMN     "prefecture" VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "BuyerStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "buyers_company_id_status_idx" ON "buyers"("company_id", "status");

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
