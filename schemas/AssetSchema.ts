import { z } from "zod";
import { ASSET_NUMBER_PATTERN } from "@/lib/assetNumber";
import { getSubcategories, isLeafSubcategory } from "@/lib/constants/assetCategories";

// Client-side form shape for an asset. The date is modelled as a precision
// flag plus either a 4-digit `year` (YEAR mode) or a full `date` (FULL mode);
// the form derives the stored DateTime on submit. `price` is kept as a string
// so an empty input stays empty (rather than coercing to 0) and is converted
// on submit.
//
// `subcategory`, `assetSubtype` and `numberYear` are transient UI-only fields
// (not persisted). The cascading selector lifts the subcategory and the
// 4th-level sub-type here so the number builder can read the full taxonomy
// path together; on submit the stored `assetType` becomes the leaf-most
// selection (`assetSubtype || assetType`). `numberYear` is the year used in
// the asset number (distinct from the Acquired `year`).
export const AssetSchema = z
  .object({
    assetNum: z.string().min(1, "Asset number is required"),
    SAPassetNum: z.string().optional(),
    assetName: z.string().min(1, "Asset name is required"),
    modelNum: z.string().optional(),
    manufacturerId: z.string().optional(),
    classification: z.string().optional(),

    previousLocation: z.string().optional(),
    presentLocation: z.string().optional(),

    datePrecision: z.enum(["YEAR", "FULL"]).default("YEAR"),
    year: z.string().optional(),
    date: z.date().optional().nullable(),

    price: z
      .string()
      .optional()
      .refine((v) => !v || !Number.isNaN(Number(v)), {
        message: "Price must be a number",
      }),
    condition: z.string().optional(),

    category: z.string().min(1, "Select a category"),
    // Type-less subcategories have no leaf type, so `assetType` is conditionally
    // required (see superRefine below). `subcategory` is persisted now.
    assetType: z.string().optional(),

    subcategory: z.string().optional(),
    // Transient (not sent to the server).
    assetSubtype: z.string().optional(),
    numberYear: z.string().optional(),
  })
  .refine(
    (v) => v.datePrecision !== "YEAR" || !v.year || /^\d{4}$/.test(v.year),
    { message: "Enter a 4-digit year", path: ["year"] },
  )
  .refine((v) => ASSET_NUMBER_PATTERN.test(v.assetNum.trim()), {
    message: "Use the format 433-YY-category-subcategory[-type]-item.",
    path: ["assetNum"],
  })
  .superRefine((v, ctx) => {
    if (!v.category) return;
    // Require a subcategory when the category has any.
    if (getSubcategories(v.category).length > 0 && !v.subcategory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a subcategory",
        path: ["subcategory"],
      });
      return;
    }
    // Require a type unless the chosen subcategory is type-less (a leaf).
    if (
      v.subcategory &&
      !isLeafSubcategory(v.category, v.subcategory) &&
      (!v.assetType || v.assetType.trim() === "")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a type",
        path: ["assetType"],
      });
    }
  });

export type AssetValues = z.infer<typeof AssetSchema>;
