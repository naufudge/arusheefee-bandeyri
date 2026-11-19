import { promises as fs } from "fs";
import path from "path";
import { XlsxTemplate, type CellValue } from "./xlsx-template";
import {
  FIYES_BA,
  monthBounds,
  readEntries,
  rowClosing,
  type FiyesColumn,
  type FiyesEntries,
  type FiyesFormCode,
  type FiyesFormDef,
  type FiyesKind,
  type FiyesLineValues,
  type FiyesLinesContent,
  type FiyesRowValues,
  type FiyesRowsContent,
} from "@/lib/fiyes";
import { formatDmy } from "@/lib/week";

export type FiyesSignatory = { name: string; designation: string | null } | null;

export type FiyesPayableRow = {
  invoiceNumber: string;
  invoiceDate: Date;
  vendorName: string;
  vendorAccount: string;
  details: string;
  currency: string;
  amount: number;
  amountMvr: number;
};

/** What a return contributes to its forms. */
export type FiyesReturnData = {
  kind: FiyesKind;
  year: number;
  month: number | null;
  documentDate: Date;
  pettyCashOpening: number | null;
  pettyCashClosing: number | null;
  enteredBy: FiyesSignatory;
  approvedBy: FiyesSignatory;
  payables: FiyesPayableRow[];
  entries: FiyesEntries;
};

/** A stored return (with its signatories and payables) as the forms need it. */
export function returnData(r: {
  kind: FiyesKind;
  year: number;
  month: number | null;
  documentDate: Date;
  pettyCashOpening: number | null;
  pettyCashClosing: number | null;
  enteredBy: { name: string; designation: string | null } | null;
  approvedBy: { name: string; designation: string | null } | null;
  payables: FiyesPayableRow[];
  entries: unknown;
}): FiyesReturnData {
  const person = (s: typeof r.enteredBy) => (s ? { name: s.name, designation: s.designation } : null);
  return {
    kind: r.kind,
    year: r.year,
    month: r.month,
    documentDate: r.documentDate,
    pettyCashOpening: r.pettyCashOpening,
    pettyCashClosing: r.pettyCashClosing,
    enteredBy: person(r.enteredBy),
    approvedBy: person(r.approvedBy),
    payables: r.payables.map((p) => ({
      invoiceNumber: p.invoiceNumber,
      invoiceDate: p.invoiceDate,
      vendorName: p.vendorName,
      vendorAccount: p.vendorAccount,
      details: p.details,
      currency: p.currency,
      amount: p.amount,
      amountMvr: p.amountMvr,
    })),
    entries: readEntries(r.kind, r.entries),
  };
}

const TEMPLATE_DIR = path.join(process.cwd(), "templates", "fiyes");
const F19_COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Days since Excel's epoch, for a date shown with the template's yyyy-mm-dd format. */
const excelSerial = (d: Date) =>
  (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(1899, 11, 30)) / 86_400_000;

/**
 * A code as the templates store one: digits-only codes as numbers (like F19's
 * vendor accounts), but text with a leading zero or more than 11 digits,
 * which Excel would drop or show in scientific notation.
 */
const codeValue = (s: string): CellValue => (/^[1-9]\d{0,10}$/.test(s) ? Number(s) : s);

/**
 * The template filled in for one return. Only the cells listed here change,
 * and a form with nothing entered keeps its template's nil content: it gets
 * nothing but its signature block.
 */
