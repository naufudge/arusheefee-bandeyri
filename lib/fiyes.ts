// Fiyes: the Ministry of Finance portal National Archives files its monthly
// and yearly returns on. This is the one catalogue of forms; the server and
// pages both read it, so a form can only ever belong to one set.

export type FiyesKind = "MONTHLY" | "YEARLY";

// ----- What each form holds -----
// Every form can carry figures, including the ones usually filed as nil
// returns. With nothing entered, a form goes out exactly as its template.

/** How a row column is entered and written (see cellValue in server/lib/fiyes-workbook.ts). */
export type FiyesColumnType =
  | "ba" // always FIYES_BA; not entered
  | "text"
  | "code" // an account number or SAP code
  | "currency" // 3-letter code
  | "money"
  | "closing"; // opening + receipts − payments of the same row; not entered

export type FiyesColumn = {
  key: string;
  /** Data_Entry column; the approval sheet's table uses the same letters. */
  col: string;
  /** The template's header text, checked before filling. */
  header: string;
  type: FiyesColumnType;
  required?: boolean;
  hint?: string;
  /** A wider input on the return form. */
  wide?: boolean;
};

export type FiyesLine = {
  key: string;
  /** Data_Entry row. */
  row: number;
  /** The template's label, checked before filling. */
  label: string;
  /** The template's own key for the line (F03's "M3.01"). */
  ref?: string;
  /** F01 petty cash: calculated from the register and stored in its own columns. */
  calculated?: boolean;
};

export type FiyesAmount = {
  key: string;
  col: string;
  label: string;
  /** F01: labelled with the month's first or last day ("As at 01.10.2026"). */
  asAt?: "first" | "last";
};

export type FiyesLinesContent = {
  type: "lines";
  /** Where the template prints each line's label (and F03's key). */
  labelCol: string;
  refCol?: string;
  nonNegative?: boolean;
  amounts: readonly FiyesAmount[];
  lines: readonly FiyesLine[];
};

export type FiyesRowsContent = {
  type: "rows";
  noun: readonly [singular: string, plural: string];
  /** The MVR column totalled in summaries. */
  total?: string;
  /** Data_Entry rows the template's nil content fills; entered rows replace them. */
  data: { first: number; last: number };
  /** The Approval_Template table; it keeps at least this many rows. */
  approval: { first: number; last: number };
  columns: readonly FiyesColumn[];
};

export type FiyesContent =
  | FiyesLinesContent
  | FiyesRowsContent
  /** F19: invoices in FiyesPayable, converted to MVR at MMA's rate. */
  | { type: "payables" };

export type FiyesFormDef = {
  code: string;
  title: string;
  kind: FiyesKind;
  /** File under templates/fiyes/. */
  file: string;
  /**
   * The Approval_Template signature block: the columns holding Entered by and
   * Approved by, and the row with the "Entered by" label. The signature,
   * name, designation and date follow on the next four rows.
   */
  signature: { entered: string; approved: string; labelRow: number };
  content: FiyesContent;
};

// F04 and F05 share a layout.
const CONTINGENT_COLUMNS = [
  { key: "ba", col: "A", header: "BA", type: "ba" },
  { key: "description", col: "B", header: "Description", type: "text", required: true, wide: true },
  { key: "payment", col: "C", header: "Payment to be made", type: "text" },
  { key: "mvr", col: "D", header: "MVR", type: "money" },
] as const;

