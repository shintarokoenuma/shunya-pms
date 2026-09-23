-- B-109 PR-2c: 繰越型の合計請求書（D-24・D-29）。前回御請求額・御入金額・繰越金額と、再発行の元（修正インボイス）。
-- 非破壊: ADD COLUMN（すべて nullable）と CREATE INDEX のみ。既存データの書き換えなし。
-- ★端数処理の列は Invoice に持たない（D-35: クライアントの設定で計算し、税額を確定値として保存する）。
ALTER TABLE "invoices" ADD COLUMN     "carried_forward_amount" DECIMAL(15,2),
ADD COLUMN     "payment_received_amount" DECIMAL(15,2),
ADD COLUMN     "previous_balance_amount" DECIMAL(15,2),
ADD COLUMN     "replaces_invoice_id" TEXT;

CREATE INDEX "invoices_replaces_invoice_id_idx" ON "invoices"("replaces_invoice_id");
