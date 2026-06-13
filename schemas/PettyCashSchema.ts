import { z } from "zod";

// One signed/approved role on the form. `name` doubles as "is this role
// filled in" — empty name = the role hasn't been assigned yet, and the
// submit handler omits the row entirely.
const roleSchema = z.object({
  name: z.string().optional().or(z.literal("")),
  designation: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().nonnegative().optional().nullable(),
  isApproved: z.boolean().default(false),
  date: z.date(),
});

// Strict slash format for new petty cash entries. The base schema below
// stays lenient so the same form can re-load legacy records (PC-N-YYYY)
// for editing without tripping validation; the create page picks the
// stricter variant explicitly.
export const PETTY_CASH_NUM_FORMAT = /^PC\/\d+\/\d{4}$/;
const pettyCashNumStrict = z
  .string()
  .regex(PETTY_CASH_NUM_FORMAT, "Must be in the format PC/01/2025");

export const PettyCashSchema = z.object({
  pettyCashNum: z.string().min(1),
  date: z.date(),
  formNum: z.string().min(1),
  sectionUnit: z.string().min(1),
  totalRequiredAmount: z.coerce.number().nonnegative().multipleOf(0.01),
  glCode: z.coerce.number().int(),

  parkedDate: z.date().optional().nullable(),
  postingDate: z.date().optional().nullable(),

  handledBy: roleSchema,
  procurementApprovedBy: roleSchema,
  budgetCheckedBy: roleSchema,
  balanceHandedOverBy: roleSchema,
  balanceCollectedBy: roleSchema,

  items: z
    .array(
      z
        .object({
          qty: z.coerce.number().int().positive(),
          name: z.string().optional().nullable(),
          nameDhivehi: z.string().optional().nullable(),
        })
        .refine(
          (it) =>
            (it.name?.trim() ?? "") !== "" ||
            (it.nameDhivehi?.trim() ?? "") !== "",
          { message: "Enter an English or Dhivehi item name", path: ["name"] },
        ),
    )
    .min(1),
});

export const PettyCashCreateSchema = PettyCashSchema.extend({
  pettyCashNum: pettyCashNumStrict,
});

export type PettyCashValues = z.infer<typeof PettyCashSchema>;
export type PettyCashRoleName =
  | "handledBy"
  | "procurementApprovedBy"
  | "budgetCheckedBy"
  | "balanceHandedOverBy"
  | "balanceCollectedBy";
