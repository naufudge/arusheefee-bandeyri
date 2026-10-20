-- CreateEnum
CREATE TYPE "CeaStatus" AS ENUM ('DRAFT', 'SIGNED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalEventKind" ADD VALUE 'CEA_SIGNED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'CEA_REOPENED';

-- AlterTable
ALTER TABLE "approval_events" ADD COLUMN     "capitalExpenditureId" TEXT;

-- CreateTable
CREATE TABLE "capital_expenditures" (
    "id" TEXT NOT NULL,
    "ceaNum" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "businessArea" TEXT NOT NULL,
    "section" TEXT,
    "glAccountId" INTEGER,
    "budgetBalance" DOUBLE PRECISION,
    "feNameEn" TEXT,
    "feNameDv" TEXT,
    "feDesignationEn" TEXT,
    "feDesignationDv" TEXT,
    "requestedById" TEXT,
    "status" "CeaStatus" NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMP(3),
    "procurementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capital_expenditures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cea_items" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT,
    "qty" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "onHand" TEXT,
    "acquired" TEXT,
    "condition" TEXT,
    "reason" TEXT,
    "ceaId" TEXT NOT NULL,

    CONSTRAINT "cea_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "capital_expenditures_ceaNum_key" ON "capital_expenditures"("ceaNum");

-- CreateIndex
CREATE UNIQUE INDEX "capital_expenditures_procurementId_key" ON "capital_expenditures"("procurementId");

-- CreateIndex
CREATE INDEX "capital_expenditures_status_idx" ON "capital_expenditures"("status");

-- CreateIndex
CREATE INDEX "capital_expenditures_glAccountId_idx" ON "capital_expenditures"("glAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "cea_items_ceaId_position_key" ON "cea_items"("ceaId", "position");

-- CreateIndex
CREATE INDEX "approval_events_capitalExpenditureId_createdAt_idx" ON "approval_events"("capitalExpenditureId", "createdAt");

-- AddForeignKey
ALTER TABLE "capital_expenditures" ADD CONSTRAINT "capital_expenditures_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_expenditures" ADD CONSTRAINT "capital_expenditures_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_expenditures" ADD CONSTRAINT "capital_expenditures_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "procurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cea_items" ADD CONSTRAINT "cea_items_ceaId_fkey" FOREIGN KEY ("ceaId") REFERENCES "capital_expenditures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_capitalExpenditureId_fkey" FOREIGN KEY ("capitalExpenditureId") REFERENCES "capital_expenditures"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Financial Executive printed on CEA forms, managed in Settings → General.
INSERT INTO "app_settings" ("key", "value", "updatedAt") VALUES
  ('cea_fe_name_en', '', CURRENT_TIMESTAMP),
  ('cea_fe_name_dv', '', CURRENT_TIMESTAMP),
  ('cea_fe_designation_en', '', CURRENT_TIMESTAMP),
  ('cea_fe_designation_dv', '', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Give the Administrator role the new permissions (skipping any it already
-- has). Users pick them up after signing out and back in.
UPDATE "roles"
SET "permissions" = "permissions" || ARRAY(
      SELECT p FROM unnest(ARRAY[
        'cea:read', 'cea:create', 'cea:update', 'cea:delete', 'cea:edit_locked'
      ]::text[]) AS p
      WHERE NOT (p = ANY ("roles"."permissions"))
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Administrator';
