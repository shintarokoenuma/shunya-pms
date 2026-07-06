-- QE-1R 道A: 手打ちレイヤーを「総額」から「1枚単価＋初期費用項目」へ転換（純増2列・非破壊）。
-- finalPriceManualJpy（総額手打ち）は残置（DROP しない）。後日クリーンアップ migration に送る。

-- RoughEstimate: 手打ち1枚単価（金額の正）。null なら自動参考単価にフォールバック。
ALTER TABLE "rough_estimates" ADD COLUMN "final_unit_price_manual_jpy" DECIMAL(15,2);

-- RoughEstimateItem: 初期費用行の手打ち提示額（INITIAL_COST 行のみ UI 露出・他費目は常に null）。
ALTER TABLE "rough_estimate_items" ADD COLUMN "presented_price_manual_jpy" DECIMAL(15,2);
