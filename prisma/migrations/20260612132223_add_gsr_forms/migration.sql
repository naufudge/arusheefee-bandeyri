-- CreateEnum
CREATE TYPE "GSRStatus" AS ENUM ('DRAFT', 'PENDING_AUTHORIZATION', 'PENDING_RECEIPT', 'COMPLETED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalEventKind" ADD VALUE 'GSR_SENT_FOR_AUTHORIZATION';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'GSR_AUTHORIZED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'GSR_RECEIVED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'GSR_CALLED_BACK';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'GSR_REJECTED';

-- AlterTable
ALTER TABLE "approval_events" ADD COLUMN     "gsrFormId" TEXT;

-- CreateTable
CREATE TABLE "gsr_forms" (
    "id" TEXT NOT NULL,
    "gsrFormNum" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "requestedById" TEXT,
    "authorizedById" TEXT,
    "receivedById" TEXT,
    "status" "GSRStatus" NOT NULL DEFAULT 'DRAFT',
    "authorizedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gsr_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gsr_items" (
    "id" TEXT NOT NULL,
    "particulars" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "issuedQty" INTEGER,
    "rqdDate" TIMESTAMP(3),
    "remarks" TEXT,
    "gsrFormId" TEXT NOT NULL,

    CONSTRAINT "gsr_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gsr_forms_gsrFormNum_key" ON "gsr_forms"("gsrFormNum");

-- CreateIndex
CREATE INDEX "gsr_forms_status_idx" ON "gsr_forms"("status");

-- CreateIndex
CREATE INDEX "approval_events_gsrFormId_createdAt_idx" ON "approval_events"("gsrFormId", "createdAt");

-- AddForeignKey
ALTER TABLE "gsr_forms" ADD CONSTRAINT "gsr_forms_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsr_forms" ADD CONSTRAINT "gsr_forms_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsr_forms" ADD CONSTRAINT "gsr_forms_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsr_forms" ADD CONSTRAINT "gsr_forms_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsr_items" ADD CONSTRAINT "gsr_items_gsrFormId_fkey" FOREIGN KEY ("gsrFormId") REFERENCES "gsr_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_gsrFormId_fkey" FOREIGN KEY ("gsrFormId") REFERENCES "gsr_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
