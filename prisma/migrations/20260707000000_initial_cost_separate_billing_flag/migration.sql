-- QE-1R 初期費用再設計（別枠フラグ方式・spec v0.1）。
-- 第3の費目区分 INITIAL_COST を廃止し、行の性格（MATERIAL/LABOR）と計上先（別枠フラグ）を分離。
-- 純増1列＋既存 INITIAL_COST 行の決定的 UPDATE（冪等）。enum 値 INITIAL_COST は残置（破壊回避）。

-- 1. 別枠計上フラグ（防衛線の判定基準）を純増。
ALTER TABLE "rough_estimate_items" ADD COLUMN "is_separate_billing" BOOLEAN NOT NULL DEFAULT false;

-- 2. 既存 INITIAL_COST 行を LABOR＋フラグON へ変換（版代等の外注初期費用は LABOR へ寄せる）。
--    金額・手打ち提示額・costCategoryId は不変。冪等（再実行しても差分なし）。
UPDATE "rough_estimate_items"
SET "item_category" = 'LABOR', "is_separate_billing" = true
WHERE "item_category" = 'INITIAL_COST';
