import ExcelJS from "exceljs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { cellToNumber, cellToString, formatExcelDate, parseDate } from "@/lib/excel";
import { pvReceivedMvr } from "@/utils/currency";
import { glAccountIdsByCode, unknownGlCodesMessage } from "./glAccounts";

// The org's "Petty cash registry" workbook (Sheet1): import and export.
// Columns are found by their header text, so both the current layout
// (with In Charge of Thijoory and Received by) and older files import.

type Db = PrismaClient;

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

// ----- Columns -----

const HEADERS = {
  code: ["code"],
  date: ["date"],
  formNo: ["form no", "form no.", "form number"],
  details: ["details"],
  paid: ["paid"],
  inCharge: ["in charge of thijoory", "in charge of thijoori"],
  receivedBy: ["received by"],
} as const;
type Field = keyof typeof HEADERS;
const REQUIRED: Field[] = ["code", "date", "formNo", "details", "paid"];
const LABEL: Record<Field, string> = {
  code: "Code",
  date: "Date",
  formNo: "Form No",
  details: "Details",
  paid: "Paid",
  inCharge: "In Charge of Thijoory",
  receivedBy: "Received by",
};

export type RegistryColumns = Partial<Record<Field, number>> & { headerRow: number };

/** Where each field sits, from the header rows (the first five). */
export function registryColumns(ws: ExcelJS.Worksheet): { ok: true; cols: RegistryColumns } | { ok: false; error: string } {
  const cols: RegistryColumns = { headerRow: 0 };
  for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
    ws.getRow(r).eachCell((cell, c) => {
      const text = norm(cellToString(cell.value));
      for (const field of Object.keys(HEADERS) as Field[]) {
        if (cols[field] === undefined && (HEADERS[field] as readonly string[]).includes(text)) {
          cols[field] = c;
          cols.headerRow = Math.max(cols.headerRow, r);
        }
      }
    });
  }
  const missing = REQUIRED.filter((f) => cols[f] === undefined);
  if (missing.length) {
    return {
      ok: false,
      error: `This sheet isn't in the petty cash registry layout: no ${missing.map((f) => `"${LABEL[f]}"`).join(", ")} column in its header rows.`,
    };
  }
  return { ok: true, cols };
}

// ----- Rows -----

const PC_NUM_RE = /^PC\/(\d+)\/\d{4}$/;

export type InvalidRow = { num: string; error: string; row: number };

export type RegistryRow = {
  rowNumber: number;
  pettyCashNum: string;
  glCode: number;
  date: Date;
  totalRequiredAmount: number;
  details: string;
  inCharge: string;
  receivedBy: string;
};

const nameIn = (row: ExcelJS.Row, col: number | undefined) =>
  col === undefined ? "" : cellToString(row.getCell(col).value).replace(/\s+/g, " ").trim();

/**
 * One row as a petty-cash record candidate, or null when it isn't an
 * expense line: headers, the opening balance, reimbursements (PC/00 or no
 * Paid amount) and blank pre-numbered rows are skipped by design.
 */
