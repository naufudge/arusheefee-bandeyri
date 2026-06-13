import { z } from "zod";

const userSchema = z.object({
  name: z.string().optional(),
  designation: z.string().optional(),
  // Optional `data:image/...;base64,...` URL embedded by the server when
  // generating a PDF payload, only set for signatories whose approval
  // stage has been completed. Not produced by the create/edit form.
  signature: z.string().optional().nullable(),
});

export const GsrSchema = z.object({
  gsrFormNum: z.string().min(1),
  section: z.string().min(1),
  date: z.date(),

  items: z
    .array(
      z.object({
        particulars: z.string().min(1),
        requestedQty: z.coerce
          .number()
          .int()
          .min(1, "Requested quantity must be at least 1"),
        issuedQty: z.coerce.number().int().nonnegative().optional().nullable(),
        rqdDate: z.date().optional().nullable(),
        remarks: z.string().optional().nullable(),
      }),
    )
    .min(1),

  requestedBy: userSchema,
  authorizedBy: userSchema,
  receivedBy: userSchema,
});

export type GsrValues = z.infer<typeof GsrSchema>;
