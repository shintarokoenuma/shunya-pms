-- B-109 PR-2c: 繰越型の合計請求書（D-24・D-29）。請求の期間・前回御請求額・御入金額・繰越金額と、再発行の元（修正インボイス）。
-- 非破壊: ADD COLUMN と CREATE INDEX のみ。既存データの書き換えなし。
--   期間の2列は NOT NULL（この migration 以前に invoices の行は存在しない・2026-09-23 dev 実測 0 件）。
--   期間は導出ではなく保存する（発行済みの期間が締め日の設定変更や手直しで後からズレないように）。
-- ★端数処理の列は Invoice に持たない（D-35: クライアントの設定で計算し、税額を確定値として保存する）。
ALTER TABLE "invoices" ADD COLUMN     "period_start_date" DATE NOT NULL,
ADD COLUMN     "period_end_date" DATE NOT NULL,
ADD COLUMN     "carried_forward_amount" DECIMAL(15,2),
ADD COLUMN     "payment_received_amount" DECIMAL(15,2),
ADD COLUMN     "previous_balance_amount" DECIMAL(15,2),
ADD COLUMN     "replaces_invoice_id" TEXT;

CREATE INDEX "invoices_replaces_invoice_id_idx" ON "invoices"("replaces_invoice_id");
