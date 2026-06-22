-- 実装②: シーズンのプルダウン化（§6 案1）。
-- Product.seasonType（enum SeasonType）を新設。season String / year Int は変更しない。
-- season は seasonType×year の合成キャッシュ（採番・検索・表示は引き続き season 文字列を使う）。
-- 既存行があるため seasonType は nullable で追加（後埋め移行は P3）。
-- 仕様: docs/category-code-spec-confirmation-v1_1-2026-06-22.md §6

-- CreateEnum
CREATE TYPE "SeasonType" AS ENUM ('SS', 'AW', 'SP', 'SU', 'FA', 'WI', 'SPOT');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "season_type" "SeasonType";
