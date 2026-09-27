-- B-205 PR-1: 自社情報をテナントごとに DB に持つ（spec v1.0 D-2・D-21）
-- 非破壊: nullable の ADD COLUMN のみ。既存行は NULL のまま（本番 companies 1行・invoices 0行・2026-09-27 実測）
ALTER TABLE "companies" ADD COLUMN "fax" VARCHAR(50);
ALTER TABLE "companies" ADD COLUMN "bank_account" JSONB;
ALTER TABLE "invoices" ADD COLUMN "issuer_fax" VARCHAR(50);
