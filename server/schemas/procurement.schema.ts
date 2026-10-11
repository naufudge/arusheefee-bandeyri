import { z } from "zod";
import { PROCUREMENT_DOC_TYPES } from "@/lib/procurement";

export const procurementDocTypeSchema = z.enum(PROCUREMENT_DOC_TYPES);

const fields = {
  title: z.string().trim().min(1, "Give the procurement a title").max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
};

export const createProcurementSchema = z.object(fields);

export const updateProcurementSchema = z.object({
  id: z.string().min(1),
  ...fields,
});

export const procurementIdSchema = z.object({ id: z.string().min(1) });

export const linkCandidatesSchema = z.object({ type: procurementDocTypeSchema });

export const linkDocumentSchema = z.object({
  procurementId: z.string().min(1),
  type: procurementDocTypeSchema,
  docId: z.string().min(1),
});

export const unlinkDocumentSchema = z.object({
  type: procurementDocTypeSchema,
  docId: z.string().min(1),
});
