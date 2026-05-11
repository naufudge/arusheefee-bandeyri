-- CreateTable
CREATE TABLE "petty_cash" (
    "id" TEXT NOT NULL,
    "pettyCashNum" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "formNum" TEXT NOT NULL,
    "sectionUnit" TEXT NOT NULL,
    "totalRequiredAmount" DOUBLE PRECISION NOT NULL,
    "glCode" INTEGER NOT NULL,
    "parkedDate" TIMESTAMP(3),
    "postingDate" TIMESTAMP(3),
    "handledById" TEXT,
    "procurementApprovedById" TEXT,
    "budgetCheckedById" TEXT,
    "balanceHandedOverById" TEXT,
    "balanceCollectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petty_cash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_staff" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petty_cash_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_items" (
    "id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "pettyCashId" TEXT NOT NULL,

    CONSTRAINT "petty_cash_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_pettyCashNum_key" ON "petty_cash"("pettyCashNum");

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_handledById_key" ON "petty_cash"("handledById");

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_procurementApprovedById_key" ON "petty_cash"("procurementApprovedById");

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_budgetCheckedById_key" ON "petty_cash"("budgetCheckedById");

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_balanceHandedOverById_key" ON "petty_cash"("balanceHandedOverById");

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_balanceCollectedById_key" ON "petty_cash"("balanceCollectedById");

-- AddForeignKey
ALTER TABLE "petty_cash" ADD CONSTRAINT "petty_cash_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "petty_cash_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash" ADD CONSTRAINT "petty_cash_procurementApprovedById_fkey" FOREIGN KEY ("procurementApprovedById") REFERENCES "petty_cash_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash" ADD CONSTRAINT "petty_cash_budgetCheckedById_fkey" FOREIGN KEY ("budgetCheckedById") REFERENCES "petty_cash_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash" ADD CONSTRAINT "petty_cash_balanceHandedOverById_fkey" FOREIGN KEY ("balanceHandedOverById") REFERENCES "petty_cash_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash" ADD CONSTRAINT "petty_cash_balanceCollectedById_fkey" FOREIGN KEY ("balanceCollectedById") REFERENCES "petty_cash_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_staff" ADD CONSTRAINT "petty_cash_staff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petty_cash_items" ADD CONSTRAINT "petty_cash_items_pettyCashId_fkey" FOREIGN KEY ("pettyCashId") REFERENCES "petty_cash"("id") ON DELETE CASCADE ON UPDATE CASCADE;
