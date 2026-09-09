/**
 * Invoice totals and GL amounts are stored in the PV's DOCUMENT currency.
 * The MVR value is always `amount * exchangeRate` — MVR vouchers carry a rate
 * of 1, so the conversion is a no-op for them and callers never need to
 * branch on currency just to get a figure right.
 */
export const toMvr = (amount: number, exchangeRate: number) =>
  amount * exchangeRate;

/**
 * Rounded to cents. Use for values written into a spreadsheet, where the raw
 * float is stored rather than a formatted string — 12790.17 * 22.1749 is
 * 283620.7377…, which should reach the ERP as 283620.74.
 */
export const toMvrRounded = (amount: number, exchangeRate: number) =>
  Math.round(amount * exchangeRate * 100) / 100;

/** True when a PV is raised in something other than MVR. */
export const isForeignCurrency = (currency: string) =>
  currency.toLowerCase() !== "mvr";

/** A PV's gross total, in both its document currency and MVR. */
export function pvTotal(pv: {
  exchangeRate: number;
  invoices: { invoiceTotal: number }[];
}) {
  const doc = pv.invoices.reduce((sum, inv) => sum + inv.invoiceTotal, 0);
  return { doc, mvr: toMvr(doc, pv.exchangeRate) };
}
