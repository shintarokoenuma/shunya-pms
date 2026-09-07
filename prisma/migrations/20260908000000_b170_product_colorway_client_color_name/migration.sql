-- B-170: ProductColorway に先方色名 client_color_name を追加（保持と表示）。
-- 非破壊: ADD COLUMN のみ。DROP / NOT NULL / DEFAULT は書かない。
-- 対象は product_colorways のみ。skus（clientSkuCode）には触れない（コメントのみの変更）。
-- 前例: 20260819000000_b167_b168_so_item_yield（手書き・ADD COLUMN / DROP NOT NULL のみ）。
-- 根拠: docs/specs/b-170-client-name-mapping-spec-confirmation-v1_0-2026-09-07.md §5-1
ALTER TABLE "product_colorways" ADD COLUMN "client_color_name" VARCHAR(100);
