import { z } from "zod";
import { EVAL_NUM_FORMAT, VENDOR_COUNT } from "@/lib/price-eval";

const staffId = z.string().cuid().optional().nullable();

// One of the three vendors. Quotes in a foreign currency are converted to
// MVR with `exchangeRate` (MVR per unit).
export const priceEvalVendorSchema = z.object({
  name: z.string().trim().max(120),
  currency: z.string().trim().min(3).max(3).default("MVR"),
  exchangeRate: z.coerce.number().positive().default(1),
  chargesGst: z.boolean().default(true),
  // Optional discount the vendor offers, % of their subtotal.
  discountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});

// An item with each vendor's unit price, by vendor position (null = not quoted).
export const priceEvalItemSchema = z.object({
  name: z.string().trim().min(1, "Enter the item or service").max(500),
  qty: z.coerce.number().positive("Quantity must be more than 0"),
  rates: z
    .array(z.coerce.number().nonnegative().nullable())
    .length(VENDOR_COUNT),
});

const priceEvalFields = {
  date: z.coerce.date(),
  section: z.string().trim().min(1, "Enter the requesting section").max(200),
  method: z.string().trim().min(1).max(100),
  glCode: z.coerce.number().int().gt(100000, "Select a budget code"),
  // The code's balance can be entered on the form; the budget checker
  // confirms or corrects it when they sign (see `budgetCheckSchema`).
  budgetBalance: z.coerce.number().optional().nullable(),

  vendors: z.array(priceEvalVendorSchema).length(VENDOR_COUNT),
  items: z.array(priceEvalItemSchema).min(1, "Add at least one item"),

  selectedVendor: z.number().int().min(0).max(VENDOR_COUNT - 1).optional().nullable(),
  selectionReason: z.string().trim().max(2000).optional().nullable(),

  preparedById: staffId,
  budgetCheckedById: staffId,
  checkedById: staffId,
  approvedById: staffId,
};

export const createPriceEvalSchema = z.object({
  evalNum: z
    .string()
    .trim()
    .regex(EVAL_NUM_FORMAT, "Must be in the format 2026-35"),
  ...priceEvalFields,
  // Create it already linked to a procurement (from the procurement page).
  procurementId: z.string().min(1).optional().nullable(),
});

// The number identifies the record and can't be changed on edit.
export const updatePriceEvalSchema = z.object({
  evalNum: z.string().min(1),
  ...priceEvalFields,
});

export const priceEvalByNumSchema = z.object({
  evalNum: z.string().min(1),
});

export const nextEvalNumSchema = z.object({
  year: z.number().int().min(2000).max(2100),
});

export const budgetCheckSchema = z.object({
  evalNum: z.string().min(1),
  budgetBalance: z.coerce.number(),
  budgetAvailable: z.boolean(),
});

export const rejectPriceEvalSchema = z.object({
  evalNum: z.string().min(1),
  comment: z.string().trim().max(1000).optional(),
});

export type CreatePriceEvalInput = z.infer<typeof createPriceEvalSchema>;
export type UpdatePriceEvalInput = z.infer<typeof updatePriceEvalSchema>;
