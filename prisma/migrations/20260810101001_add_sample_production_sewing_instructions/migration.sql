-- B-130 PR-B1: SampleProduction にラウンド単位の縫製指示列を追加（案A）
-- 非破壊: ADD COLUMN のみ。既存行は NULL のまま（NULL = 未設定、UI 側で EMPTY にフォールバック）
ALTER TABLE "sample_productions" ADD COLUMN "sewing_instructions" JSONB;
