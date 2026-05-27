/*
  Warnings:

  - A unique constraint covering the columns `[company_id,primary_supplier_id,material_code]`
    on the table `materials` will be added.
    既存 0 件のため衝突なし（Phase 1A-13a-fix）。
  - `primary_supplier_id` を NOT NULL に変更（既存 0 件のため安全）。

*/

-- DropIndex
DROP INDEX "materials_company_id_material_code_key";

-- AlterTable
ALTER TABLE "materials" ALTER COLUMN "primary_supplier_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "materials_company_id_primary_supplier_id_material_code_key" ON "materials"("company_id", "primary_supplier_id", "material_code");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_primary_supplier_id_fkey" FOREIGN KEY ("primary_supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
