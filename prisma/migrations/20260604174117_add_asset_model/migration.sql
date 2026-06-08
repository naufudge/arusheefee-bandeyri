-- CreateEnum
CREATE TYPE "AssetDatePrecision" AS ENUM ('YEAR', 'FULL');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "assetNum" TEXT NOT NULL,
    "SAPassetNum" TEXT,
    "assetName" TEXT NOT NULL,
    "modelNum" TEXT,
    "manufacturerId" TEXT,
    "classification" TEXT,
    "previousLocation" TEXT,
    "presentLocation" TEXT,
    "date" TIMESTAMP(3),
    "datePrecision" "AssetDatePrecision" NOT NULL DEFAULT 'YEAR',
    "price" DOUBLE PRECISION,
    "condition" TEXT,
    "category" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_assetNum_key" ON "assets"("assetNum");

-- CreateIndex
CREATE INDEX "assets_assetType_idx" ON "assets"("assetType");

-- CreateIndex
CREATE INDEX "assets_category_idx" ON "assets"("category");
