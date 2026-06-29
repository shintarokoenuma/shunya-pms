-- B-063: Color に英語色名 colorNameEn を追加（輸出下げ札・貿易書類向け）。
-- nullable・既存51色 NULL・後埋め。Zh/Vi は実需確定まで作らない。
-- 根拠: v0.4 §0 決定4改訂2 ＋ 本セッション方針。

-- AlterTable
ALTER TABLE "colors" ADD COLUMN     "color_name_en" VARCHAR(100);
