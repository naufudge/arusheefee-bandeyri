-- CreateEnum
CREATE TYPE "PcReconStatus" AS ENUM ('DRAFT', 'PENDING_CHECK', 'PENDING_AUTHORIZATION', 'COMPLETED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalEventKind" ADD VALUE 'PCRECON_SENT_FOR_CHECK';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PCRECON_CHECKED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PCRECON_AUTHORIZED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PCRECON_CALLED_BACK';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PCRECON_REJECTED';

-- AlterTable
ALTER TABLE "approval_events" ADD COLUMN     "pcReconciliationId" TEXT;

-- AlterTable
ALTER TABLE "petty_cash_items" ADD COLUMN     "nameDhivehi" TEXT,
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "dhivehiDesignation" TEXT,
ADD COLUMN     "dhivehiName" TEXT;

-- CreateTable
CREATE TABLE "pc_reconciliations" (
    "id" TEXT NOT NULL,
    "reportNum" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "periodText" TEXT NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashInHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "redepositAcc1155" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "staffWages" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "foodAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heldInCheque" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashHeld" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chequeHeld" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preparedById" TEXT,
    "checkedById" TEXT,
    "authorizedById" TEXT,
    "status" "PcReconStatus" NOT NULL DEFAULT 'DRAFT',
    "checkedAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pc_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pc_reconciliation_items" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "details" TEXT NOT NULL,
    "detailsEn" TEXT,
    "withdrawn" DOUBLE PRECISION NOT NULL,
    "sourcePettyCashNum" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "reconciliationId" TEXT NOT NULL,

    CONSTRAINT "pc_reconciliation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pc_reconciliations_reportNum_key" ON "pc_reconciliations"("reportNum");

-- CreateIndex
CREATE INDEX "pc_reconciliations_status_idx" ON "pc_reconciliations"("status");

-- CreateIndex
CREATE INDEX "approval_events_pcReconciliationId_createdAt_idx" ON "approval_events"("pcReconciliationId", "createdAt");

-- AddForeignKey
ALTER TABLE "pc_reconciliations" ADD CONSTRAINT "pc_reconciliations_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pc_reconciliations" ADD CONSTRAINT "pc_reconciliations_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pc_reconciliations" ADD CONSTRAINT "pc_reconciliations_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pc_reconciliations" ADD CONSTRAINT "pc_reconciliations_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pc_reconciliation_items" ADD CONSTRAINT "pc_reconciliation_items_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "pc_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_pcReconciliationId_fkey" FOREIGN KEY ("pcReconciliationId") REFERENCES "pc_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
