// Price evaluation (އަގުބަލާ ފޯމް) — shared by the form, the server, the
// detail page and the PDF so every place computes totals the same way.

/** The form always compares exactly three vendors. */
export const VENDOR_COUNT = 3;

/** Evaluation numbers are "YYYY-N", e.g. "2026-35". */
export const EVAL_NUM_FORMAT = /^(\d{4})-(\d+)$/;

/** Default evaluation method: quotation. */
export const DEFAULT_METHOD = "ކޯޓޭޝަން";

/** The four signatories, in signing order. */
export const PE_ROLES = [
  {
    key: "preparedBy",
    en: "Prepared by",
    dv: "މަޢުލޫމާތު ސާފުކޮށް ތައްޔާރުކުރީ",
  },
  { key: "budgetCheckedBy", en: "Budget checked by", dv: "ބަޖެޓު ޗެކްކޮށްދިނީ" },
  { key: "checkedBy", en: "Checked by", dv: "ޗެކްކުރި" },
  { key: "approvedBy", en: "Approved by", dv: "ހަރަދު ކުރުމުގެ ހުއްދަ ދެއްވި" },
] as const;

export type PeRole = (typeof PE_ROLES)[number]["key"];

/** Which signatory acts at each pending stage. */
export const STAGE_ROLE = {
  PENDING_BUDGET_CHECK: "budgetCheckedBy",
  PENDING_CHECK: "checkedBy",
  PENDING_APPROVAL: "approvedBy",
} as const satisfies Record<string, PeRole>;

export type PendingStatus = keyof typeof STAGE_ROLE;

export const isPendingStatus = (status: string): status is PendingStatus =>
  status in STAGE_ROLE;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CompareVendor {
  exchangeRate: number;
  chargesGst: boolean;
  /** Discount on the subtotal, %; null/undefined = none. */
  discountPercent?: number | null;
}

export interface CompareItem {
  qty: number;
  /** Unit price per vendor position, in that vendor's currency; null = not quoted. */
  rates: (number | null | undefined)[];
}

export interface VendorTotals {
  /** MVR line total per item; null where the vendor didn't quote it. */
  lines: (number | null)[];
  subtotal: number;
  /** Taken off the subtotal before GST. */
  discount: number;
  gst: number;
  total: number;
  /** Quoted at least one item. */
  quotedAny: boolean;
  /** Quoted every item — only these compete for "lowest". */
  quotedAll: boolean;
}

export interface Comparison {
  vendors: VendorTotals[];
  /** Per item, the cheapest MVR line total (null when fewer than two vendors quoted it). */
  cheapestLine: (number | null)[];
  /** Position of the lowest total among vendors that quoted everything. */
  lowest: number | null;
  /** Position of the highest such total. */
  highest: number | null;
}

/** Unit price converted to MVR, rounded to laari (as the paper form does). */
export const unitMvr = (rate: number, exchangeRate: number) =>
  round2(rate * exchangeRate);

/**
 * Line totals, subtotals, discount, GST and totals in MVR for each vendor,
 * plus which vendor is cheapest per item and overall. A vendor's discount
 * comes off its subtotal first; GST is then charged on what's left.
 * `gstRate` and discounts are percentages.
 */
export function computeComparison(
  items: CompareItem[],
  vendors: CompareVendor[],
  gstRate: number,
): Comparison {
  const totals: VendorTotals[] = vendors.map((vendor, v) => {
    const lines = items.map((item) => {
      const rate = item.rates[v];
      if (rate == null || !Number.isFinite(rate)) return null;
      return round2(item.qty * unitMvr(rate, vendor.exchangeRate || 0));
    });
    const quoted = lines.filter((l): l is number => l !== null);
    const subtotal = round2(quoted.reduce((s, l) => s + l, 0));
    const pct = vendor.discountPercent ?? 0;
    const discount = pct > 0 ? round2((subtotal * pct) / 100) : 0;
    const net = round2(subtotal - discount);
    const gst = vendor.chargesGst ? round2((net * gstRate) / 100) : 0;
    return {
      lines,
      subtotal,
      discount,
      gst,
      total: round2(net + gst),
      quotedAny: quoted.length > 0,
      quotedAll: items.length > 0 && quoted.length === items.length,
    };
  });

  const cheapestLine = items.map((_, i) => {
    const quoted = totals
      .map((t) => t.lines[i])
      .filter((l): l is number => l !== null);
    return quoted.length >= 2 ? Math.min(...quoted) : null;
  });

  let lowest: number | null = null;
  let highest: number | null = null;
  totals.forEach((t, v) => {
    if (!t.quotedAll) return;
    if (lowest === null || t.total < totals[lowest].total) lowest = v;
    if (highest === null || t.total > totals[highest].total) highest = v;
  });

  return { vendors: totals, cheapestLine, lowest, highest };
}

/**
 * An item's quotes laid out by vendor position (null = not quoted), as
 * `computeComparison` expects them.
 */
export function ratesByPosition(
  vendors: { id: string; position: number }[],
  quotes: { vendorId: string; rate: number }[],
): (number | null)[] {
  const positionOf = new Map(vendors.map((v) => [v.id, v.position]));
  const rates: (number | null)[] = vendors.map(() => null);
  for (const q of quotes) {
    const v = positionOf.get(q.vendorId);
    if (v !== undefined) rates[v] = q.rate;
  }
  return rates;
}

/**
 * The form's standard reason sentence: "Of the prices received from N
 * parties, the lowest was sent by {vendor}."
 */
export const suggestReason = (vendorCount: number, vendorName: string) =>
  `${vendorCount} ފަރާތުން ލިބިފައިވާ އަގުތަކުގެ ތެރެއިން އެންމެ ކުޑަ އަގު ފޮނުވާފައިވާ ފަރާތަކީ ${vendorName} ކަމަށް ވުމުންނެވެ.`;

/** Next "YYYY-N" number for `year`, given the numbers already used. */
export function nextEvalNum(year: number, existing: string[]): string {
  let max = 0;
  for (const num of existing) {
    const m = EVAL_NUM_FORMAT.exec(num.trim());
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  }
  return `${year}-${max + 1}`;
}

/** True when the text contains Thaana, so it should render RTL in Faruma. */
export const isDhivehi = (text: string) => /[ހ-޿]/.test(text);
