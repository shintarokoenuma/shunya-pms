/*
  Phase 1A-15：MaterialCategory に階層運用 + ステータス管理を追加。

  - MaterialCategoryStatus enum を新規作成
  - status / level カラムを追加（NOT NULL、既存 0 件のため安全）
  - parent_category_id / status / level の各検索性能向上 index を追加
*/

-- CreateEnum
CREATE TYPE "MaterialCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "material_categories" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "MaterialCategoryStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "material_categories_company_id_parent_category_id_idx" ON "material_categories"("company_id", "parent_category_id");

-- CreateIndex
CREATE INDEX "material_categories_company_id_status_idx" ON "material_categories"("company_id", "status");

-- CreateIndex
CREATE INDEX "material_categories_company_id_level_idx" ON "material_categories"("company_id", "level");
