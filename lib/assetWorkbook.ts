/**
 * Pure (DB-free) helpers for reading and writing the multi-sheet asset
 * register workbook. Kept separate from the API routes so the parsing /
 * layout logic is unit-testable and shared between import and export.
 */
import ExcelJS from "exceljs";
import { cellToString, cellToNumber, parseDate, formatExcelDate } from "@/lib/excel";
import {
  findCategoryForType,
  findCategoryForSubcategory,
  findSubcategoryForType,
  isLeafSubcategory,
  normalizeCategoryLabel,
} from "@/lib/constants/assetCategories";
import {
  createAssetSchema,
  type CreateAssetInput,
} from "@/server/schemas/asset.schema";

// How far down a sheet to look for the "Catergory:" line and the column
// header row (their position varies between sheets — usually rows 6–14).
const SCAN_LIMIT = 30;

export type HeaderKey =
  | "assetNum"
  | "SAPassetNum"
  | "assetName"
  | "modelNum"
  | "manufacturerId"
  | "classification"
  | "previousLocation"
  | "presentLocation"
  | "date"
  | "price"
  | "condition";

// Header text (lowercased, trimmed) → field key. "#" and "QR" are ignored.
const HEADER_TO_KEY: Record<string, HeaderKey> = {
  "asset number": "assetNum",
  "sap asset no.": "SAPassetNum",
  "sap asset no": "SAPassetNum",
  "sap asset number": "SAPassetNum",
  "asset name & description": "assetName",
  "asset name and description": "assetName",
  "asset name": "assetName",
  "model number": "modelNum",
  "model no.": "modelNum",
  "model no": "modelNum",
  "manufacturer id": "manufacturerId",
  "classification": "classification",
  "previous location": "previousLocation",
  "present location": "presentLocation",
  "date": "date",
  "price": "price",
  "condition": "condition",
};

// Column headers, in order, for export. Mirrors the source sheets minus the
// QR column (which we don't model). The leading "#" is a running ordinal.
export const ASSET_COLUMNS = [
  "#",
  "Asset Number",
  "SAP Asset No.",
  "Asset Name & Description",
  "Model number",
  "Manufacturer ID",
  "Classification",
  "Previous Location",
  "Present Location",
  "Date",
  "Price",
  "Condition",
] as const;

export type ParsedEntry = {
  num: string;
  sheet: string;
  rowNumber: number;
  data: CreateAssetInput;
};
export type InvalidEntry = {
  num: string;
  sheet: string;
  error: string;
  rowNumber: number;
};
export type CategoryFallback = {
  sheet: string;
  assetType: string;
  category: string;
};
// A sheet whose hand-typed "Catergory:" label was cleaned/canonicalised on read.
export type CategoryNormalization = {
  sheet: string;
  raw: string;
  category: string;
};
export type ParseResult = {
  sheetsProcessed: number;
  sheetsSkipped: number;
  totalRows: number;
  entries: ParsedEntry[];
  invalid: InvalidEntry[];
  categoryFallbacks: CategoryFallback[];
  categoryNormalizations: CategoryNormalization[];
};

// Parse the "Date" cell into a stored DateTime + precision. Most cells are a
// bare year (2015); some are dd.mm.yyyy or native Excel dates.
export function parseAssetDate(value: ExcelJS.CellValue): {
  date: Date | null;
  datePrecision: "YEAR" | "FULL";
} {
  if (value instanceof Date) return { date: value, datePrecision: "FULL" };
  const s = cellToString(value).trim();
  if (!s) return { date: null, datePrecision: "YEAR" };
  if (/^\d{4}$/.test(s)) {
    return { date: new Date(Date.UTC(Number(s), 0, 1)), datePrecision: "YEAR" };
  }
  const parsed = parseDate(value);
  if (parsed) return { date: parsed, datePrecision: "FULL" };
  return { date: null, datePrecision: "YEAR" };
}

// Locate the column-header row (the one carrying "Asset Number") within the
// first SCAN_LIMIT rows, and map known headers to their column numbers.
function findHeaderRow(
  ws: ExcelJS.Worksheet,
): { rowIndex: number; map: Map<HeaderKey, number> } | null {
  const limit = Math.min(ws.rowCount, SCAN_LIMIT);
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    let hasAssetNumber = false;
    const map = new Map<HeaderKey, number>();
    row.eachCell((cell, col) => {
      const text = cellToString(cell.value).trim().toLowerCase();
      const key = HEADER_TO_KEY[text];
      if (key && !map.has(key)) map.set(key, col);
      if (text === "asset number") hasAssetNumber = true;
    });
    if (hasAssetNumber && map.has("assetNum")) {
      return { rowIndex: r, map };
    }
  }
  return null;
}

