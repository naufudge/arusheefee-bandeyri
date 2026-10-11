-- CreateEnum
CREATE TYPE "AssetCreationStatus" AS ENUM ('DRAFT', 'PENDING_AUTHORIZATION', 'PENDING_SAP_UPDATE', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssetRequestType" AS ENUM ('CREATE', 'AMEND', 'DELETE', 'BLOCK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalEventKind" ADD VALUE 'AC_SENT';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'AC_AUTHORIZED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'AC_SAP_UPDATED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'AC_CALLED_BACK';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'AC_REJECTED';

-- AlterTable
ALTER TABLE "approval_events" ADD COLUMN     "assetCreationId" TEXT;

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "assetCreationFormId" TEXT;

-- AlterTable
ALTER TABLE "procurements" ADD COLUMN     "isAsset" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "idCardNo" TEXT;

-- CreateTable
CREATE TABLE "asset_creations" (
    "id" TEXT NOT NULL,
    "requestType" "AssetRequestType" NOT NULL DEFAULT 'CREATE',
    "agencyName" TEXT NOT NULL,
    "businessArea" TEXT NOT NULL,
    "costCentre" TEXT NOT NULL,
    "fund" TEXT NOT NULL,
    "functionalArea" TEXT NOT NULL,
    "description1" TEXT NOT NULL,
    "description2" TEXT,
    "useOfAsset" TEXT,
    "location" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "requestedAssetClass" TEXT NOT NULL,
    "assetClass" TEXT,
    "glAccountId" INTEGER NOT NULL,
    "vendor" TEXT,
    "manufacturer" TEXT,
    "purchasedNew" BOOLEAN NOT NULL DEFAULT true,
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionPrecision" "AssetDatePrecision" NOT NULL DEFAULT 'YEAR',
    "commenceDate" TIMESTAMP(3),
    "countryOfOrigin" TEXT,
    "brand" TEXT,
    "originalValue" DOUBLE PRECISION,
    "usefulLifeYears" INTEGER,
    "usefulLifeReason" TEXT,
    "registerCategory" TEXT,
    "registerSubcategory" TEXT,
    "registerAssetType" TEXT,
    "requestedById" TEXT,
    "authorizedById" TEXT,
    "sapUpdatedById" TEXT,
    "status" "AssetCreationStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "sapUpdatedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionComment" TEXT,
    "procurementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_creations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_creation_forms" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "formNum" TEXT NOT NULL,
    "sapAssetNum" TEXT,
    "assetCreationId" TEXT NOT NULL,

    CONSTRAINT "asset_creation_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asset_creations_status_idx" ON "asset_creations"("status");

-- CreateIndex
CREATE INDEX "asset_creations_glAccountId_idx" ON "asset_creations"("glAccountId");

-- CreateIndex
CREATE INDEX "asset_creations_procurementId_idx" ON "asset_creations"("procurementId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_creation_forms_formNum_key" ON "asset_creation_forms"("formNum");

-- CreateIndex
CREATE UNIQUE INDEX "asset_creation_forms_assetCreationId_position_key" ON "asset_creation_forms"("assetCreationId", "position");

-- CreateIndex
CREATE INDEX "approval_events_assetCreationId_createdAt_idx" ON "approval_events"("assetCreationId", "createdAt");

-- CreateIndex
CREATE INDEX "assets_assetCreationFormId_idx" ON "assets"("assetCreationFormId");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assetCreationFormId_fkey" FOREIGN KEY ("assetCreationFormId") REFERENCES "asset_creation_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_creations" ADD CONSTRAINT "asset_creations_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_creations" ADD CONSTRAINT "asset_creations_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_creations" ADD CONSTRAINT "asset_creations_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_creations" ADD CONSTRAINT "asset_creations_sapUpdatedById_fkey" FOREIGN KEY ("sapUpdatedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_creations" ADD CONSTRAINT "asset_creations_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_creations" ADD CONSTRAINT "asset_creations_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "procurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_creation_forms" ADD CONSTRAINT "asset_creation_forms_assetCreationId_fkey" FOREIGN KEY ("assetCreationId") REFERENCES "asset_creations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_assetCreationId_fkey" FOREIGN KEY ("assetCreationId") REFERENCES "asset_creations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Procurements that already have register entries are asset purchases.
UPDATE "procurements" p SET "isAsset" = true
WHERE EXISTS (SELECT 1 FROM "assets" a WHERE a."procurementId" = p."id");

-- SAP coding printed on asset creation forms, managed in Settings → General.
INSERT INTO "app_settings" ("key", "value", "updatedAt") VALUES
  ('asset_agency_name', 'National Archives', CURRENT_TIMESTAMP),
  ('asset_business_area', '1506', CURRENT_TIMESTAMP),
  ('asset_cost_centre', 'C15069999', CURRENT_TIMESTAMP),
  ('asset_fund', 'GOM', CURRENT_TIMESTAMP),
  ('asset_functional_area', 'S067005001001001', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Give the Administrator role the new permissions (skipping any it already
-- has). Users pick them up after signing out and back in.
UPDATE "roles"
SET "permissions" = "permissions" || ARRAY(
      SELECT p FROM unnest(ARRAY[
        'assetcreation:read', 'assetcreation:create', 'assetcreation:update',
        'assetcreation:delete', 'assetcreation:edit_locked'
      ]::text[]) AS p
      WHERE NOT (p = ANY ("roles"."permissions"))
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Administrator';
