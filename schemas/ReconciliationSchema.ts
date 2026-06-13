import { z } from "zod";

const userSchema = z.object({
  name: z.string().optional(),
  designation: z.string().optional(),
  // Embedded by the server PDF payload only (signature data URL); not set by
  // the create/edit form.
  signature: z.string().optional().nullable(),
});

const money = z.coerce.number().default(0);

// Form values for a Petty Cash Reconciliation Report. Line items are derived
// server-side from the week's petty cash records, so they're not part of the
// editable form.
export const ReconciliationSchema = z.object({
  reportNum: z.string().min(1),
  weekStart: z.date(),
  weekEnd: z.date(),
  periodText: z.string().min(1),

  // Manual cash-composition figures (grand total is computed in the form/PDF).
  openingBalance: money,
  cashInHand: money,
  redepositAcc1155: money,
  staffWages: money,
  foodAllowance: money,
  heldInCheque: money,
  totalPayable: money,
  total: money,
  cashHeld: money,
  chequeHeld: money,

  preparedBy: userSchema,
  checkedBy: userSchema,
  authorizedBy: userSchema,
});

export type ReconciliationValues = z.infer<typeof ReconciliationSchema>;
