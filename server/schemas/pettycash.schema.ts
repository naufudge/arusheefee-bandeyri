import { z } from "zod";

// One signed/approved role on a petty cash request.
export const pettyCashStaffSchema = z.object({
  staffId: z.string().cuid(),
  amount: z.coerce.number().nonnegative().multipleOf(0.01).optional().nullable(),
  isApproved: z.coerce.boolean().default(false),
  date: z.coerce.date(),
});

// A line item: qty + name (no price — total is on the parent record).
// Either the English `name` or the Dhivehi `nameDhivehi` must be filled.
export const pettyCashItemSchema = z
  .object({
    qty: z.coerce.number().int().positive(),
    name: z.string().optional().nullable(),
    nameDhivehi: z.string().optional().nullable(),
  })
  .refine(
    (it) =>
      (it.name?.trim() ?? "") !== "" || (it.nameDhivehi?.trim() ?? "") !== "",
    { message: "Enter an English or Dhivehi item name", path: ["name"] },
  );

// Petty cash numbers are PC-<seq>-<year>, e.g. "PC-20-2026" — the same
// dash format imported records use. Enforced on create paths; the update
// schema below loosens this so any legacy record can still be edited
// without first being renamed.
export const PETTY_CASH_NUM_FORMAT = /^PC-\d+-\d{4}$/;
const pettyCashNumStrict = z
  .string()
  .regex(PETTY_CASH_NUM_FORMAT, "Must be in the format PC-20-2026");

// Create petty cash schema. Each role is optional so a draft can be saved
// before all five signatures land.
export const createPettyCashSchema = z.object({
  pettyCashNum: pettyCashNumStrict,
  date: z.coerce.date(),
  formNum: z.string().min(1),
  sectionUnit: z.string().min(1),
  totalRequiredAmount: z.coerce.number().nonnegative().multipleOf(0.01),
  glCode: z.coerce.number().int(),

  // Permission-gated on update (see router).
  parkedDate: z.coerce.date().optional().nullable(),
  postingDate: z.coerce.date().optional().nullable(),

  handledBy: pettyCashStaffSchema.optional().nullable(),
  procurementApprovedBy: pettyCashStaffSchema.optional().nullable(),
  budgetCheckedBy: pettyCashStaffSchema.optional().nullable(),
  balanceHandedOverBy: pettyCashStaffSchema.optional().nullable(),
  balanceCollectedBy: pettyCashStaffSchema.optional().nullable(),

  items: z.array(pettyCashItemSchema).min(1),
});

// Update reuses every create field except the strict format on
// `pettyCashNum`. The mutation uses pettyCashNum only as the WHERE clause
// to find the record — it can't actually rename anything — so loosening
// here is safe and lets edits flow through for legacy entries.
export const updatePettyCashSchema = createPettyCashSchema.extend({
  pettyCashNum: z.string().min(1),
});

export const getPettyCashByNumSchema = z.object({
  pettyCashNum: z.string().min(1),
});

export const deletePettyCashSchema = z.object({
  pettyCashNum: z.string().min(1),
});

// Reuse the same year filter shape PV uses.
export const yearFilterSchema = z.object({
  year: z.string().regex(/^\d{4}$/, "Year must be 4 digits"),
});

// ----- Approval workflow inputs -----
// Petty Cash approvals are independent per role (any order). The role enum
// matches the constants in `server/lib/approval.ts`; keep them in sync.

export const pcRoleSchema = z.enum([
  "handledBy",
  "procurementApprovedBy",
  "budgetCheckedBy",
  "balanceHandedOverBy",
  "balanceCollectedBy",
]);

export const approveRoleSchema = z.object({
  pettyCashNum: z.string().min(1),
  role: pcRoleSchema,
});

export const rejectRoleSchema = z.object({
  pettyCashNum: z.string().min(1),
  role: pcRoleSchema,
  comment: z.string().trim().max(1000).optional(),
});

export type PettyCashStaffInput = z.infer<typeof pettyCashStaffSchema>;
export type PettyCashItemInput = z.infer<typeof pettyCashItemSchema>;
export type CreatePettyCashInput = z.infer<typeof createPettyCashSchema>;
export type UpdatePettyCashInput = z.infer<typeof updatePettyCashSchema>;
export type GetPettyCashByNumInput = z.infer<typeof getPettyCashByNumSchema>;
export type DeletePettyCashInput = z.infer<typeof deletePettyCashSchema>;
export type PCRoleSchemaInput = z.infer<typeof pcRoleSchema>;
export type ApproveRoleInput = z.infer<typeof approveRoleSchema>;
export type RejectRoleInput = z.infer<typeof rejectRoleSchema>;
