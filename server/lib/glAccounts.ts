import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";

// Works with both the client and a transaction client.
type Db = Pick<PrismaClient, "glAccount">;

// Forms, imports and saved templates all identify GL accounts by their
// government code; records store the account's id. These helpers translate.

/**
 * Account ids for the given GL codes, keyed by code. Codes that aren't in
 * the chart of accounts are simply absent — for callers that report unknown
 * codes rather than throw (e.g. import previews).
 */
export async function glAccountIdsByCode(db: Db, codes: number[]): Promise<Map<number, number>> {
  const unique = [...new Set(codes)];
  if (unique.length === 0) return new Map();
  const found = await db.glAccount.findMany({
    where: { code: { in: unique } },
    select: { id: true, code: true },
  });
  return new Map(found.map((a) => [a.code, a.id]));
}

export function unknownGlCodesMessage(unknown: number[]): string {
  return unknown.length === 1
    ? `GL code ${unknown[0]} is not in the chart of accounts.`
    : `GL codes ${unknown.join(", ")} are not in the chart of accounts.`;
}

/**
 * Like `glAccountIdsByCode`, but throws a friendly BAD_REQUEST if any code
 * isn't a GL account, so every code in `codes` has an id in the result.
 */
export async function resolveGlAccountIds(db: Db, codes: number[]): Promise<Map<number, number>> {
  const ids = await glAccountIdsByCode(db, codes);
  const unknown = [...new Set(codes)].filter((c) => !ids.has(c));
  if (unknown.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: unknownGlCodesMessage(unknown) });
  }
  return ids;
}

/**
 * The account id for `code`. Throws unless it's a GL account that petty
 * cash may be charged to.
 */
export async function resolvePettyCashGlAccount(db: Db, code: number): Promise<number> {
  const account = await db.glAccount.findUnique({
    where: { code },
    select: { id: true, pettyCashAllowed: true },
  });
  if (!account) {
    throw new TRPCError({ code: "BAD_REQUEST", message: unknownGlCodesMessage([code]) });
  }
  if (!account.pettyCashAllowed) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `GL code ${code} isn't enabled for petty cash. It can be enabled in Settings → GL Accounts.`,
    });
  }
  return account.id;
}
