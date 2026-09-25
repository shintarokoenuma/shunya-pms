-- B-109 PR-3（P3-D1）: 納品書明細の行の種類（前受金）。null＝通常の行。非破壊（nullable ADD COLUMN＋enum）。
-- CreateEnum
CREATE TYPE "DeliveryLineKind" AS ENUM ('DEPOSIT', 'DEPOSIT_APPLIED');

-- AlterTable
ALTER TABLE "delivery_note_items" ADD COLUMN     "line_kind" "DeliveryLineKind";