// Read the category from a "Catergory:" / "Category:" line near the top.
function findCategoryLabel(ws: ExcelJS.Worksheet): string | null {
  const limit = Math.min(ws.rowCount, SCAN_LIMIT);
  for (let r = 1; r <= limit; r++) {
    const row = ws.getRow(r);
    let found: string | null = null;
    row.eachCell((cell) => {
      if (found) return;
      const text = cellToString(cell.value).trim();
      const m = text.match(/^cat[ae]rgory\s*:\s*(.+)$/i);
      if (m) found = m[1].trim();
    });
    if (found) return found;
  }
  return null;
}

/**
 * Walk every worksheet, parse and Zod-validate each data row into an Asset
 * candidate. Title-only / header-less sheets are skipped (not errors). No DB
 * access — duplicate detection happens in the caller.
 */
export function parseAssetWorkbook(workbook: ExcelJS.Workbook): ParseResult {
  let sheetsProcessed = 0;
  let sheetsSkipped = 0;
  let totalRows = 0;
  const entries: ParsedEntry[] = [];
  const invalid: InvalidEntry[] = [];
  const categoryFallbacks: CategoryFallback[] = [];
  const categoryNormalizations: CategoryNormalization[] = [];

  for (const ws of workbook.worksheets) {
    const assetType = ws.name.trim();
    const header = findHeaderRow(ws);
    if (!header) {
      sheetsSkipped++;
      continue;
    }
    sheetsProcessed++;

    // Resolve category: the sheet's "Catergory:" line (cleaned/canonicalised) →
    // taxonomy lookup by type → "Uncategorised" (flagged for the preview).
    const rawCategory = findCategoryLabel(ws);
    let category: string | null;
    if (rawCategory) {
      const norm = normalizeCategoryLabel(rawCategory);
      category = norm.category;
      if (norm.category !== rawCategory) {
        categoryNormalizations.push({
          sheet: ws.name,
          raw: rawCategory,
          category: norm.category,
        });
      }
    } else {
      category =
        findCategoryForType(assetType) ??
        findCategoryForSubcategory(assetType) ??
        null;
      if (!category) {
        category = "Uncategorised";
        categoryFallbacks.push({ sheet: ws.name, assetType, category });
      }
    }

    // Resolve the subcategory from the sheet's type. A sheet named after a
    // type-less subcategory becomes that subcategory with no leaf type.
    let subcategory: string | null = null;
    let leafType: string | null = assetType;
    if (category) {
      subcategory = findSubcategoryForType(category, assetType) ?? null;
      if (!subcategory && isLeafSubcategory(category, assetType)) {
        subcategory = assetType;
        leafType = null;
      }
    }

    const colOf = (k: HeaderKey) => header.map.get(k);
    const assetNumCol = colOf("assetNum")!;

    for (let r = header.rowIndex + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const assetNum = cellToString(row.getCell(assetNumCol).value).trim();
      if (!assetNum) continue; // blank / trailing rows
      totalRows++;

      const str = (k: HeaderKey): string => {
        const col = colOf(k);
        return col ? cellToString(row.getCell(col).value).trim() : "";
      };
      const opt = (k: HeaderKey): string | null => {
        const v = str(k);
        return v === "" || v === "-" ? null : v;
      };
      const priceCol = colOf("price");
      const price = priceCol ? cellToNumber(row.getCell(priceCol).value) : null;
      const dateCol = colOf("date");
      const { date, datePrecision } = dateCol
        ? parseAssetDate(row.getCell(dateCol).value)
        : { date: null, datePrecision: "YEAR" as const };

      const candidate = {
        assetNum,
        SAPassetNum: opt("SAPassetNum"),
        assetName: str("assetName"),
        modelNum: opt("modelNum"),
        manufacturerId: opt("manufacturerId"),
        classification: opt("classification"),
        previousLocation: opt("previousLocation"),
        presentLocation: opt("presentLocation"),
        date,
        datePrecision,
        price: price ?? null,
        condition: opt("condition"),
        category,
        subcategory,
        assetType: leafType,
      };

      const parsed = createAssetSchema.safeParse(candidate);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue.path.join(".") || "(root)";
        invalid.push({
          num: assetNum,
          sheet: ws.name,
          error: `${path}: ${issue.message}`,
          rowNumber: r,
        });
        continue;
      }

      entries.push({
        num: assetNum,
        sheet: ws.name,
        rowNumber: r,
        data: parsed.data,
      });
    }
  }

  return {
    sheetsProcessed,
    sheetsSkipped,
    totalRows,
    entries,
    invalid,
    categoryFallbacks,
    categoryNormalizations,
  };
}