export const FIYES_FORMS = [
  {
    code: "F01",
    title: "F01 Cash on Hand",
    kind: "MONTHLY",
    file: "F01 Cash on Hand.xlsx",
    signature: { entered: "A", approved: "C", labelRow: 18 },
    content: {
      type: "lines",
      labelCol: "A",
      nonNegative: true,
      amounts: [
        { key: "opening", col: "C", label: "Opening", asAt: "first" },
        { key: "closing", col: "D", label: "Closing", asAt: "last" },
      ],
      lines: [
        { key: "pettyCash", row: 3, label: "Petty Cash", calculated: true },
        { key: "cashierFloat", row: 4, label: "Cashier Float" },
        { key: "revenueNotDeposited", row: 5, label: "Revenue Collected but not deposited to PBA" },
        { key: "depositsNotDeposited", row: 6, label: "Deposits Collected but not yet deposited to PBA" },
        { key: "cashAdvance", row: 7, label: "Cash Advance Money" },
        { key: "otherCash", row: 8, label: "Other Cash" },
      ],
    },
  },
  {
    code: "F03",
    title: "F03 Receivables",
    kind: "MONTHLY",
    file: "F03 Receivables.xlsx",
    signature: { entered: "A", approved: "C", labelRow: 14 },
    content: {
      type: "lines",
      labelCol: "B",
      refCol: "A",
      amounts: [{ key: "amount", col: "D", label: "Amount MVR" }],
      lines: [
        { key: "revenueTax", row: 3, ref: "M3.01", label: "Revenue Receivables- Tax" },
        { key: "revenueNonTax", row: 4, ref: "M3.02", label: "Revenue Receivables- Non-Tax" },
        { key: "deposits", row: 5, ref: "M3.03", label: "Deposits Receivables" },
        { key: "prepayments", row: 6, ref: "M3.04", label: "Prepayment Receivables" },
        { key: "other", row: 7, ref: "M3.05", label: "Other Receivables" },
        { key: "doubtfulDebts", row: 8, ref: "M3.06", label: "Provisions for Doubtful Debts" },
      ],
    },
  },
  {
    code: "F04",
    title: "F04 Contingent Assets",
    kind: "MONTHLY",
    file: "F04 Contingent Assets.xlsx",
    signature: { entered: "A", approved: "C", labelRow: 11 },
    content: {
      type: "rows",
      noun: ["contingent asset", "contingent assets"],
      total: "mvr",
      data: { first: 3, last: 3 },
      approval: { first: 8, last: 8 },
      columns: CONTINGENT_COLUMNS,
    },
  },
  {
    code: "F05",
    title: "F05 Contingent Liabilities",
    kind: "MONTHLY",
    file: "F05 Contingent Liabilities.xlsx",
    signature: { entered: "A", approved: "C", labelRow: 16 },
    content: {
      type: "rows",
      noun: ["contingent liability", "contingent liabilities"],
      total: "mvr",
      data: { first: 3, last: 8 },
      approval: { first: 9, last: 14 },
      columns: CONTINGENT_COLUMNS,
    },
  },
  {
    code: "F12",
    title: "F12 Bank Reconciliation Summary",
    kind: "MONTHLY",
    file: "F12 Bank Reconciliation Summary.xlsx",
    signature: { entered: "C", approved: "G", labelRow: 15 },
    content: {
      type: "rows",
      noun: ["bank account", "bank accounts"],
      data: { first: 3, last: 3 },
      approval: { first: 11, last: 11 },
      columns: [
        { key: "ba", col: "A", header: "BA", type: "ba" },
        { key: "baName", col: "B", header: "BA Name", type: "text" },
        { key: "bank", col: "C", header: "Bank", type: "text", required: true },
        { key: "accountNumber", col: "D", header: "Account Number", type: "code", required: true },
        { key: "accountName", col: "E", header: "Account Name", type: "text", required: true },
        { key: "currency", col: "F", header: "Currency", type: "currency", required: true },
        { key: "opening", col: "G", header: "Opening Balance", type: "money" },
        { key: "receipts", col: "H", header: "Receipts", type: "money" },
        { key: "payments", col: "I", header: "Payments", type: "money" },
        { key: "closing", col: "J", header: "Closing Balance", type: "closing" },
      ],
    },
  },
  {
    code: "F06-BC",
    title: "F06 Balance Carryforward",
    kind: "YEARLY",
    file: "F06 Balance Carryforward.xlsx",
    signature: { entered: "D", approved: "I", labelRow: 13 },
    content: {
      type: "rows",
      noun: ["fund", "funds"],
      total: "closing",
      data: { first: 3, last: 3 },
      approval: { first: 10, last: 10 },
      columns: [
        { key: "fundName", col: "A", header: "Name of Fund", type: "text", required: true },
        { key: "ba", col: "B", header: "BA", type: "ba" },
        { key: "fund", col: "C", header: "Fund", type: "code" },
        { key: "functionalArea", col: "D", header: "Functional Area", type: "code" },
        { key: "wbs", col: "E", header: "WBS", type: "code" },
        { key: "fundCenter", col: "F", header: "Fund Center", type: "code" },
        { key: "glAccount", col: "G", header: "GL Account*", type: "code", hint: "Needed only for deposit funds" },
        { key: "opening", col: "H", header: "Opening Balance (MVR)", type: "money" },
        { key: "receipts", col: "I", header: "Receipts (MVR)", type: "money" },
        { key: "payments", col: "J", header: "Payments (MVR)", type: "money" },
        { key: "closing", col: "K", header: "Closing Balance (MVR)", type: "closing" },
      ],
    },
  },
  {
    code: "F06-IA",
    title: "F06 Imprest Account",
    kind: "YEARLY",
    file: "F06 Imprest Account.xlsx",
    signature: { entered: "E", approved: "N", labelRow: 14 },
    content: {
      type: "rows",
      noun: ["imprest account", "imprest accounts"],
      data: { first: 3, last: 8 },
      approval: { first: 6, last: 11 },
      columns: [
        { key: "ba", col: "A", header: "BA", type: "ba" },
        { key: "baName", col: "B", header: "BA Name", type: "text" },
        { key: "fund", col: "C", header: "Fund", type: "code" },
        { key: "functionalArea", col: "D", header: "Functional Area", type: "code" },
        { key: "wbs", col: "E", header: "WBS", type: "code" },
        { key: "fundCenter", col: "F", header: "Fund Center", type: "code" },
        { key: "glAccount", col: "G", header: "GL Account", type: "code" },
        { key: "donor", col: "H", header: "Name of Donor", type: "text" },
        { key: "bank", col: "I", header: "Bank", type: "text", required: true },
        { key: "accountNumber", col: "J", header: "Account Number", type: "code", required: true },
        { key: "accountName", col: "K", header: "Account Name", type: "text", required: true },
        { key: "currency", col: "L", header: "Currency", type: "currency", required: true },
        { key: "opening", col: "M", header: "Opening Balance", type: "money" },
        { key: "receipts", col: "N", header: "Receipts", type: "money" },
        { key: "payments", col: "O", header: "Payments", type: "money" },
        { key: "closing", col: "P", header: "Closing Balance", type: "closing" },
      ],
    },
  },
  {
    code: "F19",
    title: "F19 Payables",
    kind: "YEARLY",
    file: "F19 Payables.xlsx",
    signature: { entered: "C", approved: "E", labelRow: 15 },
    content: { type: "payables" },
  },
] as const satisfies readonly FiyesFormDef[];

