-- CreateEnum
CREATE TYPE "ProgressTaskType" AS ENUM ('QUOTE', 'SPEC_LOCK', 'PATTERN', 'FABRIC', 'TRIM', 'SEWING', 'PROCESSING', 'INSPECTION', 'CLIENT_REVIEW', 'GRADING', 'SHIPPING', 'DELIVERY', 'INVOICE');

-- CreateEnum
CREATE TYPE "ProgressTaskPhase" AS ENUM ('SAMPLE', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "ProgressTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ProgressTaskEvidenceMode" AS ENUM ('MANUAL', 'AUTO_FROM_DOC');

-- CreateEnum
CREATE TYPE "ProgressTaskAssigneeType" AS ENUM ('INTERNAL', 'FACTORY', 'SUPPLIER', 'CONTRACTOR');

-- CreateTable
CREATE TABLE "progress_tasks" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sample_production_id" TEXT,
    "task_type" "ProgressTaskType" NOT NULL,
    "phase" "ProgressTaskPhase" NOT NULL DEFAULT 'SAMPLE',
    "status" "ProgressTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "evidence_mode" "ProgressTaskEvidenceMode" NOT NULL DEFAULT 'MANUAL',
    "processing_type_id" TEXT,
    "is_received" BOOLEAN,
    "assignee_type" "ProgressTaskAssigneeType",
    "assignee_id" TEXT,
    "checked_by_user_id" TEXT,
    "checked_by_external" TEXT,
    "checked_at" TIMESTAMP(3),
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "progress_tasks_company_id_product_id_idx" ON "progress_tasks"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "progress_tasks_company_id_sample_production_id_idx" ON "progress_tasks"("company_id", "sample_production_id");

-- CreateIndex
CREATE INDEX "progress_tasks_company_id_task_type_idx" ON "progress_tasks"("company_id", "task_type");

-- CreateIndex
CREATE INDEX "progress_tasks_company_id_status_idx" ON "progress_tasks"("company_id", "status");

-- CreateIndex
CREATE INDEX "progress_tasks_processing_type_id_idx" ON "progress_tasks"("processing_type_id");
