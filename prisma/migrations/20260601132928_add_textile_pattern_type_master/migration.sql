-- CreateTable
CREATE TABLE "textile_pattern_types" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type_code" VARCHAR(10) NOT NULL,
    "type_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "textile_pattern_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "textile_pattern_types_company_id_type_code_key" ON "textile_pattern_types"("company_id", "type_code");
