import { z } from "zod";

// Create Asset schema. Only assetNum / assetName / category / assetType are
// required; the rest are blank or "-" in much of the source register, so
// they're optional. category/assetType are kept lenient (no taxonomy refine)
// so messy import rows warn rather than hard-reject.
export const createAssetSchema = z.object({
  assetNum: z.string().min(1),
  SAPassetNum: z.string().optional().nullable(),
  assetName: z.string().min(1),
  modelNum: z.string().optional().nullable(),
  manufacturerId: z.string().optional().nullable(),
  classification: z.string().optional().nullable(),

  previousLocation: z.string().optional().nullable(),
  presentLocation: z.string().optional().nullable(),

  date: z.coerce.date().optional().nullable(),
  datePrecision: z.enum(["YEAR", "FULL"]).default("YEAR"),

  price: z.coerce.number().nonnegative().optional().nullable(),
  condition: z.string().optional().nullable(),

  category: z.string().min(1),
  assetType: z.string().min(1),
});

// Update mirrors create. assetNum is the key and is not changed on update.
export const updateAssetSchema = createAssetSchema;

export const getAssetByNumSchema = z.object({
  assetNum: z.string().min(1),
});

export const deleteAssetSchema = z.object({
  assetNum: z.string().min(1),
});

// Input for suggesting the next running item number within a number prefix.
// The agency code is fixed server-side; the caller supplies the 2-digit year
// and the resolved category/subcategory/type (+ optional variant) numbers.
export const nextItemSchema = z.object({
  yy: z.string().regex(/^\d{2}$/),
  mainNum: z.coerce.number().int().nonnegative(),
  subNum: z.coerce.number().int().nonnegative(),
  typeNum: z.coerce.number().int().nonnegative(),
  variantNum: z.coerce.number().int().nonnegative().optional().nullable(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type NextItemInput = z.infer<typeof nextItemSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type GetAssetByNumInput = z.infer<typeof getAssetByNumSchema>;
export type DeleteAssetInput = z.infer<typeof deleteAssetSchema>;
