-- B-066-③: ProductColorway に柄参照 pattern_id を追加（ADD COLUMN 1本・非破壊）。
-- TextilePattern.id への緩い参照（FK制約なし・@relation なし＝純 scalar・null=従来どおり単色カラーウェイ）。
-- 仕様: docs/specs/b-066-textile-pattern-master-spec-confirmation-v1_1-2026-06-17.md §6

-- AlterTable
ALTER TABLE "product_colorways" ADD COLUMN     "pattern_id" TEXT;