// ----- Export -----

// Excel sheet names: ≤31 chars, must not contain []:*?/\ , can't be blank or
// duplicated. Sanitise while keeping the real type for the "Type:" header row.
function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
  if (!base) base = "Sheet";
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    n++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export type ExportableAsset = {
  assetNum: string;
  SAPassetNum: string | null;
  assetName: string;
  modelNum: string | null;
  manufacturerId: string | null;
  classification: string | null;
  previousLocation: string | null;
  presentLocation: string | null;
  date: Date | null;
  datePrecision: "YEAR" | "FULL";
  price: number | null;
  condition: string | null;
  category: string;
  subcategory: string | null;
  assetType: string | null;
};

function dateCell(asset: ExportableAsset): string | number {
  if (!asset.date) return "";
  const d = new Date(asset.date);
  if (asset.datePrecision === "FULL") return formatExcelDate(d);
  return d.getUTCFullYear();
}

/**
 * Build the multi-sheet workbook: one worksheet per asset type, each with the
 * org title block, "Catergory:" / "Type:" lines, the column header row, and
 * the data rows — matching the source register's structure for a lossless
 * round-trip with parseAssetWorkbook.
 */
export function buildAssetWorkbook(assets: ExportableAsset[]): ExcelJS.Workbook {
  const groups = new Map<string, ExportableAsset[]>();
  for (const a of assets) {
    // Type-less subcategories have no `assetType`; group them under the
    // subcategory so they export to their own sheet (the "Type:" row + sheet
    // name) and round-trip back to that subcategory on import.
    const key = a.assetType || a.subcategory || "Uncategorised";
    const arr = groups.get(key) ?? [];
    arr.push(a);
    groups.set(key, arr);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Arusheefee Bandeyri";
  workbook.created = new Date();

  const usedNames = new Set<string>();

  // Always emit at least one sheet so the file is a valid workbook.
  if (groups.size === 0) {
    workbook.addWorksheet("Asset Register");
    return workbook;
  }

  for (const [assetType, rows] of groups) {
    const category = rows[0]?.category || "Uncategorised";
    const ws = workbook.addWorksheet(safeSheetName(assetType, usedNames));

    ws.getCell("A1").value = "National Archives of Maldives";
    ws.getCell("A2").value = "Male', Rep. of Maldives";
    ws.getCell("A4").value = "Asset Register";
    // Reproduce the source's "Catergory" spelling for byte-stable round-trips.
    ws.getCell("A6").value = `Catergory: ${category}`;
    ws.getCell("A7").value = `Type: ${assetType}`;
    ws.getCell("A1").font = { bold: true, size: 13 };
    ws.getCell("A4").font = { bold: true };
    ws.getCell("A6").font = { bold: true };
    ws.getCell("A7").font = { bold: true };

    const headerRowIdx = 9;
    const headerRow = ws.getRow(headerRowIdx);
    ASSET_COLUMNS.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
    });
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    rows.forEach((a, i) => {
      const row = ws.getRow(headerRowIdx + 1 + i);
      row.getCell(1).value = i + 1;
      row.getCell(2).value = a.assetNum;
      row.getCell(3).value = a.SAPassetNum ?? "";
      row.getCell(4).value = a.assetName;
      row.getCell(5).value = a.modelNum ?? "";
      row.getCell(6).value = a.manufacturerId ?? "";
      row.getCell(7).value = a.classification ?? "";
      row.getCell(8).value = a.previousLocation ?? "";
      row.getCell(9).value = a.presentLocation ?? "";
      row.getCell(10).value = dateCell(a);
      row.getCell(11).value = a.price ?? "";
      row.getCell(12).value = a.condition ?? "";
    });

    const widths = [5, 22, 14, 36, 14, 16, 14, 26, 26, 12, 12, 12];
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
  }

  return workbook;
}

// ----- "FA register" export -----

