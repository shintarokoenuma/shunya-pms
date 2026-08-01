-- B-094: 縫製指示（固定5項目＋縫製指示6項目）を Product に Json 1本で保持。
-- 非破壊: 既存行はすべて NULL で開始。既存データに一切触れない。
ALTER TABLE "products" ADD COLUMN "sewing_instructions" JSONB;
