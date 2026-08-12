-- B-140: ProductionEstimateItem に行ごとの発注先3列を追加
-- 根拠: production-order-generation-spec-addendum-v0_1-2026-08-12.md §2-1（R-a を改訂）
-- 非破壊: ADD COLUMN + CREATE INDEX のみ。DROP なし・DML なし・backfill なし。
-- 既存行は3列とも NULL で入り、導出順2〜4（元伝票→primarySupplier→null）により挙動不変。

ALTER TABLE "production_estimate_items" ADD COLUMN "supplier_id" TEXT;
ALTER TABLE "production_estimate_items" ADD COLUMN "factory_id" TEXT;
ALTER TABLE "production_estimate_items" ADD COLUMN "contractor_id" TEXT;

CREATE INDEX "production_estimate_items_supplier_id_idx" ON "production_estimate_items"("supplier_id");
CREATE INDEX "production_estimate_items_factory_id_idx" ON "production_estimate_items"("factory_id");
CREATE INDEX "production_estimate_items_contractor_id_idx" ON "production_estimate_items"("contractor_id");
