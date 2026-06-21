-- SKU 設計 PR1: Sku に colorwayId（ProductColorway 参照）を追加。
-- SKU = カラーウェイ × サイズ。既存 colorCode 等の文字列列は後方互換で残す（非破壊）。
-- skus は dev/本番とも0件のため NOT NULL ADD は安全。
-- 仕様: docs/specs/sku-design-spec-confirmation-v1_0-2026-06-21.md

-- AlterTable
ALTER TABLE "skus" ADD COLUMN     "colorway_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "skus_colorway_id_idx" ON "skus"("colorway_id");

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_colorway_id_fkey" FOREIGN KEY ("colorway_id") REFERENCES "product_colorways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
