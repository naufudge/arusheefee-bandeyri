import { z } from "zod";
import { FORM_NUM_FORMAT, MAX_FORMS } from "@/lib/asset-creation";
import { assetClassByCode, lvaProblem } from "@/lib/asset-classes";
import { toNumber } from "@/schemas/PriceEvalSchema";

// Client-side form shape for a set of asset creation forms. Numbers are kept
// as text so an empty input stays empty. The acquisition date uses the asset
// register's Year ⇄ Full date fields (`datePrecision` + `year` / `date`), and
// the register target uses its category fields, so the form can reuse
// AssetDateField and AssetCategorySelect.

const blankOrPrice = z.string().refine((s) => {
  if (s.trim() === "") return true;
  const n = toNumber(s);
  return n !== null && n >= 0;
}, "Enter an amount");

export const AssetCreationFormSchema = z
  .object({
    requestType: z.enum(["CREATE", "AMEND", "DELETE", "BLOCK"]),

    agencyName: z.string().trim().min(1, "Required"),
    businessArea: z.string().trim().min(1, "Required"),
    costCentre: z.string().trim().min(1, "Required"),
    fund: z.string().trim().min(1, "Required"),
    functionalArea: z.string().trim().min(1, "Required"),

    forms: z
      .array(
        z.object({
          formNum: z
            .string()
            .trim()
            .regex(FORM_NUM_FORMAT, "Use the format 1506/2026/009"),
          sapAssetNum: z.string(),
        }),
      )
      .min(1, "Add at least one form")
      .max(MAX_FORMS, `At most ${MAX_FORMS} forms in one set`),

    description1: z.string().trim().min(1, "Enter the description"),
    description2: z.string(),
    useOfAsset: z.string(),
    location: z.string().trim().min(1, "Enter where the asset will be used"),
    quantity: z.string().refine((s) => {
      const n = toNumber(s);
      return n !== null && Number.isInteger(n) && n >= 1;
    }, "At least 1 piece"),
    requestedAssetClass: z
      .string()
      .refine((code) => !!assetClassByCode(code), "Choose the asset class"),

    vendor: z.string(),
    manufacturer: z.string(),
    purchasedNew: z.boolean(),
    datePrecision: z.enum(["YEAR", "FULL"]),
    year: z.string().optional(),
    date: z.date().optional().nullable(),
    commenceDate: z.date().optional().nullable(),
    countryOfOrigin: z.string(),
    brand: z.string(),
    originalValue: blankOrPrice,

    usefulLifeYears: z.string().refine((s) => {
      if (s.trim() === "") return true;
      const n = toNumber(s);
      return n !== null && Number.isInteger(n) && n >= 0 && n <= 100;
    }, "Whole years, 0–100"),
    usefulLifeReason: z.string(),

    // Asset register target (Create requests).
    category: z.string(),
    subcategory: z.string().optional(),
    assetType: z.string().optional(),
    assetSubtype: z.string().optional(),

    requestedById: z.string(),
    authorizedById: z.string(),
    sapUpdatedById: z.string(),
  })
  .refine(
    (v) => v.datePrecision !== "YEAR" || !v.year || /^\d{4}$/.test(v.year),
    { message: "Enter a 4-digit year", path: ["year"] },
  )
  .refine(
    (v) => new Set(v.forms.map((f) => f.formNum.trim())).size === v.forms.length,
    { message: "Each form needs its own number", path: ["forms"] },
  )
  .refine(
    (v) => {
      const life = toNumber(v.usefulLifeYears);
      const def = assetClassByCode(v.requestedAssetClass)?.defaultLife;
      return life === null || def === undefined || life === def || v.usefulLifeReason.trim() !== "";
    },
    { message: "Give the reason for changing the default life", path: ["usefulLifeReason"] },
  )
  // A blank value can be saved in a draft; sending needs it.
  .superRefine((v, ctx) => {
    const value = toNumber(v.originalValue);
    const problem = value == null ? null : lvaProblem(v.requestedAssetClass, value);
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["requestedAssetClass"] });
  });

export type AssetCreationFormValues = z.infer<typeof AssetCreationFormSchema>;
