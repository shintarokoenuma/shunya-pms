-- S-4b-2: WoItem の金額をサンプル起点で未定可にする（制約緩和のみ・データ実害なし）
-- 量産（WorkOrderCategory=PRODUCTION）の金額必須化は後続スコープ。
ALTER TABLE "wo_items" ALTER COLUMN "unit_price" DROP NOT NULL,
ALTER COLUMN "subtotal" DROP NOT NULL;
