-- B-062 β 先行: カラーウェイの親 ProductColorway と、資材×カラーウェイの調達カラー BomItemColorway を新設。
-- 既存テーブルは一切変更しない（CREATE TABLE 2本のみ・非破壊）。
-- colorId は B-063 で Color マスターへ配線予定の予約列（本 PR では未使用）。
-- 仕様: docs/specs/product-overview-one-page-spec-confirmation-v0_4-2026-06-15.md

-- CreateTable
CREATE TABLE "product_colorways" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "colorway_code" VARCHAR(50) NOT NULL,
    "colorway_name" VARCHAR(100) NOT NULL,
    "color_id" TEXT,
    "color_hex" VARCHAR(7),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "product_colorways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_item_colorways" (
    "id" TEXT NOT NULL,
    "bom_item_id" TEXT NOT NULL,
    "product_colorway_id" TEXT NOT NULL,
    "supplier_color_code" VARCHAR(100) NOT NULL,
    "supplier_color_name" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bom_item_colorways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_colorways_product_id_colorway_code_key" ON "product_colorways"("product_id", "colorway_code");

-- CreateIndex
CREATE INDEX "product_colorways_company_id_product_id_idx" ON "product_colorways"("company_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_item_colorways_bom_item_id_product_colorway_id_key" ON "bom_item_colorways"("bom_item_id", "product_colorway_id");

-- CreateIndex
CREATE INDEX "bom_item_colorways_product_colorway_id_idx" ON "bom_item_colorways"("product_colorway_id");

-- AddForeignKey
ALTER TABLE "product_colorways" ADD CONSTRAINT "product_colorways_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_item_colorways" ADD CONSTRAINT "bom_item_colorways_bom_item_id_fkey" FOREIGN KEY ("bom_item_id") REFERENCES "bom_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_item_colorways" ADD CONSTRAINT "bom_item_colorways_product_colorway_id_fkey" FOREIGN KEY ("product_colorway_id") REFERENCES "product_colorways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
