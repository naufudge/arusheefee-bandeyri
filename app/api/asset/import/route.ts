import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { parseAssetWorkbook } from "@/lib/assetWorkbook";

type ValidEntry = {
  num: string;
  sheet: string;
  assetName: string;
  category: string;
  subcategory: string | null;
  assetType: string | null;
};
type DuplicateEntry = { num: string; sheet: string; assetName: string };
type InFileDuplicateEntry = {
  num: string;
  sheet: string;
  rowNumber: number;
  // The sheet/row where this asset number first appeared (the one kept).
  firstSheet: string;
  firstRow: number;
};

type CommitResult = {
  inserted: number;
  replaced: number;
  skipped: number;
  // Breakdown of `skipped` so the UI can explain it.
  skippedExisting: number;
  skippedInFileDuplicate: number;
  failed: { num: string; sheet: string; error: string }[];
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.ASSET_IMPORT)) {
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
  const mode = formData.get("mode");
  const onConflict = formData.get("onConflict") ?? "skip";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (mode !== "preview" && mode !== "commit") {
    return NextResponse.json(
      { error: "mode must be 'preview' or 'commit'" },
      { status: 400 },
    );
  }
  if (mode === "commit" && onConflict !== "skip" && onConflict !== "replace") {
    return NextResponse.json(
      { error: "onConflict must be 'skip' or 'replace'" },
      { status: 400 },
    );
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

  const parsed = parseAssetWorkbook(workbook);

  // Which of the valid asset numbers already exist in the DB?
  const uniqueNums = Array.from(new Set(parsed.entries.map((e) => e.num)));
  const existing =
    uniqueNums.length > 0
      ? await prisma.asset.findMany({
          where: { assetNum: { in: uniqueNums } },
          select: { assetNum: true },
        })
      : [];
  const existingSet = new Set(existing.map((a) => a.assetNum));

  const valid: ValidEntry[] = parsed.entries.map((e) => ({
    num: e.num,
    sheet: e.sheet,
    assetName: e.data.assetName,
    category: e.data.category,
    subcategory: e.data.subcategory ?? null,
    assetType: e.data.assetType ?? null,
  }));

  // Asset numbers that appear more than once in the file. Only the first
  // occurrence imports; later ones are skipped (assetNum is unique). The
  // preview surfaces these so "N skipped" isn't a mystery.
  const firstSeen = new Map<string, { sheet: string; row: number }>();
  const inFileDuplicates: InFileDuplicateEntry[] = [];
  for (const e of parsed.entries) {
    const first = firstSeen.get(e.num);
    if (first) {
      inFileDuplicates.push({
        num: e.num,
        sheet: e.sheet,
        rowNumber: e.rowNumber,
        firstSheet: first.sheet,
        firstRow: first.row,
      });
    } else {
      firstSeen.set(e.num, { sheet: e.sheet, row: e.rowNumber });
    }
  }

  // Distinct asset numbers, split into already-in-DB vs new.
  const distinctNums = Array.from(firstSeen.keys());
  const existingCount = distinctNums.filter((n) => existingSet.has(n)).length;
  const newCount = distinctNums.length - existingCount;

  // DB duplicates, de-duplicated to one row per asset number (the first).
  const duplicates: DuplicateEntry[] = distinctNums
    .filter((n) => existingSet.has(n))
    .map((n) => {
      const v = valid.find((x) => x.num === n)!;
      return { num: n, sheet: v.sheet, assetName: v.assetName };
    });

  const summary = {
    sheetsProcessed: parsed.sheetsProcessed,
    sheetsSkipped: parsed.sheetsSkipped,
    totalRows: parsed.totalRows,
    valid,
    invalid: parsed.invalid,
    duplicates,
    inFileDuplicates,
    categoryFallbacks: parsed.categoryFallbacks,
    categoryNormalizations: parsed.categoryNormalizations,
    counts: {
      distinct: distinctNums.length,
      newCount,
      existingCount,
      inFileDuplicateCount: inFileDuplicates.length,
    },
  };

  if (mode === "preview") {
    return NextResponse.json({ summary });
  }

  // ----- commit -----
  const result: CommitResult = {
    inserted: 0,
    replaced: 0,
    skipped: 0,
    skippedExisting: 0,
    skippedInFileDuplicate: 0,
    failed: [],
  };

  // Process in order; an assetNum appearing on two sheets is handled once
  // (subsequent occurrences are skipped). Each entry runs in its own
  // transaction so one failure doesn't roll back the batch and we stay under
  // Prisma's interactive-transaction window on a large workbook.
  const processed = new Set<string>();
  for (const entry of parsed.entries) {
    if (processed.has(entry.num)) {
      result.skipped++;
      result.skippedInFileDuplicate++;
      continue;
    }
    processed.add(entry.num);

    const exists = existingSet.has(entry.num);
    if (exists && onConflict === "skip") {
      result.skipped++;
      result.skippedExisting++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (exists) {
          await tx.asset.delete({ where: { assetNum: entry.num } });
        }
        await tx.asset.create({ data: entry.data });
      });
      if (exists) result.replaced++;
      else result.inserted++;
    } catch (err) {
      result.failed.push({
        num: entry.num,
        sheet: entry.sheet,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Surface schema-invalid rows on the result screen too.
  for (const inv of parsed.invalid) {
    result.failed.push({ num: inv.num, sheet: inv.sheet, error: inv.error });
  }

  return NextResponse.json({ result });
}
