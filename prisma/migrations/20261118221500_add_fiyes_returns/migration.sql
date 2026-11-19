-- CreateEnum
CREATE TYPE "FiyesStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FiyesReturnKind" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "ApprovalEventKind" ADD VALUE 'FIYES_SENT';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'FIYES_CALLED_BACK';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'FIYES_APPROVED';
ALTER TYPE "ApprovalEventKind" ADD VALUE 'FIYES_REJECTED';

-- AlterTable
ALTER TABLE "approval_events" ADD COLUMN     "fiyesReturnId" TEXT;

-- CreateTable
CREATE TABLE "fiyes_returns" (
    "id" TEXT NOT NULL,
    "kind" "FiyesReturnKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "period" TEXT NOT NULL,
    "documentDate" TIMESTAMP(3) NOT NULL,
    "pettyCashOpening" DOUBLE PRECISION,
    "pettyCashClosing" DOUBLE PRECISION,
    "entries" JSONB NOT NULL DEFAULT '{}',
    "enteredById" TEXT,
    "approvedById" TEXT,
    "status" "FiyesStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiyes_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiyes_payables" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorAccount" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MVR',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountMvr" DOUBLE PRECISION NOT NULL,
    "fiyesReturnId" TEXT NOT NULL,

    CONSTRAINT "fiyes_payables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiyes_returns_period_key" ON "fiyes_returns"("period");

-- CreateIndex
CREATE INDEX "fiyes_returns_status_idx" ON "fiyes_returns"("status");

-- CreateIndex
CREATE INDEX "fiyes_returns_year_idx" ON "fiyes_returns"("year");

-- CreateIndex
CREATE UNIQUE INDEX "fiyes_payables_fiyesReturnId_position_key" ON "fiyes_payables"("fiyesReturnId", "position");

-- CreateIndex
CREATE INDEX "approval_events_fiyesReturnId_createdAt_idx" ON "approval_events"("fiyesReturnId", "createdAt");

-- AddForeignKey
ALTER TABLE "fiyes_returns" ADD CONSTRAINT "fiyes_returns_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiyes_returns" ADD CONSTRAINT "fiyes_returns_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiyes_returns" ADD CONSTRAINT "fiyes_returns_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiyes_payables" ADD CONSTRAINT "fiyes_payables_fiyesReturnId_fkey" FOREIGN KEY ("fiyesReturnId") REFERENCES "fiyes_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_fiyesReturnId_fkey" FOREIGN KEY ("fiyesReturnId") REFERENCES "fiyes_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A monthly return has a month and a yearly one doesn't, so a return can't
-- be both or neither. (IS NOT NULL is explicit: a NULL comparison would
-- make the check unknown, which Postgres lets through.)
ALTER TABLE "fiyes_returns" ADD CONSTRAINT "fiyes_returns_kind_month_check"
  CHECK (("kind" = 'MONTHLY' AND "month" IS NOT NULL AND "month" BETWEEN 1 AND 12) OR ("kind" = 'YEARLY' AND "month" IS NULL));

-- Give the Administrator role the new permissions (skipping any it already
-- has). Users pick them up after signing out and back in.
UPDATE "roles"
SET "permissions" = "permissions" || ARRAY(
      SELECT p FROM unnest(ARRAY[
        'fiyes:read', 'fiyes:create', 'fiyes:update', 'fiyes:delete', 'fiyes:edit_locked'
      ]::text[]) AS p
      WHERE NOT (p = ANY ("roles"."permissions"))
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Administrator';
