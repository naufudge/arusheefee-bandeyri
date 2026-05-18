-- CreateEnum
CREATE TYPE "PVStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'PENDING_AUTHORISATION_ONE', 'PENDING_AUTHORISATION_TWO', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalEventKind" AS ENUM ('SENT_FOR_VERIFICATION', 'CALLED_BACK', 'VERIFIED', 'AUTHORISED_ONE', 'AUTHORISED_TWO', 'REJECTED', 'PC_ROLE_APPROVED', 'PC_ROLE_REJECTED', 'PC_ROLE_RESET_ON_EDIT');

-- AlterTable
ALTER TABLE "petty_cash_staff" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionComment" TEXT;

-- AlterTable
ALTER TABLE "pvs" ADD COLUMN     "authorisedByOneAt" TIMESTAMP(3),
ADD COLUMN     "authorisedByTwoAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectionComment" TEXT,
ADD COLUMN     "status" "PVStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "approval_events" (
    "id" TEXT NOT NULL,
    "kind" "ApprovalEventKind" NOT NULL,
    "pvId" TEXT,
    "pettyCashId" TEXT,
    "pettyCashRole" TEXT,
    "actorId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_events_pvId_createdAt_idx" ON "approval_events"("pvId", "createdAt");

-- CreateIndex
CREATE INDEX "approval_events_pettyCashId_createdAt_idx" ON "approval_events"("pettyCashId", "createdAt");

-- CreateIndex
CREATE INDEX "pvs_status_idx" ON "pvs"("status");

-- AddForeignKey
ALTER TABLE "pvs" ADD CONSTRAINT "pvs_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_pvId_fkey" FOREIGN KEY ("pvId") REFERENCES "pvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_pettyCashId_fkey" FOREIGN KEY ("pettyCashId") REFERENCES "petty_cash"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every pre-existing PV is treated as historical-complete.
-- These rows already have their signatory FKs populated and were treated
-- as final. APPROVED + non-null `*At` columns make the PDF renderer pull
-- in any available signatures for those historical records.
UPDATE "pvs" SET
  "status" = 'APPROVED',
  "verifiedAt" = "updatedAt",
  "authorisedByOneAt" = "updatedAt",
  "authorisedByTwoAt" = CASE WHEN "authorisedByTwoId" IS NOT NULL THEN "updatedAt" ELSE NULL END;
