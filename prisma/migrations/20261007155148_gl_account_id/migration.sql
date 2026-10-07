-- GL accounts get their own id, so the GL code lives only on gl_accounts.
-- PV GL lines (gl_details.code) and petty cash records (petty_cash.glCode)
-- stop storing a copy of the code and point at the account's id instead.
--
-- Data-preserving: every existing row is relinked to the same account it
-- referenced by code before the code columns are dropped. Ids are numbered
-- in code order.

-- 1. Release the code-based links.
ALTER TABLE "gl_details" DROP CONSTRAINT "gl_details_code_fkey";
ALTER TABLE "petty_cash" DROP CONSTRAINT "petty_cash_glCode_fkey";

-- 2. New surrogate primary key on gl_accounts; code stays unique.
ALTER TABLE "gl_accounts" ADD COLUMN "id" SERIAL NOT NULL;

UPDATE "gl_accounts" a
SET "id" = n.rn
FROM (SELECT "code", row_number() OVER (ORDER BY "code")::int AS rn FROM "gl_accounts") n
WHERE a."code" = n."code";

SELECT setval(pg_get_serial_sequence('"gl_accounts"', 'id'), COALESCE((SELECT MAX("id") FROM "gl_accounts"), 0) + 1, false);

ALTER TABLE "gl_accounts" DROP CONSTRAINT "gl_accounts_pkey",
ADD CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "gl_accounts_code_key" ON "gl_accounts"("code");

-- 3. Link GL lines and petty cash to the account id, by their current code.
ALTER TABLE "gl_details" ADD COLUMN "glAccountId" INTEGER;
UPDATE "gl_details" g SET "glAccountId" = a."id" FROM "gl_accounts" a WHERE a."code" = g."code";

ALTER TABLE "petty_cash" ADD COLUMN "glAccountId" INTEGER;
UPDATE "petty_cash" p SET "glAccountId" = a."id" FROM "gl_accounts" a WHERE a."code" = p."glCode";

-- 4. Every row matched (the dropped foreign keys guaranteed it); NOT NULL
--    makes any surprise fail the migration loudly instead of losing a link.
ALTER TABLE "gl_details" ALTER COLUMN "glAccountId" SET NOT NULL;
ALTER TABLE "petty_cash" ALTER COLUMN "glAccountId" SET NOT NULL;

-- 5. Drop the copied code columns (their indexes go with them).
DROP INDEX "gl_details_code_idx";
DROP INDEX "petty_cash_glCode_idx";
ALTER TABLE "gl_details" DROP COLUMN "code";
ALTER TABLE "petty_cash" DROP COLUMN "glCode";

-- 6. New indexes and foreign keys.
CREATE INDEX "gl_details_glAccountId_idx" ON "gl_details"("glAccountId");
CREATE INDEX "petty_cash_glAccountId_idx" ON "petty_cash"("glAccountId");

ALTER TABLE "gl_details" ADD CONSTRAINT "gl_details_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "petty_cash" ADD CONSTRAINT "petty_cash_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "gl_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
