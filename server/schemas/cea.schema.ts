import { z } from "zod";
import { CEA_NUM_FORMAT } from "@/lib/cea";

const text = (max: number) => z.string().trim().max(max).optional().nullable();

// One table row. Item, qty and cost are ignored while the CEA takes them
// live from a price evaluation.
export const ceaItemSchema = z.object({
  description: text(500),
  qty: z.coerce.number().nonnegative().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
  onHand: text(100),
  acquired: text(100),
  condition: text(500),
  reason: text(1000),
});

const ceaFields = {
  date: z.coerce.date(),
  section: text(200),
  glCode: z.coerce.number().int().optional().nullable(),
  budgetBalance: z.coerce.number().optional().nullable(),
  feNameEn: text(200),
  feNameDv: text(200),
  feDesignationEn: text(200),
  feDesignationDv: text(200),
  // Who requests it, and so signs it in the app.
  requestedById: z.string().cuid().optional().nullable(),
  items: z.array(ceaItemSchema).max(50),
};

export const createCeaSchema = z.object({
  ceaNum: z.string().trim().regex(CEA_NUM_FORMAT, "Use the format (FRM)433-CA/433/2026/189"),
  ...ceaFields,
  // Create it already linked to a procurement (from the procurement page).
  procurementId: z.string().min(1).optional().nullable(),
});

// The number identifies the record and can't be changed on edit.
export const updateCeaSchema = z.object({
  ceaNum: z.string().min(1),
  ...ceaFields,
});

export const ceaByNumSchema = z.object({ ceaNum: z.string().min(1) });

export const nextCeaNumSchema = z.object({ year: z.number().int().min(2000).max(2100) });

export const ceaLiveSourceSchema = z.object({ procurementId: z.string().min(1) });

export type CreateCeaInput = z.infer<typeof createCeaSchema>;
