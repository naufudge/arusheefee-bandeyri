import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { cellToString, cellToNumber, parseDate } from "@/lib/excel";
import ExcelJS from "exceljs";

// Sheet1 column positions (A–I). Everything from J onward is scratch and is
// never read.
const COL = {
  no: 1, // A
  code: 2, // B
  date: 3, // C
  formNo: 4, // D
  name: 5, // E (a person — no home in the model, ignored)
  details: 6, // F
  received: 7, // G
  paid: 8, // H
  balance: 9, // I
} as const;

const PC_NUM_RE = /^PC\/(\d+)\/\d{4}$/;

type ParsedRow = {
  rowNumber: number;
  pettyCashNum: string;
  glCode: number;
  date: Date;
  totalRequiredAmount: number;
  details: string;
};

type InvalidRow = { num: string; error: string; row: number };

// Read one worksheet row into a petty-cash record candidate, or null if the
// row isn't a petty-cash expense line (header, opening balance, reimbursement,
// or blank). Reimbursements (PC/00 or a Received value) and opening balances
// (no PC number) are skipped here by design.
function readRow(
  row: ExcelJS.Row,
  rowNumber: number,
): { ok: true; data: ParsedRow } | { ok: false; invalid?: InvalidRow } {
  // Normalise to slashes for the PC-number check (the sheet may use either).
  const slashed = cellToString(row.getCell(COL.formNo).value)
    .trim()
    .replace(/-/g, "/");
  // Stored form uses dashes, e.g. PC/20/2026 → PC-20-2026.
  const storedNum = slashed.replace(/\//g, "-");
  const paid = cellToNumber(row.getCell(COL.paid).value);

  const m = slashed.match(PC_NUM_RE);
  // Not a petty-cash expense row → silently skip (header / opening / reimbursement).
  if (!m || Number(m[1]) <= 0 || paid === null) {
    return { ok: false };
  }

  if (paid <= 0) {
    return {
      ok: false,
      invalid: { num: storedNum, error: "Paid amount must be positive", row: rowNumber },
    };
  }

  const date = parseDate(row.getCell(COL.date).value);
  if (!date) {
    return {
      ok: false,
      invalid: { num: storedNum, error: "Missing or invalid date", row: rowNumber },
    };
  }

  const glCode = cellToNumber(row.getCell(COL.code).value);
  const details = cellToString(row.getCell(COL.details).value).trim();

  return {
    ok: true,
    data: {
      rowNumber,
      pettyCashNum: storedNum,
      glCode: glCode ?? 0,
      date,
      totalRequiredAmount: paid,
      details,
    },
  };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.PETTYCASH_IMPORT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request: expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  const mode = formData.get("mode") === "commit" ? "commit" : "preview";
  const onConflict = formData.get("onConflict") === "replace" ? "replace" : "skip";
  const requestedSheet =
    typeof formData.get("sheet") === "string"
      ? (formData.get("sheet") as string)
      : "";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  try {
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(Buffer.from(arrayBuffer) as unknown as Buffer);
  } catch {
    return NextResponse.json(
      { error: "Could not read the file. Is it a valid .xlsx?" },
      { status: 400 },
    );
  }

  const sheetNames = workbook.worksheets.map((w) => w.name);
  if (sheetNames.length === 0) {
    return NextResponse.json(
      { error: "Workbook has no worksheets" },
      { status: 400 },
    );
  }

  let worksheet: ExcelJS.Worksheet | undefined;
  if (requestedSheet) {
    worksheet = workbook.getWorksheet(requestedSheet);
    if (!worksheet) {
      return NextResponse.json(
        { error: `Sheet "${requestedSheet}" not found in the workbook.` },
        { status: 400 },
      );
    }
  } else if (sheetNames.length === 1) {
    worksheet = workbook.worksheets[0];
  } else {
    // Multiple sheets and none chosen yet — ask the client to pick one.
    return NextResponse.json({ needsSheet: true, sheets: sheetNames });
  }

  // Walk every row; the row filter naturally skips the 2-row header, the
  // opening-balance row, and reimbursement rows.
  const parsed: ParsedRow[] = [];
  const invalid: InvalidRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    const res = readRow(row, rowNumber);
    if (res.ok) parsed.push(res.data);
    else if (res.invalid) invalid.push(res.invalid);
  });

  // Last-one-wins on duplicate pettyCashNum within the file itself.
  const byNum = new Map<string, ParsedRow>();
  for (const p of parsed) byNum.set(p.pettyCashNum, p);
  const rows = Array.from(byNum.values());

  const existing = await prisma.pettyCash.findMany({
    where: { pettyCashNum: { in: rows.map((r) => r.pettyCashNum) } },
    select: { pettyCashNum: true },
  });
  const existingSet = new Set(existing.map((e) => e.pettyCashNum));

  if (mode === "preview") {
    return NextResponse.json({
      summary: {
        totalRows: parsed.length,
        valid: rows.map((r) => ({
          num: r.pettyCashNum,
          details: r.details,
          total: r.totalRequiredAmount,
        })),
        invalid,
        duplicates: rows
          .filter((r) => existingSet.has(r.pettyCashNum))
          .map((r) => ({ num: r.pettyCashNum })),
      },
    });
  }

  // ----- Commit -----
  let inserted = 0;
  let replaced = 0;
  let skipped = 0;
  const failed: { num: string; error: string }[] = [];

  for (const r of rows) {
    const isDuplicate = existingSet.has(r.pettyCashNum);
    if (isDuplicate && onConflict === "skip") {
      skipped += 1;
      continue;
    }

    const data = {
      pettyCashNum: r.pettyCashNum,
      date: r.date,
      // Fields the registry sheet doesn't carry are left blank.
      formNum: "",
      sectionUnit: "",
      totalRequiredAmount: r.totalRequiredAmount,
      glCode: r.glCode,
      items: r.details
        ? { create: [{ qty: 1, name: r.details }] }
        : undefined,
      // Imported records are approved by the system — no individual
      // signatories. Treated as fully approved everywhere.
      systemApproved: true,
    };

    try {
      if (isDuplicate) {
        // Replace: clear the old record (cascades items + approvalEvents)
        // plus any role rows, then recreate.
        const old = await prisma.pettyCash.findUnique({
          where: { pettyCashNum: r.pettyCashNum },
        });
        const roleIds = old
          ? [
              old.handledById,
              old.procurementApprovedById,
              old.budgetCheckedById,
              old.balanceHandedOverById,
              old.balanceCollectedById,
            ].filter((id): id is string => Boolean(id))
          : [];
        await prisma.$transaction(async (tx) => {
          await tx.pettyCash.delete({
            where: { pettyCashNum: r.pettyCashNum },
          });
          if (roleIds.length > 0) {
            await tx.pettyCashStaff.deleteMany({ where: { id: { in: roleIds } } });
          }
          await tx.pettyCash.create({ data });
        });
        replaced += 1;
      } else {
        await prisma.pettyCash.create({ data });
        inserted += 1;
      }
    } catch (err) {
      failed.push({
        num: r.pettyCashNum,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    result: { inserted, replaced, skipped, failed },
  });
}
