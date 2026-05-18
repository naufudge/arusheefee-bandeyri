-- CreateTable
CREATE TABLE "pv_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "values" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pv_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pv_templates_name_key" ON "pv_templates"("name");

-- AddForeignKey
ALTER TABLE "pv_templates" ADD CONSTRAINT "pv_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
