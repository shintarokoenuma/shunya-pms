/*
  Warnings:

  - The values [LINING,INTERLINING,ZIPPER,BUTTON,HANG_TAG,PACKAGING,ORIGINAL_FABRIC,PRE_MADE] on the enum `SupplierType` will be removed. If these variants are still used in the database, this will fail.
  - The `status` column on the `suppliers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `company_id` to the `supplier_contacts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- AlterEnum
BEGIN;
CREATE TYPE "SupplierType_new" AS ENUM ('FABRIC', 'TRIM', 'THREAD', 'ACCESSORY', 'LABEL', 'PATTERN', 'BODY', 'USED_CLOTHING', 'OTHER');
ALTER TABLE "suppliers" ALTER COLUMN "supplier_type" TYPE "SupplierType_new"[] USING ("supplier_type"::text::"SupplierType_new"[]);
ALTER TYPE "SupplierType" RENAME TO "SupplierType_old";
ALTER TYPE "SupplierType_new" RENAME TO "SupplierType";
DROP TYPE "public"."SupplierType_old";
COMMIT;

-- DropIndex
DROP INDEX "supplier_contacts_supplier_id_idx";

-- AlterTable
ALTER TABLE "supplier_contacts" ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "department" VARCHAR(255);

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "address_line2" VARCHAR(255),
ADD COLUMN     "assigned_to_user_id" TEXT,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "prefecture" VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "supplier_contacts_supplier_id_is_primary_idx" ON "supplier_contacts"("supplier_id", "is_primary");

-- CreateIndex
CREATE INDEX "suppliers_company_id_status_idx" ON "suppliers"("company_id", "status");

-- CreateIndex
CREATE INDEX "suppliers_assigned_to_user_id_idx" ON "suppliers"("assigned_to_user_id");
