/*
  Warnings:

  - You are about to drop the column `size_spec` on the `po_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "po_items" DROP COLUMN "size_spec",
ADD COLUMN     "size_unit" VARCHAR(10),
ADD COLUMN     "size_value" DECIMAL(15,4);
