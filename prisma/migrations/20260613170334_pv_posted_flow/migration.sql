-- AlterEnum
ALTER TYPE "ApprovalEventKind" ADD VALUE 'POSTED';

-- AlterEnum
ALTER TYPE "PVStatus" ADD VALUE 'POSTED';

-- AlterTable
ALTER TABLE "pvs" ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "postedById" TEXT;

-- AddForeignKey
ALTER TABLE "pvs" ADD CONSTRAINT "pvs_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
