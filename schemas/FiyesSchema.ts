import { z } from "zod";
import { toNumber } from "./PriceEvalSchema";
import {
  enteredColumns,
  enteredLines,
  linesForms,
  rowsForms,
  type FiyesColumn,
  type FiyesKind,
  type FiyesLinesContent,
  type FiyesRowsContent,
} from "@/lib/fiyes";

// Numbers stay text in the form so a blank means "not entered" (not 0).
const blankOrAmount = (message: string, nonNegative = true) =>
  z.string().refine((s) => {
    if (s.trim() === "") return true;
    const n = toNumber(s);
    return n !== null && (!nonNegative || n >= 0);
  }, message);

const amount = (message: string) =>
  z.string().refine((s) => {
    const n = toNumber(s);
    return n !== null && n >= 0;
  }, message);

export const FiyesPayableFormSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Enter the invoice number").max(100),
  // Null while a new row is blank. (Boolean() so TypeScript doesn't narrow
  // the form's type to never-null.)
  invoiceDate: z
    .date()
    .nullable()
    .refine((d) => Boolean(d), "Pick the invoice date"),
  vendorName: z.string().trim().min(1, "Enter the vendor").max(200),
  vendorAccount: z.string().trim().min(1, "Enter the vendor account").max(50),
  details: z.string().trim().min(1, "Enter what it was for").max(300),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a 3-letter code"),
  exchangeRate: z.string().refine((s) => (toNumber(s) ?? 0) > 0, "Enter the rate"),
  amount: amount("Enter the amount"),
});

// ----- Lines and rows of the other forms (catalogue in lib/fiyes.ts) -----

/** Form code → line key → amount key → amount as typed. */
export type FiyesLinesFormValues = Record<string, Record<string, Record<string, string>>>;
/** Form code → rows → column key → value as typed. */
export type FiyesRowsFormValues = Record<string, Record<string, string>[]>;

function columnFormSchema(c: FiyesColumn) {
  if (c.type === "money") return blankOrAmount("Enter an amount", false);
  if (c.type === "currency") return z.string().trim().regex(/^[A-Za-z]{3}$/, "Use a 3-letter code");
  const text = z.string().trim().max(c.type === "code" ? 50 : 300);
  return c.required ? text.min(1, `Enter the ${c.header.replace("*", "").toLowerCase()}`) : text;
}

const linesFormSchema = (content: FiyesLinesContent) => {
  const value = blankOrAmount(content.nonNegative ? "Enter an amount of 0 or more" : "Enter an amount", !!content.nonNegative);
  const line = z.object(Object.fromEntries(content.amounts.map((a) => [a.key, value])));
  return z.object(Object.fromEntries(enteredLines(content).map((l) => [l.key, line])));
};

const rowsFormSchema = (content: FiyesRowsContent) =>
  z
    .array(z.object(Object.fromEntries(enteredColumns(content).map((c) => [c.key, columnFormSchema(c)]))))
    .max(200, "A form takes up to 200 rows");

const KINDS: FiyesKind[] = ["MONTHLY", "YEARLY"];
const LINES_SCHEMAS = new Map(KINDS.flatMap((k) => linesForms(k).map((f) => [f.code, linesFormSchema(f.content)] as const)));
const ROWS_SCHEMAS = new Map(KINDS.flatMap((k) => rowsForms(k).map((f) => [f.code, rowsFormSchema(f.content)] as const)));

const pettyCashAmount = blankOrAmount("Enter an amount");
const payablesSchema = z.array(FiyesPayableFormSchema).max(500, "A return takes up to 500 payables");

export const FiyesFormSchema = z
  .object({
    kind: z.enum(["MONTHLY", "YEARLY"]),
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    documentDate: z.date({ message: "Pick a date" }),
    /** Staff ids; "" = none chosen. */
    enteredById: z.string(),
    approvedById: z.string(),
    // A draft may be saved without them; sending needs both.
    pettyCashOpening: z.string(),
    pettyCashClosing: z.string(),
    payables: z.array(z.custom<FiyesPayableFormValues>()),
    lines: z.custom<FiyesLinesFormValues>(),
    rows: z.custom<FiyesRowsFormValues>(),
  })
  // Only the set being filed is checked: the other set's fields are hidden
  // and not sent, so they mustn't block saving.
  .superRefine((v, ctx) => {
    const check = (schema: z.ZodTypeAny, value: unknown, path: (string | number)[]) => {
      const result = schema.safeParse(value);
      if (result.success) return;
      for (const issue of result.error.issues) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: [...path, ...issue.path] });
      }
    };
    if (v.kind === "MONTHLY") {
      check(pettyCashAmount, v.pettyCashOpening, ["pettyCashOpening"]);
      check(pettyCashAmount, v.pettyCashClosing, ["pettyCashClosing"]);
    } else {
      check(payablesSchema, v.payables, ["payables"]);
    }
    for (const f of linesForms(v.kind)) check(LINES_SCHEMAS.get(f.code)!, v.lines[f.code] ?? {}, ["lines", f.code]);
    for (const f of rowsForms(v.kind)) check(ROWS_SCHEMAS.get(f.code)!, v.rows[f.code] ?? [], ["rows", f.code]);
  });

export type FiyesFormValues = z.infer<typeof FiyesFormSchema>;
export type FiyesPayableFormValues = z.infer<typeof FiyesPayableFormSchema>;