export async function buildFiyesWorkbook(
  ret: FiyesReturnData,
  form: FiyesFormDef,
): Promise<{ book: XlsxTemplate; signatureRow: number }> {
  if (form.kind !== ret.kind) {
    throw new Error(`${form.title} isn't part of a ${ret.kind.toLowerCase()} return`);
  }
  const book = await XlsxTemplate.load(await fs.readFile(path.join(TEMPLATE_DIR, form.file)));
  const code = form.code as FiyesFormCode;

  let shift = 0;
  if (form.code === "F01") fillCashOnHand(book, ret);
  if (form.content.type === "lines") fillLines(book, form.content, ret.entries.lines[code] ?? {});
  if (form.content.type === "rows") shift = fillRows(book, form.content, ret.entries.rows[code] ?? []);
  if (form.content.type === "payables") shift = fillPayables(book, ret.payables);

  const labelRow = form.signature.labelRow + shift;
  fillSignatures(book, form, labelRow, ret);
  book.finalize();
  return { book, signatureRow: labelRow + 1 };
}

export async function fiyesWorkbookBuffer(ret: FiyesReturnData, form: FiyesFormDef): Promise<Buffer> {
  const { book } = await buildFiyesWorkbook(ret, form);
  return book.toBuffer();
}

// Guards against a re-issued template moving its cells: fail loudly rather
// than write names or figures into the wrong place.
function expectText(book: XlsxTemplate, sheet: string, ref: string, text: string) {
  const actual = book.sheet(sheet).value(ref);
  if (typeof actual !== "string" || actual.trim() !== text) {
    throw new Error(`Template changed: expected "${text}" in ${sheet}!${ref}, found "${actual ?? ""}"`);
  }
}

function fillSignatures(book: XlsxTemplate, form: FiyesFormDef, label: number, ret: FiyesReturnData) {
  const sheet = book.sheet("Approval_Template");
  const { entered, approved } = form.signature;
  expectText(book, "Approval_Template", `${entered}${label}`, "Entered by");
  expectText(book, "Approval_Template", `${approved}${label}`, "Approved by");

  sheet.set(`${entered}${label + 2}`, ret.enteredBy?.name ?? null);
  sheet.set(`${entered}${label + 3}`, ret.enteredBy?.designation ?? null);
  sheet.set(`${entered}${label + 4}`, formatDmy(ret.documentDate));
  sheet.set(`${approved}${label + 2}`, ret.approvedBy?.name ?? null);
  sheet.set(`${approved}${label + 3}`, ret.approvedBy?.designation ?? null);
  // The approved date is the template's own "= entered date" formula.
  const dateRef = `${approved}${label + 4}`;
  if (!sheet.formulaOf(dateRef)) sheet.setFormula(dateRef, `${entered}${label + 4}`);
}

// F01's header dates and its petty cash line; fillLines does the other lines.
function fillCashOnHand(book: XlsxTemplate, ret: FiyesReturnData) {
  if (ret.month === null) throw new Error("F01 needs a month");
  expectText(book, "Data_Entry", "A3", "Petty Cash");
  const data = book.sheet("Data_Entry");
  const { first, last } = monthBounds(ret.year, ret.month);
  data.set("C2", `Amount as at ${formatDmy(first)}`);
  data.set("D2", `Amount as at ${formatDmy(last)}`);
  data.set("C3", ret.pettyCashOpening === null ? null : round2(ret.pettyCashOpening));
  data.set("D3", ret.pettyCashClosing === null ? null : round2(ret.pettyCashClosing));
}

/**
 * A form of fixed lines (F01, F03): each line's amounts go in its Data_Entry
 * row; the approval sheet already points at them. Zero is the template's own
 * value, so an untouched form stays as issued.
 */
function fillLines(book: XlsxTemplate, content: FiyesLinesContent, values: FiyesLineValues) {
  const data = book.sheet("Data_Entry");
  for (const line of content.lines) {
    expectText(book, "Data_Entry", `${content.labelCol}${line.row}`, line.label);
    if (line.ref && content.refCol) expectText(book, "Data_Entry", `${content.refCol}${line.row}`, line.ref);
    if (line.calculated) continue;
    for (const a of content.amounts) data.set(`${a.col}${line.row}`, round2(values[line.key]?.[a.key] ?? 0));
  }
}

