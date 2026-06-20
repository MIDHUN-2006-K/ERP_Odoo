-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('RAW_MATERIAL', 'COMPONENT', 'CONSUMABLE', 'FINISHED_GOOD');

-- AlterTable: drop the old text column and add the new enum column
ALTER TABLE "products" DROP COLUMN IF EXISTS "category";
ALTER TABLE "products" ADD COLUMN "category" "ProductCategory";
