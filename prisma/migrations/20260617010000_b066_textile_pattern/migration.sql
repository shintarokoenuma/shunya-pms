-- B-066: 柄マスター 層2 TextilePattern を新設（CREATE TABLE 1本・非破壊）。
-- 自社の柄共通言語（D# = pattern_number "BD-A" 形式）。type_id は TextilePatternType への緩い参照（FK制約なし）。
-- 仕様: docs/specs/b-066-textile-pattern-master-spec-confirmation-v1_1-2026-06-17.md §5

-- CreateTable
CREATE TABLE "textile_patterns" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "pattern_number" VARCHAR(10) NOT NULL,
    "pattern_name" VARCHAR(100) NOT NULL,
    "type_id" TEXT,
    "sort_order" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "textile_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "textile_patterns_company_id_type_id_idx" ON "textile_patterns"("company_id", "type_id");

-- CreateIndex
CREATE UNIQUE INDEX "textile_patterns_company_id_pattern_number_key" ON "textile_patterns"("company_id", "pattern_number");
