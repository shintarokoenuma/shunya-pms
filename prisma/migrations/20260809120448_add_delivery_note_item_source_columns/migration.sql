-- B-108 PR2a: DeliveryNoteItem に引き当て元5列を追加
-- additive-only / nullable / FK なし / backfill なし
-- 根拠: b-108-pr2-allocation-ui-spec-confirmation v1.1 §C-2

ALTER TABLE "delivery_note_items" ADD COLUMN "source_sample_production_id" TEXT;
ALTER TABLE "delivery_note_items" ADD COLUMN "source_wo_item_id" TEXT;
ALTER TABLE "delivery_note_items" ADD COLUMN "source_work_order_id" TEXT;
ALTER TABLE "delivery_note_items" ADD COLUMN "source_po_item_id" TEXT;
ALTER TABLE "delivery_note_items" ADD COLUMN "source_purchase_order_id" TEXT;

CREATE INDEX "delivery_note_items_source_sample_production_id_idx" ON "delivery_note_items"("source_sample_production_id");
CREATE INDEX "delivery_note_items_source_wo_item_id_idx" ON "delivery_note_items"("source_wo_item_id");
CREATE INDEX "delivery_note_items_source_work_order_id_idx" ON "delivery_note_items"("source_work_order_id");
CREATE INDEX "delivery_note_items_source_po_item_id_idx" ON "delivery_note_items"("source_po_item_id");
CREATE INDEX "delivery_note_items_source_purchase_order_id_idx" ON "delivery_note_items"("source_purchase_order_id");
