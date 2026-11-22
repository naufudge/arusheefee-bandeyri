import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { commitRegistryImport, prepareRegistryImport } from "@/server/lib/petty-cash-registry";
import ExcelJS from "exceljs";
import { z } from "zod";

const nameMapSchema = z.record(z.string().min(1).max(200), z.string().cuid()).refine(
  (m) => Object.keys(m).length <= 500,
  "Too many names",
);

// Imports the petty cash registry (Sheet1 of the org's workbook): a preview
// first, then a commit. Reading, checks and staff matching live in
// server/lib/petty-cash-registry.ts.
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

  // Sheet names (by nameKey) the user linked to staff in the preview.
  let nameMap: Record<string, string> = {};
  const rawMap = formData.get("nameMap");
  if (typeof rawMap === "string" && rawMap) {
    let json: unknown;
    try {
      json = JSON.parse(rawMap);
    } catch {
      json = null;
    }
    const parsed = nameMapSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid staff links for names" }, { status: 400 });
    }
    nameMap = parsed.data;
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

  // Hidden helper sheets (e.g. SAP's) aren't offered.
  const visible = workbook.worksheets.filter((w) => w.state === "visible");
  const sheetNames = visible.map((w) => w.name);
  if (sheetNames.length === 0) {
    return NextResponse.json(
      { error: "Workbook has no worksheets" },
      { status: 400 },
    );
  }

  let worksheet: ExcelJS.Worksheet | undefined;
  if (requestedSheet) {
    worksheet = visible.find((w) => w.name === requestedSheet);
    if (!worksheet) {
      return NextResponse.json(
        { error: `Sheet "${requestedSheet}" not found in the workbook.` },
        { status: 400 },
      );
    }
  } else if (sheetNames.length === 1) {
    worksheet = visible[0];
  } else {
    // Multiple sheets and none chosen yet — ask the client to pick one.
    return NextResponse.json({ needsSheet: true, sheets: sheetNames });
  }

  const found = await prepareRegistryImport(prisma, worksheet, nameMap);
  if (!found.ok) {
    return NextResponse.json({ error: found.error }, { status: 400 });
  }
  const { prepared } = found;

  if (mode === "preview") {
    return NextResponse.json({
      summary: {
        totalRows: prepared.totalRows,
        valid: prepared.rows.map((r) => ({
          num: r.pettyCashNum,
          details: r.details,
          total: r.totalRequiredAmount,
        })),
        invalid: prepared.invalid,
        duplicates: prepared.rows
          .filter((r) => prepared.existing.has(r.pettyCashNum))
          .map((r) => ({ num: r.pettyCashNum })),
        unmatchedNames: prepared.unmatchedNames,
      },
    });
  }

  const result = await commitRegistryImport(prisma, prepared, onConflict);
  return NextResponse.json({ result });
}