export type FiyesForm = (typeof FIYES_FORMS)[number];
export type FiyesFormCode = FiyesForm["code"];

export const FIYES_FORM_CODES = FIYES_FORMS.map((f) => f.code) as [FiyesFormCode, ...FiyesFormCode[]];

/** The forms in a return of this kind — the only way to list a return's forms. */
export const formsFor = (kind: FiyesKind): FiyesForm[] => FIYES_FORMS.filter((f) => f.kind === kind);

export const fiyesForm = (code: string): FiyesForm | undefined => FIYES_FORMS.find((f) => f.code === code);

export type FiyesLinesForm = FiyesFormDef & { content: FiyesLinesContent };
export type FiyesRowsForm = FiyesFormDef & { content: FiyesRowsContent };

export const isLinesForm = (f: FiyesFormDef): f is FiyesLinesForm => f.content.type === "lines";
export const isRowsForm = (f: FiyesFormDef): f is FiyesRowsForm => f.content.type === "rows";

/** A set's forms that carry lines or rows, widened for generic code. */
export const linesForms = (kind: FiyesKind) => (formsFor(kind) as FiyesFormDef[]).filter(isLinesForm);
export const rowsForms = (kind: FiyesKind) => (formsFor(kind) as FiyesFormDef[]).filter(isRowsForm);

/** The lines entered by hand (F01's petty cash is calculated). */
export const enteredLines = (c: FiyesLinesContent) => c.lines.filter((l) => !l.calculated);

/** The columns entered by hand (BA is fixed, closing balances are worked out). */
export const enteredColumns = (c: FiyesRowsContent) => c.columns.filter((col) => col.type !== "ba" && col.type !== "closing");

// ----- Entered values -----
// Stored as FiyesReturn.entries (validated by server/schemas/fiyes.schema.ts):
// line amounts and rows, keyed by form code.

