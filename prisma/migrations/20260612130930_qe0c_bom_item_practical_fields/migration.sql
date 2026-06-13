-- QE-0c: BomItem 実務4カラム（PoItem v1.1/v1.2 と命名・構造統一）
-- 非破壊: ADD COLUMN×4（全て nullable）。
ALTER TABLE "bom_items"
  ADD COLUMN "supplier_item_code" VARCHAR(100),
  ADD COLUMN "design_code"        VARCHAR(100),
  ADD COLUMN "size_value"         DECIMAL(15,4),
  ADD COLUMN "size_unit"          VARCHAR(10);
