import { z } from "zod";

// Government GL codes are 6-digit integers (e.g. 223004).
export const glCodeSchema = z.coerce
  .number()
  .int()
  .min(100000, "GL code must be 6 digits")
  .max(999999, "GL code must be 6 digits");

// Dhivehi texts are optional. `undefined` means "leave unchanged" on update;
// an empty string or null clears the field.
const dhivehiText = z.string().trim().max(255).nullish();

// Input for creating a GL account
export const createGlAccountSchema = z.object({
  code: glCodeSchema,
  shortTextEn: z.string().trim().min(1, "Short text (English) is required").max(100),
  longTextEn: z.string().trim().min(1, "Long text (English) is required").max(255),
  shortTextDv: dhivehiText,
  longTextDv: dhivehiText,
  pettyCashAllowed: z.boolean().default(false),
});

const glAccountIdSchema = z.number().int().positive();

// Input for updating a GL account, identified by id. The code can only be
// changed while no PV GL line or petty cash record uses the account (checked
// in the router), so codes on existing records never change.
export const updateGlAccountSchema = z.object({
  id: glAccountIdSchema,
  code: glCodeSchema.optional(),
  shortTextEn: z.string().trim().min(1, "Short text (English) is required").max(100).optional(),
  longTextEn: z.string().trim().min(1, "Long text (English) is required").max(255).optional(),
  shortTextDv: dhivehiText,
  longTextDv: dhivehiText,
  pettyCashAllowed: z.boolean().optional(),
});

// Input for deleting a GL account
export const deleteGlAccountSchema = z.object({
  id: glAccountIdSchema,
});

// Types
export type CreateGlAccountInput = z.infer<typeof createGlAccountSchema>;
export type UpdateGlAccountInput = z.infer<typeof updateGlAccountSchema>;
export type DeleteGlAccountInput = z.infer<typeof deleteGlAccountSchema>;
