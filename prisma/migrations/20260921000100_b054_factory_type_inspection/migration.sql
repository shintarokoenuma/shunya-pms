-- B-054 PR-1: 工場タイプに「検品（検品所）」を追加（D-19）。
-- ★ALTER TYPE ... ADD VALUE は同一トランザクション内で他の文と併用できないため、この1文だけを単独ファイルにする。
-- 非破壊: enum 値の追加のみ。
ALTER TYPE "FactoryType" ADD VALUE 'INSPECTION';