/** Line key → amount key → value. */
export type FiyesLineValues = Record<string, Record<string, number>>;
/** Column key → value (money as numbers, everything else as text). */
export type FiyesRowValues = Record<string, string | number>;
export type FiyesEntries = {
  lines: Partial<Record<FiyesFormCode, FiyesLineValues>>;
  rows: Partial<Record<FiyesFormCode, FiyesRowValues[]>>;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const asNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const asText = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * A set's entries in canonical form: every line and column the catalogue
 * defines (missing amounts are 0), nothing it doesn't, money to 2 decimals.
 * Used both on what's saved and on what's read back, so forms keep working
 * if the catalogue later gains a line or column.
 */
export function readEntries(kind: FiyesKind, raw: unknown): FiyesEntries {
  const lines = asRecord(asRecord(raw).lines);
  const rows = asRecord(asRecord(raw).rows);
  const out: FiyesEntries = { lines: {}, rows: {} };
  for (const form of linesForms(kind)) {
    const stored = asRecord(lines[form.code]);
    out.lines[form.code as FiyesFormCode] = Object.fromEntries(
      enteredLines(form.content).map((line) => {
        const amounts = asRecord(stored[line.key]);
        return [line.key, Object.fromEntries(form.content.amounts.map((a) => [a.key, round2(asNumber(amounts[a.key]))]))];
      }),
    );
  }
  for (const form of rowsForms(kind)) {
    const stored = Array.isArray(rows[form.code]) ? (rows[form.code] as unknown[]) : [];
    out.rows[form.code as FiyesFormCode] = stored.map((r) => {
      const row = asRecord(r);
      return Object.fromEntries(
        enteredColumns(form.content).map((c) => {
          if (c.type === "money") return [c.key, round2(asNumber(row[c.key]))];
          const text = asText(row[c.key]);
          return [c.key, c.type === "currency" ? text.toUpperCase() : text];
        }),
      );
    });
  }
  return out;
}

/** A row's closing balance: opening + receipts − payments. */
export const rowClosing = (row: FiyesRowValues) =>
  round2(asNumber(row.opening) + asNumber(row.receipts) - asNumber(row.payments));

/** A row's value for a column, as the form shows it. */
export function columnValue(c: FiyesColumn, row: FiyesRowValues): string | number {
  if (c.type === "ba") return FIYES_BA;
  if (c.type === "closing") return rowClosing(row);
  return row[c.key] ?? (c.type === "money" ? 0 : "");
}

/** Lines with an amount other than zero. */
export function filledLines(form: FiyesLinesForm, entries: FiyesEntries) {
  const values = entries.lines[form.code as FiyesFormCode] ?? {};
  return enteredLines(form.content).filter((l) => form.content.amounts.some((a) => (values[l.key]?.[a.key] ?? 0) !== 0));
}

export const formRows = (form: FiyesFormDef, entries: FiyesEntries): FiyesRowValues[] =>
  entries.rows[form.code as FiyesFormCode] ?? [];

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export type FiyesPeriod = { kind: FiyesKind; year: number; month: number | null };

/** "2026-10" for a monthly return, "2026" for a yearly one. */
export function periodKey(p: FiyesPeriod): string {
  return p.kind === "MONTHLY" ? `${p.year}-${String(p.month).padStart(2, "0")}` : String(p.year);
}

export function parsePeriod(key: string): FiyesPeriod | null {
  const m = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(key);
  if (!m) return null;
  return m[2]
    ? { kind: "MONTHLY", year: Number(m[1]), month: Number(m[2]) }
    : { kind: "YEARLY", year: Number(m[1]), month: null };
}

/** "October 2026" or "2026". */
export function periodLabel(p: FiyesPeriod): string {
  return p.kind === "MONTHLY" ? `${MONTH_NAMES[(p.month ?? 1) - 1]} ${p.year}` : String(p.year);
}

/** "October 2026 monthly return" or "2026 yearly return". */
export function returnTitle(p: FiyesPeriod): string {
  return `${periodLabel(p)} ${p.kind === "MONTHLY" ? "monthly" : "yearly"} return`;
}

/** First and last day of a month, at UTC midnight. */
export function monthBounds(year: number, month: number): { first: Date; last: Date } {
  return {
    first: new Date(Date.UTC(year, month - 1, 1)),
    last: new Date(Date.UTC(year, month, 0)),
  };
}

/** Whether a period has started (returns can't be filed ahead of time). */
export function periodHasStarted(p: FiyesPeriod, now = new Date()): boolean {
  const y = now.getUTCFullYear();
  if (p.kind === "YEARLY") return p.year <= y;
  return p.year < y || (p.year === y && (p.month ?? 13) <= now.getUTCMonth() + 1);
}

/** "F01 Cash on Hand - October 2026.xlsx" */
export function fiyesFileName(form: FiyesFormDef, p: FiyesPeriod, ext: "xlsx" | "pdf"): string {
  return `${form.title} - ${periodLabel(p)}.${ext}`;
}

/** Business area National Archives files under; printed on every form. */
export const FIYES_BA = 1506;
