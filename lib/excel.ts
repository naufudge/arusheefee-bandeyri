/**
 * Shared cell-coercion helpers for reading uploaded `.xlsx` files with
 * exceljs. Extracted from the PV import route so the asset import can reuse
 * the exact same parsing semantics (rich text, formula results, comma-laden
 * numbers, dd.mm.yyyy dates).
 */
import type ExcelJS from "exceljs";

/** Coerce any cell value to a plain string (rich text, formulas, dates included). */
export function cellToString(value: ExcelJS.CellValue): string {
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

/** Coerce a cell to a number, stripping thousands separators. Null if not numeric. */
export function cellToNumber(value: ExcelJS.CellValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "result" in value) {
    return cellToNumber(value.result as ExcelJS.CellValue);
  }
  const n = Number(cellToString(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Parse a cell into a Date. Accepts native dates and dd.mm.yyyy / dd/mm/yyyy. */
export function parseDate(value: ExcelJS.CellValue): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value;
  const s = cellToString(value).trim();
  if (!s) return null;

  // DD.MM.YYYY or DD/MM/YYYY (also tolerates "-" separators)
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

/** Format a Date as dd.mm.yyyy (the export convention). Empty string for null. */
export function formatExcelDate(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getUTCDate().toString().padStart(2, "0")}.${(d.getUTCMonth() + 1)
    .toString()
    .padStart(2, "0")}.${d.getUTCFullYear()}`;
}
