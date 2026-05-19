/*
  Warnings:

  - You are about to drop the column `payment_days` on the `clients` table. All the data in the column will be lost.
  - You are about to drop the column `payment_days` on the `contractors` table. All the data in the column will be lost.
  - You are about to drop the column `payment_days` on the `factories` table. All the data in the column will be lost.
  - You are about to drop the column `payment_days` on the `suppliers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "clients" DROP COLUMN "payment_days",
ADD COLUMN     "payment_day" INTEGER,
ADD COLUMN     "payment_month_offset" INTEGER;

-- AlterTable
ALTER TABLE "contractors" DROP COLUMN "payment_days",
ADD COLUMN     "payment_day" INTEGER,
ADD COLUMN     "payment_month_offset" INTEGER;

-- AlterTable
ALTER TABLE "factories" DROP COLUMN "payment_days",
ADD COLUMN     "payment_day" INTEGER,
ADD COLUMN     "payment_month_offset" INTEGER;

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "payment_days",
ADD COLUMN     "payment_day" INTEGER,
ADD COLUMN     "payment_month_offset" INTEGER;
