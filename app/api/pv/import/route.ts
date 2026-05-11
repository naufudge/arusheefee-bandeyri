import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createPvSchema, type CreatePvInput } from "@/server/schemas/pv.schema";
import {
  createPettyCashSchema,
  type CreatePettyCashInput,
} from "@/server/schemas/pettycash.schema";

const EXPECTED_HEADERS = [
  "Date",
  "Voucher No",
  "Document No",
  "Po No",
  "Invoice / Ref No",
  "Vendor",
  "Details",
  "GL Code",
  "Total",
  "Parked Date",
  "Posting Date",
  "Payment Method C/FT/LT",
  "Clearing Document Date",
  "Clearing Document No",
  "Local Transfer No / Cheque No",
] as const;

type HeaderKey =
  | "date"
  | "pvNum"
  | "documentNum"
  | "poNum"
  | "invoiceNumber"
  | "vendor"
  | "details"
  | "code"
  | "total"
  | "parkedDate"
  | "postingDate"
  | "paymentMethod"
  | "clearingDocDate"
  | "clearingDocNum"
  | "transferNum";

const HEADER_TO_KEY: Record<string, HeaderKey> = {
  "date": "date",
  "voucher no": "pvNum",
  "document no": "documentNum",
  "po no": "poNum",
  "invoice / ref no": "invoiceNumber",
  "vendor": "vendor",
  "details": "details",
  "gl code": "code",
  "total": "total",
  "parked date": "parkedDate",
  "posting date": "postingDate",
  "payment method c/ft/lt": "paymentMethod",
  "clearing document date": "clearingDocDate",
  "clearing document no": "clearingDocNum",
  "local transfer no / cheque no": "transferNum",
};

type RawRow = {
  rowNumber: number;
  date: Date | null;
  pvNum: string;
  documentNum: string;
  poNum: string;
  invoiceNumber: string;
  vendor: string;
  details: string;
  code: number | null;
  total: number | null;
  parkedDate: Date | null;
  postingDate: Date | null;
  paymentMethod: string;
  clearingDocDate: Date | null;
  clearingDocNum: string;
  transferNum: string;
};

// A voucher row is a petty cash row when its Voucher No contains "PC"
// (case-insensitive). PV register exports are a flat sheet so PV and PC
// entries are interleaved; this discriminator routes each row to the right
// model.
function isPettyCashRow(voucherNum: string): boolean {
  return /\bPC\b|PC/i.test(voucherNum);
}

export type EntryKind = "pv" | "pc";

type ValidEntry = {
  kind: EntryKind;
  num: string;
  // For PCs the section/unit stands in for "vendor" so the preview list has
  // something meaningful to show.
  vendor: string;
  total: number;
  // PVs have invoices/GL counts; PCs use these for items/0.
  invoiceCount: number;
  glCount: number;
};

type InvalidEntry = {
  kind: EntryKind;
  num: string;
  error: string;
  rowNumbers: number[];
};

type DuplicateEntry = {
  kind: EntryKind;
  num: string;
  vendor: string;
};

type PreviewSummary = {
  totalRows: number;
  pvCount: number;
  pcCount: number;
  valid: ValidEntry[];
  invalid: InvalidEntry[];
  duplicates: DuplicateEntry[];
};

type CommitResult = {
  inserted: number;
  replaced: number;
  skipped: number;
  failed: { kind: EntryKind; num: string; error: string }[];
};

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("");
    }
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    return String(value);
  }
  return String(value);
}

function cellToNumber(value: ExcelJS.CellValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "result" in value) {
    return cellToNumber(value.result as ExcelJS.CellValue);
  }
  const n = Number(cellToString(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: ExcelJS.CellValue): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value;
  const s = cellToString(value).trim();
  if (!s) return null;

  // DD.MM.YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return d;
    }
    return null;
  }

  // ISO fallback
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

