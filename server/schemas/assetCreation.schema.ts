import { z } from "zod";
import { FORM_NUM_FORMAT, MAX_FORMS } from "@/lib/asset-creation";
import { assetClassByCode } from "@/lib/asset-classes";

const staffId = z.string().cuid().optional().nullable();
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const coding = z.string().trim().min(1).max(100);

// One printed form of the set: its number and, once created in SAP, its SAP
// asset number.
export const assetCreationFormSchema = z.object({
  formNum: z
    .string()
    .trim()
    .regex(FORM_NUM_FORMAT, "Must be in the format 1506/2026/009"),
  sapAssetNum: optionalText(30),
});

const assetCreationFields = {
  requestType: z.enum(["CREATE", "AMEND", "DELETE", "BLOCK"]).default("CREATE"),

  agencyName: coding,
  businessArea: coding,
  costCentre: coding,
  fund: coding,
  functionalArea: coding,

  description1: z.string().trim().min(1, "Enter the description").max(200),
  description2: optionalText(200),
  useOfAsset: optionalText(300),
  location: z.string().trim().min(1, "Enter where the asset will be used").max(200),
  quantity: z.coerce.number().int().min(1, "At least 1 piece").max(10000),
  requestedAssetClass: z
    .string()
    .trim()
    .refine((code) => !!assetClassByCode(code), "Choose the asset class"),

  vendor: optionalText(200),
  manufacturer: optionalText(200),
  purchasedNew: z.boolean().default(true),
  acquisitionDate: z.coerce.date().optional().nullable(),
  acquisitionPrecision: z.enum(["YEAR", "FULL"]).default("YEAR"),
  commenceDate: z.coerce.date().optional().nullable(),
  countryOfOrigin: optionalText(100),
  brand: optionalText(200),
  originalValue: z.coerce.number().nonnegative().optional().nullable(),

  usefulLifeYears: z.coerce.number().int().min(0).max(100).optional().nullable(),
  usefulLifeReason: optionalText(500),

  registerCategory: optionalText(200),
  registerSubcategory: optionalText(200),
  registerAssetType: optionalText(200),

  requestedById: staffId,
  authorizedById: staffId,
  sapUpdatedById: staffId,

  forms: z
    .array(assetCreationFormSchema)
    .min(1, "Add at least one form")
    .max(MAX_FORMS, `At most ${MAX_FORMS} forms in one set`)
    .refine(
      (forms) => new Set(forms.map((f) => f.formNum)).size === forms.length,
      "Each form needs its own number",
    ),
};

export const createAssetCreationSchema = z.object({
  ...assetCreationFields,
  // Create it already linked to a procurement (from the procurement page).
  procurementId: z.string().min(1).optional().nullable(),
});

// Form numbers may change on edit, so the set is identified by its id.
export const updateAssetCreationSchema = z.object({
  id: z.string().min(1),
  ...assetCreationFields,
});

// Any of the set's form numbers finds it.
export const assetCreationByNumSchema = z.object({
  formNum: z.string().min(1),
});

export const nextFormNumsSchema = z.object({
  count: z.number().int().min(1).max(MAX_FORMS),
});

export const sapUpdateSchema = z.object({
  formNum: z.string().min(1),
  assetClass: z
    .string()
    .trim()
    .refine((code) => !!assetClassByCode(code), "Choose the asset class"),
  sapAssetNums: z
    .array(
      z.object({
        formId: z.string().min(1),
        sapAssetNum: z.string().trim().min(1, "Enter the SAP asset number").max(30),
      }),
    )
    .min(1),
});

export const rejectAssetCreationSchema = z.object({
  formNum: z.string().min(1),
  comment: z.string().trim().max(1000).optional(),
});

export type CreateAssetCreationInput = z.infer<typeof createAssetCreationSchema>;
export type UpdateAssetCreationInput = z.infer<typeof updateAssetCreationSchema>;
