#!/usr/bin/env node
/**
 * GL accounts — preflight & verification for the GL account migrations:
 *   *_add_gl_accounts   creates and seeds gl_accounts, links existing PV GL
 *                       lines and petty cash to it by code
 *   *_gl_account_id     gives gl_accounts its own id; PV GL lines and petty
 *                       cash then point at that id and no longer copy the code
 *
 * READ-ONLY. Never writes to the database. The linking itself is done by the
 * migrations, which `prisma migrate deploy` applies like any other schema
 * change. This script tells you what they will do to a given database, and
 * then proves they did it.
 *
 * Production runbook:
 *   1. node scripts/gl-accounts.mjs        → preflight (before the migration)
 *   2. deploy the code, then: npx prisma migrate deploy
 *   3. node scripts/gl-accounts.mjs        → verification (after)
 *   4. users sign out and back in to pick up the new GL permissions
 *
 * Inside the Docker container:  docker exec <app> node scripts/gl-accounts.mjs
 *
 * Reads DATABASE_URL from the environment (or .env). Exits non-zero when the
 * post-migration verification fails.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import pg from "pg";

const GL_PERMISSIONS = [
  "glaccount:read",
  "glaccount:create",
  "glaccount:update",
  "glaccount:delete",
];

const chart = JSON.parse(
  readFileSync(new URL("../prisma/data/gl-accounts-2024.json", import.meta.url), "utf8"),
);
const chartByCode = new Map(chart.accounts.map((a) => [a.code, a]));
const pettyCashCodes = new Set(chart.pettyCashCodes);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const hostOf = (url) => {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
};

async function usage() {
  const { rows } = await client.query(`
    SELECT code, sum(gl)::int AS "pvLines", sum(pc)::int AS "pettyCash"
    FROM (
      SELECT "code" AS code, 1 AS gl, 0 AS pc FROM "gl_details"
      UNION ALL
      SELECT "glCode", 0, 1 FROM "petty_cash"
    ) u
    GROUP BY code
    ORDER BY code`);
  return rows.map((r) => ({ ...r, code: Number(r.code) }));
}

async function preflight() {
  console.log("PHASE: preflight — gl_accounts does not exist yet; nothing has been migrated.\n");
  const used = await usage();
  const unknown = used.filter((u) => !chartByCode.has(u.code));
  const pcOutside = used.filter((u) => u.pettyCash > 0 && !pettyCashCodes.has(u.code));

  console.log(`Chart to seed: ${chart.accounts.length} accounts, ${pettyCashCodes.size} petty-cash-allowed.`);
  console.log(`GL codes in use: ${used.length}\n`);
  console.log("  code     PV lines  petty cash  in chart  petty cash code  name");
  for (const u of used) {
    const a = chartByCode.get(u.code);
    console.log(
      `  ${String(u.code).padEnd(8)} ${String(u.pvLines).padStart(8)}  ${String(u.pettyCash).padStart(10)}  ${(a ? "yes" : "NO").padEnd(8)}  ${(pettyCashCodes.has(u.code) ? "yes" : "-").padEnd(15)}  ${a ? a.longTextEn : ""}`,
    );
  }

  console.log("");
  if (unknown.length === 0) {
    console.log("✓ Every code in use is in the chart — the migration creates no placeholder accounts.");
  } else {
    console.log(`! ${unknown.length} code(s) in use are NOT in the chart. The migration will create a`);
    console.log(`  placeholder account ("Unlisted code") for each, so linking still succeeds:`);
    for (const u of unknown) console.log(`    ${u.code}  (${u.pvLines} PV lines, ${u.pettyCash} petty cash)`);
    console.log("  Review and rename them in Settings → GL Accounts after deploying.");
  }
  if (pcOutside.length > 0) {
    console.log(`\nNote: ${pcOutside.length} code(s) used by existing petty cash aren't on the petty cash list.`);
    console.log("  Those records stay valid and editable; new petty cash can't pick these codes unless");
    console.log("  they're ticked in Settings → GL Accounts:");
    for (const u of pcOutside) console.log(`    ${u.code}  (${u.pettyCash} petty cash)`);
  }
  console.log("\nNext: deploy the code, run `npx prisma migrate deploy`, then run this script again.");
  return true;
}

async function verify() {
  console.log("PHASE: verification — gl_accounts exists.\n");
  const checks = [];
  const check = (ok, label, detail = "") => {
    checks.push(ok);
    console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  };

  const { rows: [counts] } = await client.query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE "pettyCashAllowed")::int AS "pettyCash"
    FROM "gl_accounts"`);
  const { rows: placeholders } = await client.query(
    `SELECT code FROM "gl_accounts" WHERE "shortTextEn" = 'Unlisted code' ORDER BY code`,
  );
  const { rows: admin } = await client.query(
    `SELECT permissions FROM "roles" WHERE name = 'Administrator'`,
  );
  const { rows: missingChart } = await client.query(
    `SELECT unnest($1::int[]) AS code EXCEPT SELECT code FROM "gl_accounts"`,
    [chart.accounts.map((a) => a.code)],
  );
  // Layout after *_gl_account_id: the code lives only on gl_accounts.
  const { rows: columns } = await client.query(`
    SELECT table_name || '.' || column_name AS col FROM information_schema.columns
    WHERE table_schema = 'public' AND (
      (table_name = 'gl_accounts' AND column_name IN ('id', 'code')) OR
      (table_name IN ('gl_details', 'petty_cash') AND column_name IN ('code', 'glCode', 'glAccountId')))`);
  const has = new Set(columns.map((r) => r.col));
  const { rows: keys } = await client.query(`
    SELECT conname FROM pg_constraint
    WHERE conname IN ('gl_accounts_pkey', 'gl_details_glAccountId_fkey', 'petty_cash_glAccountId_fkey')
    UNION ALL
    SELECT indexname FROM pg_indexes WHERE indexname = 'gl_accounts_code_key'`);
  const keyNames = new Set(keys.map((r) => r.conname));
  const { rows: pk } = await client.query(`
    SELECT a.attname AS col FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = 'public.gl_accounts'::regclass AND i.indisprimary`);

  check(
    missingChart.length === 0,
    "All chart accounts present",
    `${counts.total} accounts in total, ${chart.accounts.length} expected from the chart` +
      (missingChart.length ? `; MISSING: ${missingChart.map((r) => r.code).join(", ")}` : ""),
  );
  check(counts.pettyCash > 0, "Petty-cash-allowed accounts", `${counts.pettyCash} (seeded ${pettyCashCodes.size})`);

  const idLayout = has.has("gl_details.glAccountId") && has.has("petty_cash.glAccountId");
  check(
    pk.length === 1 && pk[0].col === "id" && keyNames.has("gl_accounts_code_key"),
    "GL accounts keyed by id, code unique",
    pk.length ? `primary key: ${pk.map((r) => r.col).join(", ")}` : "no primary key",
  );
  if (idLayout) {
    const { rows: [unlinked] } = await client.query(`
      SELECT
        (SELECT count(*) FROM "gl_details" d WHERE NOT EXISTS (SELECT 1 FROM "gl_accounts" a WHERE a.id = d."glAccountId"))::int AS "pvLines",
        (SELECT count(*) FROM "petty_cash" p WHERE NOT EXISTS (SELECT 1 FROM "gl_accounts" a WHERE a.id = p."glAccountId"))::int AS "pettyCash"`);
    check(unlinked.pvLines === 0, "Every PV GL line is linked", `${unlinked.pvLines} unlinked`);
    check(unlinked.pettyCash === 0, "Every petty cash record is linked", `${unlinked.pettyCash} unlinked`);
  } else {
    check(false, "PV GL lines and petty cash linked by account id", "glAccountId columns missing — has *_gl_account_id been applied?");
  }
  const leftovers = ["gl_details.code", "petty_cash.glCode"].filter((c) => has.has(c));
  check(leftovers.length === 0, "GL code stored only on gl_accounts", leftovers.length ? `still present: ${leftovers.join(", ")}` : "no copies");
  const fkNames = ["gl_details_glAccountId_fkey", "petty_cash_glAccountId_fkey"].filter((k) => keyNames.has(k));
  check(fkNames.length === 2, "Foreign keys in place", fkNames.join(", ") || "none found");
  if (admin.length === 0) {
    check(false, "Administrator role has the GL permissions", "no 'Administrator' role found");
  } else {
    const missing = GL_PERMISSIONS.filter((p) => !admin[0].permissions.includes(p));
    check(missing.length === 0, "Administrator role has the GL permissions", missing.length ? `missing ${missing.join(", ")}` : "all 4");
  }

  if (placeholders.length > 0) {
    console.log(`\n  ! ${placeholders.length} placeholder account(s) to review in Settings → GL Accounts:`);
    console.log(`    ${placeholders.map((r) => r.code).join(", ")}`);
  }

  const ok = checks.every(Boolean);
  console.log(`\n${ok ? "PASS" : "FAIL"} — ${checks.filter(Boolean).length}/${checks.length} checks passed.`);
  if (ok) console.log("Users must sign out and back in to pick up the GL permissions.");
  return ok;
}

try {
  await client.connect();
  console.log(`Database: ${hostOf(process.env.DATABASE_URL)}\n`);
  const { rows: [{ exists }] } = await client.query(
    `SELECT to_regclass('public.gl_accounts') IS NOT NULL AS exists`,
  );
  const ok = exists ? await verify() : await preflight();
  process.exitCode = ok ? 0 : 1;
} catch (err) {
  console.error("Error:", err.message);
  process.exitCode = 2;
} finally {
  await client.end().catch(() => {});
}