function readRow(row: ExcelJS.Row, rowNumber: number, cols: RegistryColumns): { ok: true; data: RegistryRow } | { ok: false; invalid?: InvalidRow } {
  // The sheet may use slashes or dashes; records store dashes (PC-20-2026).
  const slashed = cellToString(row.getCell(cols.formNo!).value).trim().replace(/-/g, "/");
  const storedNum = slashed.replace(/\//g, "-");
  const paid = cellToNumber(row.getCell(cols.paid!).value);

  const m = slashed.match(PC_NUM_RE);
  if (!m || Number(m[1]) <= 0 || paid === null) return { ok: false };

  if (paid <= 0) return { ok: false, invalid: { num: storedNum, error: "Paid amount must be positive", row: rowNumber } };

  const date = parseDate(row.getCell(cols.date!).value);
  if (!date) return { ok: false, invalid: { num: storedNum, error: "Missing or invalid date", row: rowNumber } };

  const glCode = cellToNumber(row.getCell(cols.code!).value);
  if (glCode === null || glCode <= 0) {
    return { ok: false, invalid: { num: storedNum, error: "Missing GL code", row: rowNumber } };
  }

  return {
    ok: true,
    data: {
      rowNumber,
      pettyCashNum: storedNum,
      glCode,
      date,
      totalRequiredAmount: paid,
      details: cellToString(row.getCell(cols.details!).value).trim(),
      inCharge: nameIn(row, cols.inCharge),
      receivedBy: nameIn(row, cols.receivedBy),
    },
  };
}

// ----- Staff -----

/** A sheet name with no single staff match. `key` (the normalised name) is what a name map uses. */
export type UnmatchedName = { key: string; name: string; columns: string[]; reason: string; rows: number[] };

/** Staff id for a name typed in the sheet; one exact (spacing- and case-insensitive) match only. */
async function staffMatcher(db: Db) {
  const staff = await db.staff.findMany({ select: { id: true, name: true } });
  const byName = new Map<string, string[]>();
  for (const s of staff) byName.set(norm(s.name), [...(byName.get(norm(s.name)) ?? []), s.id]);
  const ids = new Set(staff.map((s) => s.id));
  return {
    exists: (id: string) => ids.has(id),
    match: (n: string): { id: string } | { reason: string } => {
      const found = byName.get(norm(n)) ?? [];
      if (found.length === 1) return { id: found[0] };
      return { reason: found.length ? "Matches more than one staff member" : "Not in the staff list" };
    },
  };
}

// ----- Import -----

export type PreparedRow = RegistryRow & {
  glAccountId: number;
  /** Received by → Funds Received By (handledBy). */
  receivedById: string | null;
  /** In Charge of Thijoory → Balance Received By (balanceCollectedBy). */
  inChargeId: string | null;
};

export type PreparedImport = {
  totalRows: number;
  rows: PreparedRow[];
  invalid: InvalidRow[];
  existing: Set<string>;
  unmatchedNames: UnmatchedName[];
};

/**
 * Reads, checks and matches a registry sheet; nothing is written. `nameMap`
 * links sheet names (by `nameKey`) that matched no single staff member to the
 * staff member the user picked.
 */
export async function prepareRegistryImport(
  db: Db,
  ws: ExcelJS.Worksheet,
  nameMap: Record<string, string> = {},
): Promise<{ ok: true; prepared: PreparedImport } | { ok: false; error: string }> {
  const found = registryColumns(ws);
  if (!found.ok) return found;
  const { cols } = found;

  const staff = await staffMatcher(db);
  if (Object.values(nameMap).some((id) => !staff.exists(id))) {
    return { ok: false, error: "A staff member picked for a name no longer exists. Preview the file again." };
  }

  const parsed: RegistryRow[] = [];
  const invalid: InvalidRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= cols.headerRow) return;
    const res = readRow(row, rowNumber, cols);
    if (res.ok) parsed.push(res.data);
    else if (res.invalid) invalid.push(res.invalid);
  });

  // Last one wins on a number repeated within the file.
  const byNum = new Map<string, RegistryRow>();
  for (const p of parsed) byNum.set(p.pettyCashNum, p);

  // Codes not in the chart of accounts are reported and never committed.
  // (Existence only: imported records are historical, so the
  // petty-cash-allowed flag isn't enforced.)
  const glIds = await glAccountIdsByCode(db, [...byNum.values()].map((r) => r.glCode));
  let rows: RegistryRow[] = [];
  for (const r of byNum.values()) {
    if (glIds.has(r.glCode)) rows.push(r);
    else invalid.push({ num: r.pettyCashNum, error: unknownGlCodesMessage([r.glCode]), row: r.rowNumber });
  }

  const existing = new Set(
    (
      await db.pettyCash.findMany({
        where: { pettyCashNum: { in: rows.map((r) => r.pettyCashNum) } },
        select: { pettyCashNum: true },
      })
    ).map((e) => e.pettyCashNum),
  );

  // A number a record has since been renumbered from is that record, not a new one.
  const unmatchedNums = rows.map((r) => r.pettyCashNum).filter((n) => !existing.has(n));
  const renumberedTo = new Map<string, string>();
  if (unmatchedNums.length) {
    const renumbered = await db.pettyCash.findMany({
      where: { previousNums: { hasSome: unmatchedNums } },
      select: { pettyCashNum: true, previousNums: true },
    });
    for (const pc of renumbered) for (const old of pc.previousNums) renumberedTo.set(old, pc.pettyCashNum);
  }
  rows = rows.filter((r) => {
    const now = !existing.has(r.pettyCashNum) && renumberedTo.get(r.pettyCashNum);
    if (now) {
      invalid.push({
        num: r.pettyCashNum,
        error: `Renumbered to ${now} — already in the register, not imported again`,
        row: r.rowNumber,
      });
    }
    return !now;
  });

  // Names → staff: an exact match, else the user's pick, else reported and left blank.
  const unmatched = new Map<string, UnmatchedName>();
  const staffFor = (n: string, column: string, rowNumber: number) => {
    if (!n) return null;
    const m = staff.match(n);
    if ("id" in m) return m.id;
    const key = norm(n);
    if (nameMap[key]) return nameMap[key];
    const entry = unmatched.get(key) ?? { key, name: n, columns: [], reason: m.reason, rows: [] };
    if (!entry.columns.includes(column)) entry.columns.push(column);
    entry.rows.push(rowNumber);
    unmatched.set(key, entry);
    return null;
  };
  const prepared: PreparedRow[] = rows.map((r) => ({
    ...r,
    glAccountId: glIds.get(r.glCode)!,
    receivedById: staffFor(r.receivedBy, LABEL.receivedBy, r.rowNumber),
    inChargeId: staffFor(r.inCharge, LABEL.inCharge, r.rowNumber),
  }));

  return {
    ok: true,
    prepared: { totalRows: parsed.length, rows: prepared, invalid, existing, unmatchedNames: [...unmatched.values()] },
  };
}

