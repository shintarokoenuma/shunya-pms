-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "address_line2" VARCHAR(255),
ADD COLUMN     "billing_address" TEXT,
ADD COLUMN     "billing_address_line2" VARCHAR(255),
ADD COLUMN     "billing_city" VARCHAR(100),
ADD COLUMN     "billing_postal_code" VARCHAR(20),
ADD COLUMN     "billing_prefecture" VARCHAR(50),
ADD COLUMN     "shipping_address" TEXT,
ADD COLUMN     "shipping_address_line2" VARCHAR(255),
ADD COLUMN     "shipping_city" VARCHAR(100),
ADD COLUMN     "shipping_postal_code" VARCHAR(20),
ADD COLUMN     "shipping_prefecture" VARCHAR(50);
