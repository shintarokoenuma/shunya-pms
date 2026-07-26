-- B-083 / (B) 量産発注生成: 調達区分 ＋ カラーウェイ分割列（追加のみ・DROP なし）
-- 1. 調達区分 enum（全明細行共通の直交軸）
CREATE TYPE "ProcurementRoute" AS ENUM ('COMPANY_ARRANGED', 'CLIENT_SUPPLIED', 'STOCK_ALLOCATED');

-- 2. ProductionEstimateItem.procurementRoute（既定 COMPANY_ARRANGED・既存行は default で埋まる）
ALTER TABLE "production_estimate_items"
    ADD COLUMN "procurement_route" "ProcurementRoute" NOT NULL DEFAULT 'COMPANY_ARRANGED';

-- 3. PoItem.productColorwayId（scalar FK・nullable・(B) の色別分割用）＋ index
ALTER TABLE "po_items"
    ADD COLUMN "product_colorway_id" TEXT;
CREATE INDEX "po_items_product_colorway_id_idx" ON "po_items"("product_colorway_id");
