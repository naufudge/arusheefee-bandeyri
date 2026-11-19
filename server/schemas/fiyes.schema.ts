import { z } from "zod";
import {
  FIYES_FORM_CODES,
  enteredColumns,
  enteredLines,
  linesForms,
  rowsForms,
  type FiyesColumn,
  type FiyesKind,
  type FiyesLinesContent,
  type FiyesRowsContent,
} from "@/lib/fiyes";

const money = z.number().finite().nonnegative().max(1_000_000_000_000);
const year = z.number().int().min(2000).max(2100);
const staffId = z.string().cuid().nullable();

// ----- Entries: what's typed into each form (lines and rows) -----
// Built from the catalogue in lib/fiyes.ts. Each set accepts only its own
// forms, and each form only its own lines or columns (.strict()).

const signedAmount = z.number().finite().min(-1_000_000_000_000).max(1_000_000_000_000);

function columnSchema(c: FiyesColumn) {
  if (c.type === "money") return signedAmount;
  if (c.type === "currency") {
    return z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, `${c.header} must be a 3-letter code`);
  }
  const text = z.string().trim().max(c.type === "code" ? 50 : 300);
  return c.required ? text.min(1, `${c.header} is required`) : text;
}

function linesSchema(content: FiyesLinesContent) {
  const amount = content.nonNegative ? signedAmount.nonnegative() : signedAmount;
  const line = z.object(Object.fromEntries(content.amounts.map((a) => [a.key, amount.optional()]))).strict();
  return z.object(Object.fromEntries(enteredLines(content).map((l) => [l.key, line.optional()]))).strict();
}

function rowsSchema(content: FiyesRowsContent) {
  const row = z.object(Object.fromEntries(enteredColumns(content).map((c) => [c.key, columnSchema(c)]))).strict();
  return z.array(row).max(200, "A form takes up to 200 rows");
}

const entriesSchema = (kind: FiyesKind) =>
  z
    .object({
      lines: z
        .object(Object.fromEntries(linesForms(kind).map((f) => [f.code, linesSchema(f.content).optional()])))
        .strict()
        .default({}),
      rows: z
        .object(Object.fromEntries(rowsForms(kind).map((f) => [f.code, rowsSchema(f.content).optional()])))
        .strict()
        .default({}),
    })
    .strict()
    .default({});

export const fiyesPeriodSchema = z.object({
  period: z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/, "Invalid period"),
});

export const fiyesYearSchema = z.object({ year });

export const fiyesMonthSchema = z.object({ year, month: z.number().int().min(1).max(12) });

export const fiyesPayableSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Invoice number is required").max(100),
  invoiceDate: z.coerce.date(),
  vendorName: z.string().trim().min(1, "Vendor is required").max(200),
  vendorAccount: z.string().trim().min(1, "Vendor account is required").max(50),
  details: z.string().trim().min(1, "Details are required").max(300),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code"),
  exchangeRate: z.number().finite().positive().max(1_000_000),
  amount: money,
});

const common = {
  documentDate: z.coerce.date(),
  enteredById: staffId,
  approvedById: staffId,
};

// Each set carries only its own fields; .strict() makes the server reject
// payables on a monthly return or petty cash figures on a yearly one.
const monthlyFields = {
  kind: z.literal("MONTHLY"),
  ...common,
  pettyCashOpening: money.nullable(),
  pettyCashClosing: money.nullable(),
  entries: entriesSchema("MONTHLY"),
};
const yearlyFields = {
  kind: z.literal("YEARLY"),
  ...common,
  payables: z.array(fiyesPayableSchema).max(500),
  entries: entriesSchema("YEARLY"),
};

export const createFiyesSchema = z.discriminatedUnion("kind", [
  z.object({ ...monthlyFields, year, month: z.number().int().min(1).max(12) }).strict(),
  z.object({ ...yearlyFields, year }).strict(),
]);

// The period (and so the set) can't change once a return exists.
export const updateFiyesSchema = z.discriminatedUnion("kind", [
  z.object({ ...monthlyFields, ...fiyesPeriodSchema.shape }).strict(),
  z.object({ ...yearlyFields, ...fiyesPeriodSchema.shape }).strict(),
]);

export const rejectFiyesSchema = fiyesPeriodSchema.extend({
  comment: z.string().trim().max(1000).optional(),
});

export const fiyesFormSchema = fiyesPeriodSchema.extend({
  form: z.enum(FIYES_FORM_CODES),
});

export type CreateFiyesInput = z.infer<typeof createFiyesSchema>;
export type UpdateFiyesInput = z.infer<typeof updateFiyesSchema>;
export type FiyesPayableInput = z.infer<typeof fiyesPayableSchema>;
