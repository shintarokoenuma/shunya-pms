-- B-211 PR-1: 材料に「輸出用の規格」(export_spec) と参考 URL (reference_urls) を持たせる
-- 非破壊: materials に NULL 可の JSONB 列を 2 本足すだけ。既存の行・列・制約には触れない
-- 生成: npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script（dev・2026-10-10）
-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "export_spec" JSONB,
ADD COLUMN     "reference_urls" JSONB;
