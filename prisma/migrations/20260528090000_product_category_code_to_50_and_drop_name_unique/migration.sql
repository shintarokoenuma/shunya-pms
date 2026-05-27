/*
  Phase 1A-14：商品カテゴリの階層対応スキーマ調整。

  - category_code を VARCHAR(10) → VARCHAR(50) に拡張
    （`LADIES-TOPS-TSHIRT` のような階層コードを許容するため）
  - (company_id, category_name) の unique 制約を廃止
    （同名「Tシャツ」を異なる親階層に持てるようにするため）

  既存データが存在する場合でも、文字列拡張と unique 削除は破壊的ではない。
*/

-- DropIndex
DROP INDEX "product_categories_company_id_category_name_key";

-- AlterTable
ALTER TABLE "product_categories" ALTER COLUMN "category_code" SET DATA TYPE VARCHAR(50);
