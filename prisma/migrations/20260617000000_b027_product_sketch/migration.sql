-- B-027: 品番カルテ「絵型（服のスケッチ）」。
-- Product に絵型用の2カラムを追加（ADD COLUMN ×2・非破壊）。既存テーブル・データは変更しない。
-- sketch_images: 詳細用・全枚数の Json 配列 [{gcsPath, thumbGcsPath, caption?, sortOrder}]。
-- sketch_thumb_path: 一覧/進行表用に先頭サムネのパスを非正規化保持（0枚なら null）。
-- 仕様: docs/specs/b-027-product-sketch-spec-confirmation-v1_1-2026-06-16.md §3

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sketch_images" JSONB,
ADD COLUMN     "sketch_thumb_path" VARCHAR(500);
