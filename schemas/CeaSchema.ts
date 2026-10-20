import { z } from "zod";
import { CEA_NUM_FORMAT } from "@/lib/cea";
import { toNumber } from "./PriceEvalSchema";

// Numbers stay text in the form so a blank means "not entered" (not 0).
const blankOrAmount = (message: string) =>
  z.string().refine((s) => {
    if (s.trim() === "") return true;
    const n = toNumber(s);
    return n !== null && n >= 0;
  }, message);

export const CeaItemFormSchema = z.object({
  description: z.string().max(500),
  qty: blankOrAmount("Enter a quantity"),
  cost: blankOrAmount("Enter an amount"),
  onHand: z.string().max(100),
  acquired: z.string().max(100),
  condition: z.string().max(500),
  reason: z.string().max(1000),
});

export const CeaFormSchema = z.object({
  ceaNum: z.string().trim().regex(CEA_NUM_FORMAT, "Use the format (FRM)433-CA/433/2026/189"),
  date: z.date({ message: "Pick a date" }),
  section: z.string().max(200),
  /** 0 = none chosen. */
  glCode: z.number().int(),
  budgetBalance: z
    .string()
    .refine((s) => s.trim() === "" || toNumber(s) !== null, "Enter an amount"),
  feNameEn: z.string().max(200),
  feNameDv: z.string().max(200),
  feDesignationEn: z.string().max(200),
  feDesignationDv: z.string().max(200),
  /** Staff id; "" = none chosen. */
  requestedById: z.string(),
  items: z.array(CeaItemFormSchema).max(50, "A form takes up to 50 items"),
});

export type CeaFormValues = z.infer<typeof CeaFormSchema>;
export type CeaItemFormValues = z.infer<typeof CeaItemFormSchema>;
