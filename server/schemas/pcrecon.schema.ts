import { z } from "zod";

// Create a Petty Cash Reconciliation Report. Items are NOT part of the input —
// they are derived server-side from the week's petty cash records.
export const createPcReconSchema = z.object({
  reportNum: z.string().min(1),
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  periodText: z.string().min(1),

  // Manual cash-composition figures (the grand total is computed, not stored).
  openingBalance: z.coerce.number().default(0),
  cashInHand: z.coerce.number().default(0),
  redepositAcc1155: z.coerce.number().default(0),
  staffWages: z.coerce.number().default(0),
  foodAllowance: z.coerce.number().default(0),
  heldInCheque: z.coerce.number().default(0),
  totalPayable: z.coerce.number().default(0),
  total: z.coerce.number().default(0),
  cashHeld: z.coerce.number().default(0),
  chequeHeld: z.coerce.number().default(0),

  // Staff foreign keys
  preparedById: z.string().cuid().optional().nullable(),
  checkedById: z.string().cuid().optional().nullable(),
  authorizedById: z.string().cuid().optional().nullable(),
});

export const updatePcReconSchema = createPcReconSchema;

export const getPcReconByNumSchema = z.object({
  reportNum: z.string().min(1),
});

export const deletePcReconSchema = z.object({
  reportNum: z.string().min(1),
});

export const pcReconWorkflowActionSchema = z.object({
  reportNum: z.string().min(1),
});

export const rejectPcReconSchema = z.object({
  reportNum: z.string().min(1),
  comment: z.string().trim().max(1000).optional(),
});

// Fetch one petty cash record's items (for the reconciliation detail editor).
export const recordItemsSchema = z.object({
  pettyCashNum: z.string().min(1),
});

// Update a petty cash record's item Dhivehi names from the reconciliation form.
// `reportNum` (edit view) lets the server also sync that report's snapshot row.
export const setRecordItemDhivehiSchema = z.object({
  pettyCashNum: z.string().min(1),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        nameDhivehi: z.string().trim().max(500),
      }),
    )
    .min(1),
  reportNum: z.string().min(1).optional(),
});

// Structured "what's missing" issues returned by the send-preflight check so
// the client can render a friendly checklist with deep links.
export type GateIssue =
  | { type: "petty_cash_missing_dhivehi"; pettyCashNum: string; itemNames: string[] }
  | {
      type: "staff_missing_dhivehi";
      role: "preparedBy" | "checkedBy" | "authorizedBy";
      staffId: string;
      name: string;
    };

export type CreatePcReconInput = z.infer<typeof createPcReconSchema>;
export type UpdatePcReconInput = z.infer<typeof updatePcReconSchema>;
export type GetPcReconByNumInput = z.infer<typeof getPcReconByNumSchema>;
export type DeletePcReconInput = z.infer<typeof deletePcReconSchema>;
export type PcReconWorkflowActionInput = z.infer<
  typeof pcReconWorkflowActionSchema
>;
export type RejectPcReconInput = z.infer<typeof rejectPcReconSchema>;
export type SetRecordItemDhivehiInput = z.infer<
  typeof setRecordItemDhivehiSchema
>;
