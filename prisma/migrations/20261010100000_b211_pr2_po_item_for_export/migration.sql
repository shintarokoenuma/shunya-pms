-- B-211 PR-2: 発注明細（po_items）に「海外発送」の印 is_for_export を持たせる
-- 非破壊: DEFAULT false の NOT NULL 列を 1 本足すだけ。既存の行はすべて false（海外発送なし）になり、他の列・制約には触れない
-- 生成: npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script（dev・2026-10-10）
-- AlterTable
ALTER TABLE "po_items" ADD COLUMN     "is_for_export" BOOLEAN NOT NULL DEFAULT false;
