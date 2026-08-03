-- B-101: 量産進行タスク用に ProgressTaskType へ 3 値を追加（裁断/仕上げ/梱包）。
-- 非破壊: 既存値・既存行に一切触れない（enum への値追加のみ）。
-- spec §8: 同一 tx 内で新値を「使う」DML は含めない（ADD VALUE のみ）。PG18.4 は複数値追加を単一 migration で許容。
ALTER TYPE "ProgressTaskType" ADD VALUE 'CUTTING';
ALTER TYPE "ProgressTaskType" ADD VALUE 'FINISHING';
ALTER TYPE "ProgressTaskType" ADD VALUE 'PACKING';
