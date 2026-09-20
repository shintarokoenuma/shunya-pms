-- B-054 PR-1: 型番にパターンNO（型紙そのものに振った番号・例 16sy-082）、作業発注に職出し予定日を追加。
-- 非破壊: ADD COLUMN のみ（nullable・DEFAULT なし）。DROP / NOT NULL は書かない。
-- 根拠: claude/b-054-b-146-spec-confirmation-v1_0-2026-09-20.md D-13 / D-17
-- 手本: 20260908000000_b170_product_colorway_client_color_name（手書き・ADD COLUMN のみ）
ALTER TABLE "model_codes" ADD COLUMN "pattern_number" VARCHAR(50);
ALTER TABLE "work_orders" ADD COLUMN "planned_start_date" DATE;
