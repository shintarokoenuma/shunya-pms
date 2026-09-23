-- B-109 PR-2a: クライアントごとの消費税端数処理（D-23・既定は D-36 で四捨五入に変更）。
-- 非破壊: CREATE TYPE と ADD COLUMN のみ。既存データの書き換えなし。
-- ALTER TYPE ... ADD VALUE ではないため、CREATE TYPE と ALTER TABLE を同一ファイルに置ける。
CREATE TYPE "TaxRoundingMode" AS ENUM ('TRUNCATE', 'ROUND_HALF_UP', 'CEILING');

ALTER TABLE "clients" ADD COLUMN "tax_rounding_mode" "TaxRoundingMode" NOT NULL DEFAULT 'ROUND_HALF_UP';