function cellValue(c: FiyesColumn, row: FiyesRowValues): CellValue {
  const v = row[c.key];
  switch (c.type) {
    case "ba":
      return FIYES_BA;
    case "closing":
      return rowClosing(row);
    case "money":
      return round2(typeof v === "number" ? v : 0);
    default: {
      // The templates fill a cell with no value with "-".
      const text = typeof v === "string" ? v.trim() : "";
      if (text === "") return "-";
      return c.type === "code" ? codeValue(text) : text;
    }
  }
}

/**
 * A form of rows (F04, F05, F12, F06). With none, the template's own nil
 * content stays. Otherwise its Data_Entry rows become exactly the entered
 * rows, and the approval table gets a formula row for each, padded with
 * blank rows to its template size and growing (moving the signature block
 * down) past it. Returns how far the block moved.
 */
function fillRows(book: XlsxTemplate, content: FiyesRowsContent, rows: FiyesRowValues[]): number {
  const { data: d, approval: a } = content;
  for (const c of content.columns) {
    expectText(book, "Data_Entry", `${c.col}${d.first - 1}`, c.header);
    expectText(book, "Approval_Template", `${c.col}${a.first - 1}`, c.header);
  }
  const n = rows.length;
  if (n === 0) return 0;

  const data = book.sheet("Data_Entry");
  data.rebuildRows(d.first, d.last, rows.map((_, i) => Math.min(d.first + i, d.last)));
  rows.forEach((row, i) => {
    for (const c of content.columns) data.set(`${c.col}${d.first + i}`, cellValue(c, row));
  });

  const size = a.last - a.first + 1;
  const total = Math.max(n, size);
  const approval = book.sheet("Approval_Template");
  approval.rebuildRows(a.first, a.last, Array.from({ length: total }, (_, i) => Math.min(a.first + i, a.last)));
  for (let i = 0; i < n; i++) {
    for (const c of content.columns) approval.setFormula(`${c.col}${a.first + i}`, `Data_Entry!${c.col}${d.first + i}`);
  }
  return total - size;
}

/**
 * F19 rows. Data_Entry rows 3/4/5 are the template's first, middle and last
 * data rows. The Approval_Template table (rows 7–12) has three formula rows,
 * two blank rows and a closing blank row; it keeps at least six rows and
 * always ends on that closing row, growing (and moving the signature block
 * down) when there are more payables. Returns how far the block moved.
 */
function fillPayables(book: XlsxTemplate, payables: FiyesPayableRow[]): number {
  expectText(book, "Data_Entry", "A2", "Invoice Number");
  const rows: CellValue[][] = payables.length
    ? payables.map((p) => [
        p.invoiceNumber,
        excelSerial(p.invoiceDate),
        p.vendorName,
        codeValue(p.vendorAccount),
        p.details,
        FIYES_BA,
        p.currency,
        round2(p.amount),
        round2(p.amountMvr),
      ])
    : // No payables: a nil row, as the other nil templates write it.
      [["-", "-", "-", "-", "-", FIYES_BA, "-", "-", "-"]];
  const n = rows.length;

  const data = book.sheet("Data_Entry");
  data.rebuildRows(3, 5, rows.map((_, i) => (i === n - 1 ? 5 : i === 0 ? 3 : 4)));
  rows.forEach((cells, i) => cells.forEach((v, c) => data.set(`${F19_COLUMNS[c]}${3 + i}`, v)));

  const total = Math.max(n + 1, 6);
  const plan = Array.from({ length: total }, (_, i) => {
    if (i === total - 1) return 12;
    if (i < n) return i < 3 ? 7 + i : 8;
    return 7 + i === 10 || 7 + i === 11 ? 7 + i : 11;
  });
  const approval = book.sheet("Approval_Template");
  approval.rebuildRows(7, 12, plan);
  for (let i = 0; i < n; i++) {
    for (const col of F19_COLUMNS) approval.setFormula(`${col}${7 + i}`, `Data_Entry!${col}${3 + i}`);
  }
  return total - 6;
}
