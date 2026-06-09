-- 実装ブリーフ①: ProcessingType に大分類(workType=WorkOrderType)列を追加
-- 大分類=WorkOrderType enum(既存・追加なし) / 小分類=ProcessingType.name。
-- dev/本番とも processing_types 0件のため default なし NOT NULL を直接追加可。
-- AlterTable
ALTER TABLE "processing_types" ADD COLUMN     "work_type" "WorkOrderType" NOT NULL;

-- CreateIndex
CREATE INDEX "processing_types_company_id_work_type_idx" ON "processing_types"("company_id", "work_type");
