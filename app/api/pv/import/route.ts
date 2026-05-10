import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { createPvSchema, type CreatePvInput } from "@/server/schemas/pv.schema";

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

type PreviewSummary = {
  totalRows: number;
  pvCount: number;
  valid: {
    pvNum: string;
    vendor: string;
    total: number;
    invoiceCount: number;
    glCount: number;
  }[];
  invalid: { pvNum: string; error: string; rowNumbers: number[] }[];
  duplicates: { pvNum: string; vendor: string }[];
};

type CommitResult = {
  inserted: number;
  replaced: number;
  skipped: number;
  failed: { pvNum: string; error: string }[];
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

function denormalizePvNum(raw: string): string {
  const trimmed = raw.trim();
  // Strip leading "1506/" prefix if present
  const withoutPrefix = trimmed.replace(/^1506\//, "");
  // Replace remaining "/" with "-"
  return withoutPrefix.replace(/\//g, "-");
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
    const pvNumRaw = cellToString(row.getCell(colOf("pvNum")).value).trim();
    if (!pvNumRaw) continue; // skip blank rows

    rows.push({
      rowNumber: r,
      date: parseDate(row.getCell(colOf("date")).value),
      pvNum: denormalizePvNum(pvNumRaw),
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

export async function POST(request: NextRequest) {
  // Auth + permission gate
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.PV_IMPORT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const buffer = Buffer.from(await file.arrayBuffer());
    await workbook.xlsx.load(buffer);
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
  const rows = parseRows(worksheet, headerResult.headerMap);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No data rows found in the file" },
      { status: 400 }
    );
  }

  // Group by pvNum
  const pvGroups = new Map<string, RawRow[]>();
  for (const row of rows) {
    const arr = pvGroups.get(row.pvNum) ?? [];
    arr.push(row);
    pvGroups.set(row.pvNum, arr);
  }

  // Existing PV numbers in DB
  const existingPvs = await prisma.pV.findMany({
    where: { pvNum: { in: Array.from(pvGroups.keys()) } },
    select: { pvNum: true, vendor: true },
  });
  const existingByNum = new Map(existingPvs.map((p) => [p.pvNum, p]));

  // Validate each PV via createPvSchema
  const summary: PreviewSummary = {
    totalRows: rows.length,
    pvCount: pvGroups.size,
    valid: [],
    invalid: [],
    duplicates: [],
  };

  type ValidatedPv = {
    pvNum: string;
    data: CreatePvInput;
  };
  const validatedPvs: ValidatedPv[] = [];

  for (const [pvNum, groupRows] of Array.from(pvGroups.entries())) {
    const { candidate, rowNumbers } = buildPv(groupRows);
    const parsed = createPvSchema.safeParse(candidate);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const path = firstIssue.path.join(".") || "(root)";
      summary.invalid.push({
        pvNum,
        error: `${path}: ${firstIssue.message}`,
        rowNumbers,
      });
      continue;
    }

    const totalValue = parsed.data.invoices.reduce(
      (s, i) => s + i.invoiceTotal,
      0
    );
    summary.valid.push({
      pvNum,
      vendor: parsed.data.vendor,
      total: totalValue,
      invoiceCount: parsed.data.invoices.length,
      glCount: parsed.data.invoices.reduce(
        (s, i) => s + i.glDetails.length,
        0
      ),
    });

    if (existingByNum.has(pvNum)) {
      summary.duplicates.push({ pvNum, vendor: parsed.data.vendor });
    }

    validatedPvs.push({ pvNum, data: parsed.data });
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

  // Each PV runs in its own transaction so:
  // (a) a failure on one doesn't roll back successful imports earlier in the batch
  // (b) we don't blow Prisma's default 5s interactive transaction window when
  //     bulk-replacing many PVs.
  for (const { pvNum, data } of validatedPvs) {
    const exists = existingByNum.has(pvNum);

    if (exists && onConflict === "skip") {
      result.skipped++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (exists) {
          // Replace: cascade delete then create
          await tx.pV.delete({ where: { pvNum } });
        }
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
        pvNum,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Invalid PVs from preview show as failures in the commit result too,
  // so the user sees a complete picture.
  for (const inv of summary.invalid) {
    result.failed.push({ pvNum: inv.pvNum, error: inv.error });
  }

  return NextResponse.json({ result });
}