function denormalizeVoucherNum(raw: string): string {
  const trimmed = raw.trim();
  // Strip leading "1506/" prefix if present
  const withoutPrefix = trimmed.replace(/^1506\//, "");
  // Replace remaining "/" with "-"
  return withoutPrefix.replace(/\//g, "-");
}

// PC voucher numbers from the exported sheet can arrive in several
// shapes — `1506/PC/86/2025`, `PC/86/2025`, `PC-86-2025`, etc. Normalise
// them to the canonical `PC/<seq>/<year>` form. Returns null if the
// shape can't be recognised, so the caller can flag it as invalid
// instead of silently miswriting the wrong number.
function normalizePettyCashNum(raw: string): string | null {
  const trimmed = raw.trim().replace(/^1506[\s\/_-]+/, "");
  const match = trimmed.match(/^PC[\s\/_-]+(\d+)[\s\/_-]+(\d{4})$/i);
  if (!match) return null;
  return `PC/${match[1]}/${match[2]}`;
}

function readHeaders(worksheet: ExcelJS.Worksheet): {
  ok: true;
  headerMap: Map<HeaderKey, number>;
} | { ok: false; missing: string[] } {
  const headerRow = worksheet.getRow(1);
  const headerMap = new Map<HeaderKey, number>();

  headerRow.eachCell((cell, colNumber) => {
    const text = cellToString(cell.value).trim().toLowerCase();
    const key = HEADER_TO_KEY[text];
    if (key) headerMap.set(key, colNumber);
  });

  const missing = EXPECTED_HEADERS.filter(
    (h) => !headerMap.has(HEADER_TO_KEY[h.toLowerCase()])
  );
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, headerMap };
}

function parseRows(
  worksheet: ExcelJS.Worksheet,
  headerMap: Map<HeaderKey, number>
): RawRow[] {
  const rows: RawRow[] = [];
  const lastRow = worksheet.rowCount;

  const colOf = (k: HeaderKey) => headerMap.get(k)!;

  for (let r = 2; r <= lastRow; r++) {
    const row = worksheet.getRow(r);
    const numRaw = cellToString(row.getCell(colOf("pvNum")).value).trim();
    if (!numRaw) continue; // skip blank rows

    // PC rows use a slash-normaliser that emits `PC/<seq>/<year>`; PV
    // rows continue to use the existing dash normaliser. If a PC row
    // can't be parsed, we keep the raw value so it lands in the invalid
    // bucket downstream with a meaningful error.
    const normalized = isPettyCashRow(numRaw)
      ? (normalizePettyCashNum(numRaw) ?? numRaw)
      : denormalizeVoucherNum(numRaw);

    rows.push({
      rowNumber: r,
      date: parseDate(row.getCell(colOf("date")).value),
      pvNum: normalized,
      documentNum: cellToString(row.getCell(colOf("documentNum")).value).trim(),
      poNum: cellToString(row.getCell(colOf("poNum")).value).trim(),
      invoiceNumber: cellToString(
        row.getCell(colOf("invoiceNumber")).value
      ).trim(),
      vendor: cellToString(row.getCell(colOf("vendor")).value).trim(),
      details: cellToString(row.getCell(colOf("details")).value).trim(),
      code: cellToNumber(row.getCell(colOf("code")).value),
      total: cellToNumber(row.getCell(colOf("total")).value),
      parkedDate: parseDate(row.getCell(colOf("parkedDate")).value),
      postingDate: parseDate(row.getCell(colOf("postingDate")).value),
      paymentMethod: cellToString(
        row.getCell(colOf("paymentMethod")).value
      ).trim(),
      clearingDocDate: parseDate(row.getCell(colOf("clearingDocDate")).value),
      clearingDocNum: cellToString(
        row.getCell(colOf("clearingDocNum")).value
      ).trim(),
      transferNum: cellToString(row.getCell(colOf("transferNum")).value).trim(),
    });
  }
  return rows;
}

function buildPv(rows: RawRow[]): {
  candidate: Partial<CreatePvInput>;
  rowNumbers: number[];
} {
  const first = rows[0];

  // Group rows into invoices by (documentNum, invoiceNumber)
  const invoiceGroups = new Map<string, RawRow[]>();
  for (const r of rows) {
    const key = `${r.documentNum}|${r.invoiceNumber}`;
    const arr = invoiceGroups.get(key) ?? [];
    arr.push(r);
    invoiceGroups.set(key, arr);
  }

  const invoices = Array.from(invoiceGroups.values()).map((groupRows) => {
    const ref = groupRows[0];
    const glDetails = groupRows.map((g) => ({
      code: g.code ?? 0,
      fund: "C-GOM",
      amount: g.total ?? 0,
    }));
    const invoiceTotal =
      Math.round(
        glDetails.reduce((s, g) => s + (g.amount || 0), 0) * 100
      ) / 100;
    return {
      comments: ref.details,
      documentNum: ref.documentNum || null,
      invoiceNumber: ref.invoiceNumber || null,
      invoiceDate: ref.date,
      invoiceTotal,
      glDetails,
    };
  });

  return {
    candidate: {
      pvNum: first.pvNum,
      businessArea: 1506,
      agency: "National Archives of Maldives",
      vendor: first.vendor,
      date: first.date ?? undefined,
      notes: first.details, // first invoice's details verbatim, no prefix
      currency: "MVR",
      exchangeRate: 1,

      preparedById: null,
      verifiedById: null,
      authorisedByOneId: null,
      authorisedByTwoId: null,

      invoices,

      poNum: first.poNum || null,
      paymentMethod: first.paymentMethod,
      parkedDate: first.parkedDate,
      postingDate: first.postingDate,
      clearingDocNum: first.clearingDocNum || null,
      clearingDocDate: first.clearingDocDate,
      transferNum: first.transferNum || null,
    },
    rowNumbers: rows.map((r) => r.rowNumber),
  };
}

// Petty cash imports only carry the 7 fields the user spec lists for PC
// rows in the spreadsheet. The other required PettyCash fields (formNum,
// sectionUnit) aren't in the export, so default them to a placeholder the
// user can refine via the edit page. Signatory rows aren't imported.
function buildPettyCash(rows: RawRow[]): {
  candidate: Partial<CreatePettyCashInput>;
  rowNumbers: number[];
} {
  const first = rows[0];

  // Each PC row is a single item with qty 1, name = Details. If the spread-
  // sheet ever lists the same pettyCashNum twice we accumulate them.
  const items = rows
    .map((r) => ({ qty: 1, name: r.details }))
    .filter((it) => it.name.length > 0);

  // Sum any "Total" values across the row group (almost always one row).
  const totalRequiredAmount =
    Math.round(rows.reduce((s, r) => s + (r.total ?? 0), 0) * 100) / 100;

  return {
    candidate: {
      pettyCashNum: first.pvNum,
      date: first.date ?? undefined,
      formNum: first.pvNum, // placeholder — user can edit later
      sectionUnit: "—",     // placeholder — user can edit later
      totalRequiredAmount,
      glCode: first.code ?? 0,
      parkedDate: first.parkedDate,
      postingDate: first.postingDate,
      handledBy: null,
      procurementApprovedBy: null,
      budgetCheckedBy: null,
      balanceHandedOverBy: null,
      balanceCollectedBy: null,
      items: items.length > 0 ? items : [{ qty: 1, name: first.details || "—" }],
    },
    rowNumbers: rows.map((r) => r.rowNumber),
  };
}

export async function POST(request: NextRequest) {
  // Auth + permission gate
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.PV_IMPORT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Capability flags used to gate petty-cash rows row-by-row (rather than
  // failing the whole import). `canImportPettyCash` is the baseline; the
  // date flags add finer-grained protection so a user with `pv:import` but
  // not the parked/posting permissions can't backdoor those values via a
  // bulk upload.
  const canImportPettyCash = hasPermission(session, PERMISSIONS.PETTYCASH_CREATE);
  const canSetPettyCashParkedDate = hasPermission(
    session,
    PERMISSIONS.PETTYCASH_EDIT_PARKED_DATE,
  );
  const canSetPettyCashPostingDate = hasPermission(
    session,
    PERMISSIONS.PETTYCASH_EDIT_POSTING_DATE,
  );

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request: expected multipart/form-data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const mode = formData.get("mode");
  const onConflict = formData.get("onConflict") ?? "skip";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (mode !== "preview" && mode !== "commit") {
    return NextResponse.json(
      { error: "mode must be 'preview' or 'commit'" },
      { status: 400 }
    );
  }
  if (
    mode === "commit" &&
    onConflict !== "skip" &&
    onConflict !== "replace"
  ) {
    return NextResponse.json(
      { error: "onConflict must be 'skip' or 'replace'" },
      { status: 400 }
    );
  }

  // Load workbook
  const workbook = new ExcelJS.Workbook();
  try {
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(Buffer.from(arrayBuffer) as unknown as Buffer);
  } catch {
    return NextResponse.json(
      { error: "Could not read the file. Is it a valid .xlsx?" },
      { status: 400 }
    );
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return NextResponse.json(
      { error: "Workbook has no worksheets" },
      { status: 400 }
    );
  }

  // Verify headers
  const headerResult = readHeaders(worksheet);
  if (!headerResult.ok) {
    return NextResponse.json(
      {
        error: `Missing required columns: ${headerResult.missing.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Parse rows
  const allRows = parseRows(worksheet, headerResult.headerMap);
  if (allRows.length === 0) {
    return NextResponse.json(
      { error: "No data rows found in the file" },
      { status: 400 }
    );
  }

  // Split by kind
  const pvRows: RawRow[] = [];
  const pcRows: RawRow[] = [];
  for (const row of allRows) {
    if (isPettyCashRow(row.pvNum)) pcRows.push(row);
    else pvRows.push(row);
  }

  // Group each kind by its voucher / pettyCashNum
  const pvGroups = new Map<string, RawRow[]>();
  for (const row of pvRows) {
    const arr = pvGroups.get(row.pvNum) ?? [];
    arr.push(row);
    pvGroups.set(row.pvNum, arr);
  }

  const pcGroups = new Map<string, RawRow[]>();
  for (const row of pcRows) {
    const arr = pcGroups.get(row.pvNum) ?? [];
    arr.push(row);
    pcGroups.set(row.pvNum, arr);
  }

  // Existing PV and PettyCash numbers in DB
  const [existingPvs, existingPcs] = await Promise.all([
    prisma.pV.findMany({
      where: { pvNum: { in: Array.from(pvGroups.keys()) } },
      select: { pvNum: true, vendor: true },
    }),
    pcGroups.size > 0
      ? prisma.pettyCash.findMany({
          where: { pettyCashNum: { in: Array.from(pcGroups.keys()) } },
          select: { pettyCashNum: true, sectionUnit: true },
        })
      : Promise.resolve([]),
  ]);
  const existingPvByNum = new Map(existingPvs.map((p) => [p.pvNum, p]));
  const existingPcByNum = new Map(
    existingPcs.map((p) => [p.pettyCashNum, p]),
  );

  const summary: PreviewSummary = {
    totalRows: allRows.length,
    pvCount: pvGroups.size,
    pcCount: pcGroups.size,
    valid: [],
    invalid: [],
    duplicates: [],
  };

  type ValidatedPv = { kind: "pv"; num: string; data: CreatePvInput };
  type ValidatedPc = { kind: "pc"; num: string; data: CreatePettyCashInput };
  const validated: (ValidatedPv | ValidatedPc)[] = [];

  // --- Validate PV entries ---
  for (const [pvNum, groupRows] of Array.from(pvGroups.entries())) {
    const { candidate, rowNumbers } = buildPv(groupRows);
    const parsed = createPvSchema.safeParse(candidate);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const path = firstIssue.path.join(".") || "(root)";
      summary.invalid.push({
        kind: "pv",
        num: pvNum,
        error: `${path}: ${firstIssue.message}`,
        rowNumbers,
      });
      continue;
    }

    const totalValue = parsed.data.invoices.reduce(
      (s, i) => s + i.invoiceTotal,
      0,
    );
    summary.valid.push({
      kind: "pv",
      num: pvNum,
      vendor: parsed.data.vendor,
      total: totalValue,
      invoiceCount: parsed.data.invoices.length,
      glCount: parsed.data.invoices.reduce(
        (s, i) => s + i.glDetails.length,
        0,
      ),
    });

    if (existingPvByNum.has(pvNum)) {
      summary.duplicates.push({
        kind: "pv",
        num: pvNum,
        vendor: parsed.data.vendor,
      });
    }

    validated.push({ kind: "pv", num: pvNum, data: parsed.data });
  }

  // --- Validate PC entries ---
  for (const [pcNum, groupRows] of Array.from(pcGroups.entries())) {
    const { candidate, rowNumbers } = buildPettyCash(groupRows);

    if (!canImportPettyCash) {
      summary.invalid.push({
        kind: "pc",
        num: pcNum,
        error:
          "Importing petty cash rows requires the 'create petty cash' permission.",
        rowNumbers,
      });
      continue;
    }
    if (candidate.parkedDate && !canSetPettyCashParkedDate) {
      summary.invalid.push({
        kind: "pc",
        num: pcNum,
        error:
          "Row sets a parked date — requires the 'edit parked date' permission.",
        rowNumbers,
      });
      continue;
    }
    if (candidate.postingDate && !canSetPettyCashPostingDate) {
      summary.invalid.push({
        kind: "pc",
        num: pcNum,
        error:
          "Row sets a posting date — requires the 'edit posting date' permission.",
        rowNumbers,
      });
      continue;
    }

    const parsed = createPettyCashSchema.safeParse(candidate);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const path = firstIssue.path.join(".") || "(root)";
      summary.invalid.push({
        kind: "pc",
        num: pcNum,
        error: `${path}: ${firstIssue.message}`,
        rowNumbers,
      });
      continue;
    }

    summary.valid.push({
      kind: "pc",
      num: pcNum,
      vendor: parsed.data.sectionUnit,
      total: parsed.data.totalRequiredAmount,
      invoiceCount: parsed.data.items.length,
      glCount: 0,
    });

    if (existingPcByNum.has(pcNum)) {
      summary.duplicates.push({
        kind: "pc",
        num: pcNum,
        vendor: parsed.data.sectionUnit,
      });
    }

    validated.push({ kind: "pc", num: pcNum, data: parsed.data });
  }

  if (mode === "preview") {
    return NextResponse.json({ summary });
  }

  // mode === "commit"
  const result: CommitResult = {
    inserted: 0,
    replaced: 0,
    skipped: 0,
    failed: [],
  };

  // Each entry runs in its own transaction so:
  // (a) a failure on one doesn't roll back successful imports earlier in
  //     the batch, and
  // (b) we don't blow Prisma's default 5s interactive transaction window
  //     when bulk-replacing many records.
  for (const entry of validated) {
    if (entry.kind === "pv") {
      const exists = existingPvByNum.has(entry.num);
      if (exists && onConflict === "skip") {
        result.skipped++;
        continue;
      }
      try {
        const data = entry.data;
        await prisma.$transaction(async (tx) => {
          if (exists) await tx.pV.delete({ where: { pvNum: entry.num } });
          await tx.pV.create({
            data: {
              pvNum: data.pvNum,
              businessArea: data.businessArea,
              agency: data.agency,
              vendor: data.vendor,
              date: data.date,
              notes: data.notes,
              currency: data.currency,
              exchangeRate: data.exchangeRate,
              preparedById: data.preparedById ?? null,
              verifiedById: data.verifiedById ?? null,
              authorisedByOneId: data.authorisedByOneId ?? null,
              authorisedByTwoId: data.authorisedByTwoId ?? null,
              poNum: data.poNum ?? null,
              paymentMethod: data.paymentMethod,
              parkedDate: data.parkedDate ?? null,
              postingDate: data.postingDate ?? null,
              clearingDocNum: data.clearingDocNum ?? null,
              clearingDocDate: data.clearingDocDate ?? null,
              transferNum: data.transferNum ?? null,
              invoices: {
                create: data.invoices.map((invoice) => ({
                  comments: invoice.comments,
                  documentNum: invoice.documentNum ?? null,
                  invoiceNumber: invoice.invoiceNumber ?? null,
                  invoiceDate: invoice.invoiceDate ?? null,
                  invoiceTotal: invoice.invoiceTotal,
                  glDetails: {
                    create: invoice.glDetails.map((gl) => ({
                      code: gl.code,
                      fund: gl.fund,
                      amount: gl.amount,
                    })),
                  },
                })),
              },
            },
          });
        });
        if (exists) result.replaced++;
        else result.inserted++;
      } catch (err) {
        result.failed.push({
          kind: "pv",
          num: entry.num,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    } else {
      // kind === "pc"
      const exists = existingPcByNum.has(entry.num);
      if (exists && onConflict === "skip") {
        result.skipped++;
        continue;
      }
      try {
        const data = entry.data;
        await prisma.$transaction(async (tx) => {
          if (exists) {
            // PettyCashStaff rows are FK-referenced from PettyCash but
            // aren't cascade-deleted, so collect their ids first, detach,
            // delete the parent, then clean them up. (Same dance as the
            // tRPC delete handler.)
            const existing = await tx.pettyCash.findUnique({
              where: { pettyCashNum: entry.num },
              select: {
                id: true,
                handledById: true,
                procurementApprovedById: true,
                budgetCheckedById: true,
                balanceHandedOverById: true,
                balanceCollectedById: true,
              },
            });
            const roleIds = existing
              ? [
                  existing.handledById,
                  existing.procurementApprovedById,
                  existing.budgetCheckedById,
                  existing.balanceHandedOverById,
                  existing.balanceCollectedById,
                ].filter((id): id is string => Boolean(id))
              : [];
            await tx.pettyCash.delete({
              where: { pettyCashNum: entry.num },
            });
            if (roleIds.length > 0) {
              await tx.pettyCashStaff.deleteMany({
                where: { id: { in: roleIds } },
              });
            }
          }
          await tx.pettyCash.create({
            data: {
              pettyCashNum: data.pettyCashNum,
              date: data.date,
              formNum: data.formNum,
              sectionUnit: data.sectionUnit,
              totalRequiredAmount: data.totalRequiredAmount,
              glCode: data.glCode,
              parkedDate: data.parkedDate ?? null,
              postingDate: data.postingDate ?? null,
              items: {
                create: data.items.map((it) => ({
                  qty: it.qty,
                  name: it.name,
                })),
              },
            },
          });
        });
        if (exists) result.replaced++;
        else result.inserted++;
      } catch (err) {
        result.failed.push({
          kind: "pc",
          num: entry.num,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  // Surface invalid entries as failures too so the user sees the complete
  // picture on the result screen.
  for (const inv of summary.invalid) {
    result.failed.push({ kind: inv.kind, num: inv.num, error: inv.error });
  }

  return NextResponse.json({ result });
}
