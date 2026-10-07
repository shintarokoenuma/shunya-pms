-- B-269 D-6: 量産発注の生成で作られた既存の作業発注に、合計数量（total_quantity）を埋める。UPDATE のみ（DDL なし）。
-- 対象: title が「量産発注（PE-」で始まり・total_quantity が NULL・明細が1行以上・明細の数量がすべて同じ・
--       明細の色とサイズがすべて空（NULL か空文字）。入れる値はその共通の数量。削除済み（deleted_at あり）も同じ条件で埋める。
-- 条件に合わない作業発注（数量がそろっていないもの・手入力のもの）には触らない。
-- 表・列名: work_orders(title, total_quantity) / wo_items(wo_id, quantity, color_code, size) — schema.prisma の @@map / @map どおり
UPDATE "work_orders" w
SET "total_quantity" = s.q
FROM (
  SELECT "wo_id", MIN("quantity") AS q
  FROM "wo_items"
  GROUP BY "wo_id"
  HAVING COUNT(*) >= 1
    AND MIN("quantity") = MAX("quantity")
    AND BOOL_AND(COALESCE("color_code", '') = '' AND COALESCE("size", '') = '')
) s
WHERE s."wo_id" = w."id"
  AND w."total_quantity" IS NULL
  AND w."title" LIKE '量産発注（PE-%';
