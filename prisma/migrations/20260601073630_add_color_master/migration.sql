-- CreateTable
CREATE TABLE "colors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "color_number" VARCHAR(2) NOT NULL,
    "color_name" VARCHAR(100) NOT NULL,
    "hue_group" INTEGER NOT NULL,
    "tone_step" INTEGER NOT NULL,
    "cmyk" VARCHAR(20) NOT NULL,
    "hex" VARCHAR(7) NOT NULL,
    "impression" VARCHAR(100),
    "sort_order" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "colors_company_id_hue_group_idx" ON "colors"("company_id", "hue_group");

-- CreateIndex
CREATE UNIQUE INDEX "colors_company_id_color_number_key" ON "colors"("company_id", "color_number");
