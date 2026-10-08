-- B-212 PR-1（仕様確認書 v1.1 D-10・実装ブリーフ P1-D1）: 仕入先・工場・外注先から受け取った請求書の器。
-- 新しい表 3 つ（supplier_invoices / supplier_invoice_lines / supplier_invoice_match_rules）と enum 5 つの追加だけ。
-- 既存の表・列・enum には触れない（非破壊・ADD TABLE のみ）。外部キーは明細→ヘッダの 1 本（Cascade）。
-- 本文は npx prisma migrate diff --from-schema-datasource --to-schema-datamodel --script（dev・2026-10-08）の出力そのもの。
-- CreateEnum
CREATE TYPE "SupplierInvoicePostingType" AS ENUM ('COUNTED', 'REFERENCE');

-- CreateEnum
CREATE TYPE "SupplierInvoiceSource" AS ENUM ('B070_CSV', 'MANUAL');

-- CreateEnum
CREATE TYPE "SupplierInvoiceMatchStatus" AS ENUM ('MATCHED', 'RULE_PENDING', 'UNMATCHED', 'NO_PRODUCT');

-- CreateEnum
CREATE TYPE "SupplierInvoiceMatchSource" AS ENUM ('CLIENT_PRODUCT_CODE', 'PRODUCT_CODE', 'PATTERN_NUMBER', 'RULE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SupplierInvoiceRuleType" AS ENUM ('COUNTERPART', 'PRODUCT');

-- CreateTable
CREATE TABLE "supplier_invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "counterpart_type" "CounterpartType" NOT NULL,
    "counterpart_id" TEXT,
    "counterpart_name_raw" VARCHAR(255) NOT NULL,
    "counterpart_code_raw" VARCHAR(50),
    "counterpart_category_raw" VARCHAR(20),
    "registration_number" VARCHAR(20),
    "document_type" VARCHAR(50) NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "period_month" VARCHAR(7) NOT NULL,
    "issue_date" DATE,
    "closing_date" DATE,
    "due_date" DATE,
    "subtotal" DECIMAL(15,2),
    "tax_amount" DECIMAL(15,2),
    "total_amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "posting_type" "SupplierInvoicePostingType" NOT NULL,
    "paired_document_number" VARCHAR(100),
    "source" "SupplierInvoiceSource" NOT NULL DEFAULT 'B070_CSV',
    "import_batch_id" TEXT,
    "import_file_name" VARCHAR(255),
    "source_file_name" VARCHAR(255),
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_lines" (
    "id" TEXT NOT NULL,
    "supplier_invoice_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "slip_date" DATE,
    "slip_number" VARCHAR(100),
    "target_raw" VARCHAR(255),
    "item_code_raw" VARCHAR(100),
    "item_name" VARCHAR(255),
    "quantity" DECIMAL(15,4),
    "unit" VARCHAR(20),
    "unit_price" DECIMAL(15,4),
    "amount" DECIMAL(15,2) NOT NULL,
    "tax_category" VARCHAR(20),
    "product_id" TEXT,
    "match_status" "SupplierInvoiceMatchStatus" NOT NULL,
    "matched_by" "SupplierInvoiceMatchSource",
    "cost_category_id" TEXT,
    "package_count" INTEGER,
    "piece_count" INTEGER,
    "weight_kg" DECIMAL(10,3),
    "source_page" INTEGER,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_match_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "rule_type" "SupplierInvoiceRuleType" NOT NULL,
    "scope_counterpart_type" "CounterpartType",
    "scope_counterpart_id" TEXT,
    "source_key" VARCHAR(255) NOT NULL,
    "target_counterpart_type" "CounterpartType",
    "target_id" TEXT NOT NULL,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "supplier_invoice_match_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_invoices_company_id_period_month_idx" ON "supplier_invoices"("company_id", "period_month");

-- CreateIndex
CREATE INDEX "supplier_invoices_company_id_counterpart_type_counterpart_i_idx" ON "supplier_invoices"("company_id", "counterpart_type", "counterpart_id");

-- CreateIndex
CREATE INDEX "supplier_invoices_company_id_document_number_idx" ON "supplier_invoices"("company_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_company_id_invoice_number_key" ON "supplier_invoices"("company_id", "invoice_number");

-- CreateIndex
CREATE INDEX "supplier_invoice_lines_supplier_invoice_id_line_no_idx" ON "supplier_invoice_lines"("supplier_invoice_id", "line_no");

-- CreateIndex
CREATE INDEX "supplier_invoice_lines_product_id_idx" ON "supplier_invoice_lines"("product_id");

-- CreateIndex
CREATE INDEX "supplier_invoice_lines_cost_category_id_idx" ON "supplier_invoice_lines"("cost_category_id");

-- CreateIndex
CREATE INDEX "supplier_invoice_match_rules_company_id_rule_type_source_ke_idx" ON "supplier_invoice_match_rules"("company_id", "rule_type", "source_key");

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

