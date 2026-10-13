-- AlterEnum
ALTER TYPE "ApprovalEventKind" ADD VALUE 'PC_NUMBER_CHANGED';

-- AlterTable
ALTER TABLE "petty_cash" ADD COLUMN     "previousNums" TEXT[] DEFAULT ARRAY[]::TEXT[];
