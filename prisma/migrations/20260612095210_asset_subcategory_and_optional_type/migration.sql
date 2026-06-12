-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "subcategory" TEXT,
ALTER COLUMN "assetType" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "assets_subcategory_idx" ON "assets"("subcategory");
