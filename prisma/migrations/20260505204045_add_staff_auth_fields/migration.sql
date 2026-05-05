-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "email" TEXT,
    "azureOid" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'legacy',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pvs" (
    "id" TEXT NOT NULL,
    "pvNum" TEXT NOT NULL,
    "businessArea" INTEGER NOT NULL DEFAULT 1506,
    "agency" TEXT NOT NULL DEFAULT 'National Archives of Maldives',
    "vendor" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MVR',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "poNum" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "parkedDate" TIMESTAMP(3),
    "postingDate" TIMESTAMP(3),
    "transferNum" TEXT,
    "clearingDocNum" TEXT,
    "clearingDocDate" TIMESTAMP(3),
    "preparedById" TEXT,
    "verifiedById" TEXT,
    "authorisedByOneId" TEXT,
    "authorisedByTwoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pvs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "comments" TEXT NOT NULL,
    "documentNum" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "invoiceTotal" DOUBLE PRECISION NOT NULL,
    "pvId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gl_details" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "fund" TEXT NOT NULL DEFAULT 'C-GOM',
    "amount" DOUBLE PRECISION NOT NULL,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "gl_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_azureOid_key" ON "staff"("azureOid");

-- CreateIndex
CREATE UNIQUE INDEX "pvs_pvNum_key" ON "pvs"("pvNum");

-- AddForeignKey
ALTER TABLE "pvs" ADD CONSTRAINT "pvs_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pvs" ADD CONSTRAINT "pvs_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pvs" ADD CONSTRAINT "pvs_authorisedByOneId_fkey" FOREIGN KEY ("authorisedByOneId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pvs" ADD CONSTRAINT "pvs_authorisedByTwoId_fkey" FOREIGN KEY ("authorisedByTwoId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pvId_fkey" FOREIGN KEY ("pvId") REFERENCES "pvs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gl_details" ADD CONSTRAINT "gl_details_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
