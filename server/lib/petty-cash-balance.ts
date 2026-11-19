import type { PrismaClient } from "@prisma/client";
import { pvReceivedMvr } from "@/utils/currency";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type PettyCashBalance = {
  /** The year's stored opening balance (0 when none is set). */
  opening: number;
  openingSet: boolean;
  /** Top-up PVs since 1 January. */
  received: number;
  /** Petty cash paid out since 1 January. */
  paid: number;
  balance: number;
};

/**
 * The petty cash float just before `until`, counted exactly as the register
 * export's running balance (app/api/petty-cash/export/[year]): the year's
 * opening balance, plus top-up PVs, minus petty cash paid, by each record's
 * `date` from 1 January of `year`.
 */
export async function pettyCashBalance(
  db: PrismaClient,
  year: number,
  until: Date,
): Promise<PettyCashBalance> {
  const range = { gte: new Date(Date.UTC(year, 0, 1)), lt: until };
  const [openingRow, paid, topUps] = await Promise.all([
    db.pettyCashOpeningBalance.findUnique({ where: { year } }),
    db.pettyCash.aggregate({ where: { date: range }, _sum: { totalRequiredAmount: true } }),
    db.pV.findMany({
      where: { isPettyCashReimbursement: true, date: range },
      select: { exchangeRate: true, invoices: { select: { invoiceTotal: true } } },
    }),
  ]);
  const opening = openingRow?.amount ?? 0;
  const received = round2(topUps.reduce((sum, pv) => sum + pvReceivedMvr(pv), 0));
  const paidOut = round2(paid._sum.totalRequiredAmount ?? 0);
  return {
    opening,
    openingSet: openingRow !== null,
    received,
    paid: paidOut,
    balance: round2(opening + received - paidOut),
  };
}

/**
 * F01's two figures: as at the 1st (before that day's records) and as at the
 * last day of the month (after them). December's closing still counts within
 * its own year.
 */
export async function monthPettyCash(db: PrismaClient, year: number, month: number) {
  const [opening, closing] = await Promise.all([
    pettyCashBalance(db, year, new Date(Date.UTC(year, month - 1, 1))),
    pettyCashBalance(db, year, new Date(Date.UTC(year, month, 1))),
  ]);
  return { opening, closing };
}
