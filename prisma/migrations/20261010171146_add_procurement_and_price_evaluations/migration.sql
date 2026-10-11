-- Procurement & price evaluation.
--
-- Price evaluation (އަގުބަލާ ފޯމް): evaluations, their three vendors (each with
-- its own currency, GST on by default, and an optional discount %), items and
-- per-vendor quotes; approval-timeline hooks; and a key/value app_settings
-- table seeded with the global GST rate.
--
-- Procurements: a parent record grouping one purchase's documents. GSR forms,
-- price evaluations (one each per procurement), PVs and assets (any number)
-- link to it through a nullable procurementId; deleting a procurement unlinks
-- them (SET NULL) rather than deleting them.

-- CreateEnum
CREATE TYPE "PriceEvalStatus" AS ENUM ('DRAFT', 'PENDING_BUDGET_CHECK', 'PENDING_CHECK', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalEventKind" ADD VALUE 'PE_SENT';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PE_BUDGET_CHECKED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PE_CHECKED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PE_APPROVED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PE_CALLED_BACK';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PE_REJECTED';

-- AlterTable
ALTER TABLE "approval_events" ADD COLUMN     "priceEvaluationId" TEXT;

-- CreateTable
CREATE TABLE "price_evaluations" (
    "id" TEXT NOT NULL,
    "evalNum" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "section" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "glAccountId" INTEGER NOT NULL,
    "budgetBalance" DOUBLE PRECISION,
    "budgetAvailable" BOOLEAN,
    "gstRate" DOUBLE PRECISION NOT NULL,
    "selectedVendor" INTEGER,
    "selectionReason" TEXT,
    "preparedById" TEXT,
    "budgetCheckedById" TEXT,
    "checkedById" TEXT,
    "approvedById" TEXT,
    "status" "PriceEvalStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "budgetCheckedAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_eval_vendors" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MVR',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "chargesGst" BOOLEAN NOT NULL DEFAULT true,
    "discountPercent" DOUBLE PRECISION,
    "evaluationId" TEXT NOT NULL,

    CONSTRAINT "price_eval_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_eval_items" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "evaluationId" TEXT NOT NULL,

    CONSTRAINT "price_eval_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_eval_quotes" (
    "id" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "itemId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "price_eval_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_evaluations_evalNum_key" ON "price_evaluations"("evalNum");

-- CreateIndex
CREATE INDEX "price_evaluations_status_idx" ON "price_evaluations"("status");

-- CreateIndex
CREATE INDEX "price_evaluations_glAccountId_idx" ON "price_evaluations"("glAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "price_eval_vendors_evaluationId_position_key" ON "price_eval_vendors"("evaluationId", "position");

-- CreateIndex
CREATE INDEX "price_eval_items_evaluationId_idx" ON "price_eval_items"("evaluationId");

-- CreateIndex
CREATE INDEX "price_eval_quotes_vendorId_idx" ON "price_eval_quotes"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "price_eval_quotes_itemId_vendorId_key" ON "price_eval_quotes"("itemId", "vendorId");

-- CreateIndex
CREATE INDEX "approval_events_priceEvaluationId_createdAt_idx" ON "approval_events"("priceEvaluationId", "createdAt");

-- AddForeignKey
ALTER TABLE "price_evaluations" ADD CONSTRAINT "price_evaluations_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_evaluations" ADD CONSTRAINT "price_evaluations_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_evaluations" ADD CONSTRAINT "price_evaluations_budgetCheckedById_fkey" FOREIGN KEY ("budgetCheckedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_evaluations" ADD CONSTRAINT "price_evaluations_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_evaluations" ADD CONSTRAINT "price_evaluations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_evaluations" ADD CONSTRAINT "price_evaluations_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_eval_vendors" ADD CONSTRAINT "price_eval_vendors_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "price_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_eval_items" ADD CONSTRAINT "price_eval_items_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "price_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_eval_quotes" ADD CONSTRAINT "price_eval_quotes_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "price_eval_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_eval_quotes" ADD CONSTRAINT "price_eval_quotes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "price_eval_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_priceEvaluationId_fkey" FOREIGN KEY ("priceEvaluationId") REFERENCES "price_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ----- Procurements -----
-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "procurementId" TEXT;

-- AlterTable
ALTER TABLE "gsr_forms" ADD COLUMN     "procurementId" TEXT;

-- AlterTable
ALTER TABLE "price_evaluations" ADD COLUMN     "procurementId" TEXT;

-- AlterTable
ALTER TABLE "pvs" ADD COLUMN     "procurementId" TEXT;

-- CreateTable
CREATE TABLE "procurements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_procurementId_idx" ON "assets"("procurementId");

-- CreateIndex
CREATE UNIQUE INDEX "gsr_forms_procurementId_key" ON "gsr_forms"("procurementId");

-- CreateIndex
CREATE UNIQUE INDEX "price_evaluations_procurementId_key" ON "price_evaluations"("procurementId");

-- CreateIndex
CREATE INDEX "pvs_procurementId_idx" ON "pvs"("procurementId");

-- AddForeignKey
ALTER TABLE "pvs" ADD CONSTRAINT "pvs_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "procurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsr_forms" ADD CONSTRAINT "gsr_forms_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "procurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_evaluations" ADD CONSTRAINT "price_evaluations_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "procurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "procurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Global GST rate (%), managed in Settings → General.
INSERT INTO "app_settings" ("key", "value", "updatedAt") VALUES ('gst_rate', '8', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Give the Administrator role the new permissions (skipping any it already
-- has). Users pick them up after signing out and back in.
UPDATE "roles"
SET "permissions" = "permissions" || ARRAY(
      SELECT p FROM unnest(ARRAY[
        'priceeval:read', 'priceeval:create', 'priceeval:update',
        'priceeval:delete', 'priceeval:edit_locked', 'settings:manage',
        'procurement:read', 'procurement:create', 'procurement:update',
        'procurement:delete'
      ]::text[]) AS p
      WHERE NOT (p = ANY ("roles"."permissions"))
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Administrator';
