-- QE-0c 仕様簡素化: MarkingRecord を「着用尺の根拠台帳」に。
-- 換算(÷着数÷100)を撤去し、着用尺は直接入力。total_units/total_length は CAD 連携(B-047/B-056)用に温存し nullable 化。
-- ※ RENAME で値を保持（master-patterns §14: DROP+ADD は使わない）。SET NOT NULL は 0件確認のうえ実施。
ALTER TABLE "marking_records"
  ALTER COLUMN "total_units"  DROP NOT NULL,
  ALTER COLUMN "total_length" DROP NOT NULL;

ALTER TABLE "marking_records" RENAME COLUMN "usage_per_unit_derived" TO "usage_per_unit";

ALTER TABLE "marking_records" ALTER COLUMN "usage_per_unit" SET NOT NULL;

-- QE-0c 追加: 巻きメーター数（このロットの実規格・任意）。QE-1 取り切り計算で使用。
ALTER TABLE "marking_records" ADD COLUMN "roll_length" DECIMAL(10,1);
