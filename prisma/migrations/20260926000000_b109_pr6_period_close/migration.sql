-- B-109 PR-6（B-123）: 締め＝取引先×期間のロック。非破壊（ADD TABLE＋enum）。
-- CreateEnum
CREATE TYPE "PeriodCloseStatus" AS ENUM ('CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "period_closes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "counterpart_type" "CounterpartType" NOT NULL,
    "counterpart_id" TEXT NOT NULL,
    "period_start_date" DATE NOT NULL,
    "period_end_date" DATE NOT NULL,
    "status" "PeriodCloseStatus" NOT NULL DEFAULT 'CLOSED',
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by_user_id" TEXT NOT NULL,
    "close_warnings" JSONB,
    "reopened_at" TIMESTAMP(3),
    "reopened_by_user_id" TEXT,
    "reopen_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "period_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "period_closes_company_id_counterpart_type_counterpart_id_pe_idx" ON "period_closes"("company_id", "counterpart_type", "counterpart_id", "period_end_date");

-- CreateIndex
CREATE INDEX "period_closes_company_id_period_end_date_idx" ON "period_closes"("company_id", "period_end_date");

