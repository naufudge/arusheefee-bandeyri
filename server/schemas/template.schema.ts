import { z } from "zod";

// Per-GL row inside a templated invoice. Numbers are accepted as-is
// (no positive/min checks) — a template is a stub, not a finished PV.
// The strict business rules (code > 100000, positive amount) are
// enforced by `glDetailSchema` in pv.schema.ts when the user actually
// submits the voucher.
const templateGlSchema = z.object({
  code: z.coerce.number().int().optional(),
  fund: z.string().optional(),
  amount: z.coerce.number().multipleOf(0.01).optional(),
});

// Per-invoice template entry. Same "stub, not voucher" philosophy:
// fields accept zero and empty values so users can template the
// shape without committing to numbers.
const templateInvoiceSchema = z.object({
  comments: z.string().optional(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.coerce.date().optional().nullable(),
  invoiceTotal: z.coerce.number().multipleOf(0.01).optional(),
  glDetails: z.array(templateGlSchema).optional(),
});

/**
 * The pre-defined PV fields a template stores. Every field is optional;
 * `pvNum` is intentionally absent so a template can never accidentally
 * pre-fill the PV number. Staff are referenced by ID (stable across
 * renames); dates are coerced from JSON strings on the wire.
 */
export const templateValuesSchema = z.object({
  businessArea: z.coerce.number().int().optional(),
  agency: z.string().optional(),
  vendor: z.string().optional(),
  date: z.coerce.date().optional().nullable(),
  notes: z.string().optional(),
  currency: z.string().optional(),
  // Same "stub" rule as the per-row numeric fields — accept any
  // numeric value; the PV submit path enforces positive.
  exchangeRate: z.coerce.number().optional(),

  poNum: z.string().optional().nullable(),
  paymentMethod: z.string().optional(),
  parkedDate: z.coerce.date().optional().nullable(),
  postingDate: z.coerce.date().optional().nullable(),
  clearingDocNum: z.string().optional().nullable(),
  clearingDocDate: z.coerce.date().optional().nullable(),
  transferNum: z.string().optional().nullable(),

  preparedById: z.string().cuid().optional().nullable(),
  verifiedById: z.string().cuid().optional().nullable(),
  authorisedByOneId: z.string().cuid().optional().nullable(),
  authorisedByTwoId: z.string().cuid().optional().nullable(),

  invoiceDetails: z.array(templateInvoiceSchema).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  values: templateValuesSchema,
});

export const updateTemplateSchema = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
  // Values are optional on update so the Settings page can rename a
  // template without re-sending the (potentially large) values blob.
  values: templateValuesSchema.optional(),
});

export const getTemplateSchema = z.object({ id: z.string().cuid() });
export const deleteTemplateSchema = z.object({ id: z.string().cuid() });

export type TemplateValues = z.infer<typeof templateValuesSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type GetTemplateInput = z.infer<typeof getTemplateSchema>;
export type DeleteTemplateInput = z.infer<typeof deleteTemplateSchema>;
