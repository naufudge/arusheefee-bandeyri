import { z } from "zod";

// GL Detail schema
export const glDetailSchema = z.object({
  id: z.string().cuid().optional(),
  code: z.coerce.number().int().gt(100000),
  fund: z.string().default("C-GOM"),
  amount: z.coerce.number().positive().multipleOf(0.01),
});

// Invoice schema
export const invoiceSchema = z.object({
  id: z.string().cuid().optional(),
  comments: z.string().min(10),
  documentNum: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.coerce.date().optional().nullable(),
  invoiceTotal: z.coerce.number().positive().multipleOf(0.01),
  glDetails: z.array(glDetailSchema).min(1),
});

// Create PV schema - accepts staff IDs
export const createPvSchema = z.object({
  pvNum: z.string().min(6),
  businessArea: z.coerce.number().int().default(1506),
  agency: z.string().default("National Archives of Maldives"),
  vendor: z.string().min(1),
  date: z.coerce.date(),
  notes: z.string().min(10),
  currency: z.string().default("MVR"),
  exchangeRate: z.coerce.number().positive().default(1),

  // Staff foreign keys (IDs)
  preparedById: z.string().cuid().optional().nullable(),
  verifiedById: z.string().cuid().optional().nullable(),
  authorisedByOneId: z.string().cuid().optional().nullable(),
  authorisedByTwoId: z.string().cuid().optional().nullable(),

  // Nested invoices with GL details
  invoices: z.array(invoiceSchema).min(1),

  // Payment details
  poNum: z.string().optional().nullable(),
  paymentMethod: z.string().min(1),
  parkedDate: z.coerce.date().optional().nullable(),
  postingDate: z.coerce.date().optional().nullable(),
  clearingDocNum: z.string().optional().nullable(),
  clearingDocDate: z.coerce.date().optional().nullable(),
  transferNum: z.string().optional().nullable(),
});

// Update PV schema - same as create
export const updatePvSchema = createPvSchema;

// Get PV by pvNum
export const getPvByNumSchema = z.object({
  pvNum: z.string().min(1),
});

// Delete PV
export const deletePvSchema = z.object({
  pvNum: z.string().min(1),
});

// Year filter schema
export const yearFilterSchema = z.object({
  year: z.string().regex(/^\d{4}$/, "Year must be 4 digits"),
});

// Types
export type GLDetailInput = z.infer<typeof glDetailSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type CreatePvInput = z.infer<typeof createPvSchema>;
export type UpdatePvInput = z.infer<typeof updatePvSchema>;
export type GetPvByNumInput = z.infer<typeof getPvByNumSchema>;
export type DeletePvInput = z.infer<typeof deletePvSchema>;
export type YearFilterInput = z.infer<typeof yearFilterSchema>;
