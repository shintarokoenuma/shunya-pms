-- QE-0d (B-058): PO→BOM コスト引き当て。
-- コスト軸の出所 enum と、引き当て元 PO 参照を BomItem に追加（ADD のみ・非破壊）。
-- 参照は PoItem.id でなく PurchaseOrder.id（PO 編集で PoItem が再作成され id が変わる非対称性のため・仕様 v1.1 §2-1）。
-- usage_per_unit / unit_price は QE-0a で既に nullable のため本migrationでは触れない。

-- CreateEnum
CREATE TYPE "CostSource" AS ENUM ('MANUAL', 'PURCHASE_ORDER');

-- AlterTable
ALTER TABLE "bom_items" ADD COLUMN "cost_source" "CostSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "bom_items" ADD COLUMN "purchase_order_id" TEXT;
