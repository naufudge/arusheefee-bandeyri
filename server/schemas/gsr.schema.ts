import { z } from "zod";

// Line item on a GSR form
export const gsrItemSchema = z.object({
  id: z.string().cuid().optional(),
  particulars: z.string().min(1),
  requestedQty: z.coerce.number().int().min(1),
  issuedQty: z.coerce.number().int().nonnegative().optional().nullable(),
  rqdDate: z.coerce.date().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

// Create GSR schema - accepts staff IDs. `gsrFormNum` is entered manually
// (free-form, not auto-generated) and must be unique (enforced in the router).
export const createGsrSchema = z.object({
  gsrFormNum: z.string().min(1),
  section: z.string().min(1),
  date: z.coerce.date(),

  // Staff foreign keys (IDs)
  requestedById: z.string().cuid().optional().nullable(),
  authorizedById: z.string().cuid().optional().nullable(),
  receivedById: z.string().cuid().optional().nullable(),

  // Nested line items
  items: z.array(gsrItemSchema).min(1),
});

// Update GSR schema - same as create
export const updateGsrSchema = createGsrSchema;

// Get GSR by gsrFormNum
export const getGsrByNumSchema = z.object({
  gsrFormNum: z.string().min(1),
});

// Delete GSR
export const deleteGsrSchema = z.object({
  gsrFormNum: z.string().min(1),
});

// ----- Approval workflow inputs -----
// All workflow actions identify the target by gsrFormNum; the resolver
// enforces the state-machine transition + assignee gate.

export const gsrWorkflowActionSchema = z.object({
  gsrFormNum: z.string().min(1),
});

export const rejectGsrSchema = z.object({
  gsrFormNum: z.string().min(1),
  comment: z.string().trim().max(1000).optional(),
});

// Types
export type GsrItemInput = z.infer<typeof gsrItemSchema>;
export type CreateGsrInput = z.infer<typeof createGsrSchema>;
export type UpdateGsrInput = z.infer<typeof updateGsrSchema>;
export type GetGsrByNumInput = z.infer<typeof getGsrByNumSchema>;
export type DeleteGsrInput = z.infer<typeof deleteGsrSchema>;
export type GsrWorkflowActionInput = z.infer<typeof gsrWorkflowActionSchema>;
export type RejectGsrInput = z.infer<typeof rejectGsrSchema>;
