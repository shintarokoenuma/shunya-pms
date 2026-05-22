/*
  Warnings:

  - You are about to drop the column `preferredLanguage` on the `contractor_contacts` table. All the data in the column will be lost.
  - You are about to drop the column `preferredLanguage` on the `factory_contacts` table. All the data in the column will be lost.
  - You are about to drop the column `preferredLanguage` on the `supplier_contacts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "client_contacts" ADD COLUMN     "preferred_language" "Language";

-- AlterTable
ALTER TABLE "contractor_contacts" DROP COLUMN "preferredLanguage",
ADD COLUMN     "preferred_language" "Language";

-- AlterTable
ALTER TABLE "factory_contacts" DROP COLUMN "preferredLanguage",
ADD COLUMN     "preferred_language" "Language";

-- AlterTable
ALTER TABLE "supplier_contacts" DROP COLUMN "preferredLanguage",
ADD COLUMN     "preferred_language" "Language";