// Headers for the finance "FA register" layout (Asset Register 2026.xlsx), in
// the same left-to-right order as the source sheet. Spelling is reproduced
// verbatim (the "remaks" typo and the double space in "Asset Portal  Use Only")
// to match the format exactly. The "Code Number" is broken out into one labelled
// column per asset-number segment (the source sheet kept the code in component
// columns). Only the columns marked below are populated from the current data
// model; the finance-only columns are intentionally left blank.
export const FA_REGISTER_COLUMNS = [
  // Code Number, broken down on "-" (433-YY-main-sub-type[-variant]-item).
  "Agency",
  "Year",
  "Category",
  "Sub-Cat",
  "Type",
  "Variant",
  "Item",
  "Name of item",
  "Item name (Description)",
  "Serial Number",
  "Model",
  "Finance code",
  "GL Code",
  "Location",
  "Section",
  "Date acquired",
  "Price(MVR)",
  "Purchase Year",
  "Asset Number",
  "Asset Creation form No",
  "PO number",
  "Vendor",
  "life",
  "remaks",
  "Asset Portal  Use Only",
] as const;

// Split a structured asset number (433-YY-main-sub-type[-variant]-item) into its
// labelled segments. Raw string tokens are kept (preserving zero-padding like
// "02"). The last segment is always the running item number and the optional
// variant only exists with 7+ segments, so Item keeps its own column either way.
function splitAssetCode(assetNum: string): {
  agency: string;
  year: string;
  category: string;
  subCat: string;
  type: string;
  variant: string;
  item: string;
} {
  const parts = (assetNum ?? "").trim().split("-");
  const n = parts.length;
  const at = (i: number) => parts[i] ?? "";
  return {
    agency: at(0),
    year: at(1),
    category: at(2),
    subCat: at(3),
    // Type-less subcategories have 5 parts (no type segment); the item is the
    // last part. Typed assets have 6, or 7 with a variant.
    type: n >= 6 ? at(4) : "",
    variant: n >= 7 ? at(5) : "",
    item: n >= 5 ? parts[n - 1] : "",
  };
}

/**
 * Build the single-sheet "FA register" workbook. Mirrors the layout of
 * Asset Register 2026.xlsx: one flat "FA register" sheet with a frozen header
 * row. Columns we don't store (Code Number, Serial Number, Finance/GL code,
 * Section, PO number, Vendor, life, remaks, etc.) are left empty so the file
 * is a ready-to-fill template. The caller decides which assets to include
 * (a single year or all).
 */
export function buildFaRegisterWorkbook(
  assets: ExportableAsset[],
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Arusheefee Bandeyri";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("FA register");
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const headerRow = ws.getRow(1);
  FA_REGISTER_COLUMNS.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Code segments are stored as numbers (so "02" -> 2); blank/non-numeric
  // tokens stay as-is so nothing is lost on odd legacy numbers.
  const numOrBlank = (s: string): number | string =>
    s === "" ? "" : /^\d+$/.test(s) ? Number(s) : s;

  assets.forEach((a, i) => {
    const row = ws.getRow(2 + i);
    const code = splitAssetCode(a.assetNum);
    // Column numbers are 1-based and follow FA_REGISTER_COLUMNS order.
    row.getCell(1).value = numOrBlank(code.agency); // Agency
    row.getCell(2).value = numOrBlank(code.year); // Year
    row.getCell(3).value = numOrBlank(code.category); // Category
    row.getCell(4).value = numOrBlank(code.subCat); // Sub-Cat
    row.getCell(5).value = numOrBlank(code.type); // Type
    row.getCell(6).value = numOrBlank(code.variant); // Variant
    row.getCell(7).value = numOrBlank(code.item); // Item
    row.getCell(8).value = a.assetName; // Name of item
    row.getCell(11).value = a.modelNum ?? ""; // Model
    row.getCell(14).value = a.presentLocation ?? ""; // Location
    row.getCell(16).value = dateCell(a); // Date acquired
    row.getCell(17).value = a.price ?? ""; // Price(MVR)
    row.getCell(18).value = a.date // Purchase Year
      ? new Date(a.date).getUTCFullYear()
      : "";
    row.getCell(19).value = a.SAPassetNum ?? ""; // Asset Number (SAP asset no.)
  });

  // Narrow for the code-segment columns, wide for the name + location columns.
  const widths = [
    9, 7, 10, 9, 8, 9, 7, 34, 34, 16, 16, 14, 12, 28, 18, 14, 12, 12, 22, 18,
    14, 18, 8, 24, 14,
  ];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  return workbook;
}
