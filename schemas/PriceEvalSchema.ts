import { z } from "zod";
import { EVAL_NUM_FORMAT, VENDOR_COUNT } from "@/lib/price-eval";

// Numbers are kept as text in the form so a blank rate can mean "not
// quoted" (rather than 0) and partly-typed values don't jump around.

/** Parses a form number; blank → null. Commas are allowed. */
export const toNumber = (s: string | null | undefined): number | null => {
  const t = (s ?? "").replace(/,/g, "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const blankOrPrice = (message: string) =>
  z.string().refine((s) => {
    if (s.trim() === "") return true;
    const n = toNumber(s);
    return n !== null && n >= 0;
  }, message);

const blankOrNumber = (message: string) =>
  z.string().refine((s) => s.trim() === "" || toNumber(s) !== null, message);

const blankOrPercent = (message: string) =>
  z.string().refine((s) => {
    if (s.trim() === "") return true;
    const n = toNumber(s);
    return n !== null && n >= 0 && n <= 100;
  }, message);

const positiveNumber = (message: string) =>
  z.string().refine((s) => {
    const n = toNumber(s);
    return n !== null && n > 0;
  }, message);

export const PriceEvalFormSchema = z.object({
  evalNum: z.string().trim().regex(EVAL_NUM_FORMAT, "Use the format 2026-35"),
  date: z.date({ message: "Pick a date" }),
  section: z.string().trim().min(1, "Enter the requesting section"),
  method: z.string().trim().min(1, "Enter how prices were evaluated"),
  glCode: z.number().int().gt(100000, "Select a budget code"),
  budgetBalance: blankOrNumber("Enter a number"),
  vendors: z
    .array(
      z.object({
        name: z.string(),
        currency: z.string().min(3),
        exchangeRate: positiveNumber("Enter the MVR rate"),
        chargesGst: z.boolean(),
        discountPercent: blankOrPercent("0–100%"),
      }),
    )
    .length(VENDOR_COUNT),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Enter the item or service"),
        qty: positiveNumber("More than 0"),
        rates: z.array(blankOrPrice("Enter a price")).length(VENDOR_COUNT),
      }),
    )
    .min(1, "Add at least one item"),
  selectedVendor: z.number().int().min(0).max(VENDOR_COUNT - 1).nullable(),
  selectionReason: z.string(),
  preparedById: z.string(),
  budgetCheckedById: z.string(),
  checkedById: z.string(),
  approvedById: z.string(),
});

export type PriceEvalFormValues = z.infer<typeof PriceEvalFormSchema>;
