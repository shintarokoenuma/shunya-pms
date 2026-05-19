/*
  Warnings:

  - The `status` column on the `brands` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "brands" DROP COLUMN "status",
ADD COLUMN     "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE';