export type CommitResult = {
  inserted: number;
  replaced: number;
  skipped: number;
  failed: { num: string; error: string }[];
};

/**
 * Writes the prepared rows. Records are approved by the system; the two
 * named people are linked as unsigned roles (the sheet says who, not that
 * they signed), so they only need to sign if the record is ever edited.
 */
export async function commitRegistryImport(
  db: Db,
  prepared: PreparedImport,
  onConflict: "skip" | "replace",
): Promise<CommitResult> {
  const result: CommitResult = { inserted: 0, replaced: 0, skipped: 0, failed: [] };

  for (const r of prepared.rows) {
    const isDuplicate = prepared.existing.has(r.pettyCashNum);
    if (isDuplicate && onConflict === "skip") {
      result.skipped += 1;
      continue;
    }

    const role = (staffId: string | null, amount: number | null) =>
      staffId ? { create: { staff: { connect: { id: staffId } }, date: r.date, amount, isApproved: false } } : undefined;
    const data: Prisma.PettyCashCreateInput = {
      pettyCashNum: r.pettyCashNum,
      date: r.date,
      // Fields the registry doesn't carry are left blank.
      formNum: "",
      sectionUnit: "",
      totalRequiredAmount: r.totalRequiredAmount,
      glAccount: { connect: { id: r.glAccountId } },
      items: r.details ? { create: [{ qty: 1, name: r.details }] } : undefined,
      handledBy: role(r.receivedById, r.totalRequiredAmount),
      balanceCollectedBy: role(r.inChargeId, null),
      systemApproved: true,
    };

    try {
      if (isDuplicate) {
        // Replace: delete the old record (cascades items and events) and its
        // role rows, then recreate, all or nothing.
        await db.$transaction(async (tx) => {
          const old = await tx.pettyCash.findUnique({ where: { pettyCashNum: r.pettyCashNum } });
          const roleIds = old
            ? [old.handledById, old.procurementApprovedById, old.budgetCheckedById, old.balanceHandedOverById, old.balanceCollectedById].filter(
                (id): id is string => Boolean(id),
              )
            : [];
          await tx.pettyCash.delete({ where: { pettyCashNum: r.pettyCashNum } });
          if (roleIds.length) await tx.pettyCashStaff.deleteMany({ where: { id: { in: roleIds } } });
          await tx.pettyCash.create({ data });
        });
        result.replaced += 1;
      } else {
        // One nested create: the record, its item and its roles together.
        await db.pettyCash.create({ data });
        result.inserted += 1;
      }
    } catch (err) {
      result.failed.push({ num: r.pettyCashNum, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }
  return result;
}

// ----- Export -----

const ACCOUNTING = '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)';

// The registry's columns and widths (Sheet1 of the org's workbook).
const COLUMNS: { key: string; header: string; width: number }[] = [
  { key: "no", header: "No.", width: 6 },
  { key: "code", header: "Code", width: 12 },
  { key: "date", header: "Date", width: 12 },
  { key: "formNo", header: "Form No", width: 15 },
  { key: "inCharge", header: "In Charge of Thijoory", width: 24 },
  { key: "receivedBy", header: "Received by", width: 23 },
  { key: "details", header: "Details", width: 60 },
  { key: "received", header: "Received", width: 12 },
  { key: "paid", header: "Paid", width: 12 },
  { key: "balance", header: "Balance", width: 13 },
];

/**
 * The year's register: an opening balance, a Paid row per petty cash record
 * and a Received row per reimbursement PV, by date with a running balance.
 */
export async function buildRegister(db: Db, year: number): Promise<ExcelJS.Workbook> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const person = { select: { staff: { select: { name: true } } } } as const;

  const [pcs, reimbursements, openingRow] = await Promise.all([
    db.pettyCash.findMany({
      where: { date: { gte: start, lt: end } },
      include: { items: true, handledBy: person, balanceCollectedBy: person, glAccount: { select: { code: true } } },
    }),
    db.pV.findMany({
      where: { isPettyCashReimbursement: true, date: { gte: start, lt: end } },
      include: {
        invoices: {
          select: { invoiceTotal: true, glDetails: { select: { glAccount: { select: { code: true } } } } },
        },
      },
    }),
    db.pettyCashOpeningBalance.findUnique({ where: { year } }),
  ]);

  type Entry =
    | { kind: "paid"; date: Date; record: (typeof pcs)[number] }
    | { kind: "received"; date: Date; record: (typeof reimbursements)[number] };
  const entries: Entry[] = [
    ...pcs.map((pc): Entry => ({ kind: "paid", date: pc.date, record: pc })),
    ...reimbursements.map((pv): Entry => ({ kind: "received", date: pv.date, record: pv })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Archiva";
  workbook.created = new Date();
  const ws = workbook.addWorksheet("Sheet1");
  ws.columns = COLUMNS.map(({ key, width }) => ({ key, width }));

  // Two header rows: A–G span both, "Amount" spans Received, Paid and Balance.
  ws.getRow(1).values = [...COLUMNS.slice(0, 7).map((c) => c.header), "Amount", "Amount", "Amount"];
  ws.getRow(2).values = COLUMNS.map((c) => c.header);
  for (let c = 1; c <= 7; c++) ws.mergeCells(1, c, 2, c);
  ws.mergeCells(1, 8, 1, 10);
  for (const r of [1, 2]) {
    const row = ws.getRow(r);
    row.font = { bold: true };
    row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    for (let c = 1; c <= 10; c++) {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
    }
  }
  for (const key of ["received", "paid", "balance"]) ws.getColumn(key).numFmt = ACCOUNTING;

  let balance = openingRow?.amount ?? 0;
  ws.addRow({
    date: formatExcelDate(start),
    details: `Opening balance as at 01st Jan ${year}`,
    received: balance,
    balance,
  });

  let counter = 0;
  for (const entry of entries) {
    if (entry.kind === "paid") {
      const pc = entry.record;
      balance -= pc.totalRequiredAmount;
      counter += 1;
      ws.addRow({
        no: counter,
        code: pc.glAccount.code,
        date: formatExcelDate(pc.date),
        formNo: pc.pettyCashNum.replace(/-/g, "/"),
        inCharge: pc.balanceCollectedBy?.staff.name ?? "",
        receivedBy: pc.handledBy?.staff.name ?? "",
        details: pc.items.map((it) => it.name || it.nameDhivehi || "").filter(Boolean).join(", "),
        paid: pc.totalRequiredAmount,
        balance,
      });
    } else {
      const pv = entry.record;
      // The ledger is in MVR, so convert from the PV's document currency.
      const received = pvReceivedMvr(pv);
      balance += received;
      const codes = new Set(pv.invoices.flatMap((i) => i.glDetails.map((g) => g.glAccount.code)));
      ws.addRow({
        code: codes.size === 1 ? [...codes][0] : "",
        date: formatExcelDate(pv.date),
        // As the registry writes reimbursements; the import skips PC/00.
        formNo: `PC/00/${year}`,
        details: pv.notes || "Petty Cash Reimbursement",
        received,
        balance,
      });
    }
  }
  return workbook;
}
