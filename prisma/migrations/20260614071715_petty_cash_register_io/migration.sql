-- AlterTable
ALTER TABLE "pvs" ADD COLUMN     "isPettyCashReimbursement" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "petty_cash_opening_balances" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petty_cash_opening_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_opening_balances_year_key" ON "petty_cash_opening_balances"("year");
