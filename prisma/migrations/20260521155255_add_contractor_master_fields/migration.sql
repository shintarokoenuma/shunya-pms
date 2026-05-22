/*
  Warnings:

  - The `status` column on the `contractors` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ContractorStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "contractors" ADD COLUMN     "address_en" TEXT,
ADD COLUMN     "address_line2" VARCHAR(255),
ADD COLUMN     "assigned_to_user_id" TEXT,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "fax" VARCHAR(50),
ADD COLUMN     "postal_code" VARCHAR(20),
ADD COLUMN     "prefecture" VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "ContractorStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "contractor_contacts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contractor_id" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200),
    "job_title" VARCHAR(255),
    "department" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "mobile" VARCHAR(50),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" "Language",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contractor_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contractor_contacts_contractor_id_is_primary_idx" ON "contractor_contacts"("contractor_id", "is_primary");

-- CreateIndex
CREATE INDEX "contractors_company_id_status_idx" ON "contractors"("company_id", "status");

-- CreateIndex
CREATE INDEX "contractors_company_id_country_idx" ON "contractors"("company_id", "country");

-- CreateIndex
CREATE INDEX "contractors_assigned_to_user_id_idx" ON "contractors"("assigned_to_user_id");

-- AddForeignKey
ALTER TABLE "contractor_contacts" ADD CONSTRAINT "contractor_contacts_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
