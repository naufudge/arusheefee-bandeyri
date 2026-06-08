"use client";

import React, { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAIN_CATEGORIES,
  getSubcategories,
  getTypeKeys,
  getSubtypes,
  getCategoryNumber,
  findSubcategoryForType,
} from "@/lib/constants/assetCategories";
import type { AssetValues } from "@/schemas/AssetSchema";

interface AssetCategorySelectProps {
  form: UseFormReturn<AssetValues>;
}

/**
 * Cascading Category → Subcategory → Type → Sub-type selector driven by the
 * static taxonomy. Writes `category` (main) and `assetType` (the L3 type) onto
 * the form; the optional 4th-level `assetSubtype` is lifted here too. The
 * subcategory and sub-type are UI-only intermediates — on submit the stored
 * `assetType` becomes the leaf-most selection. A "not listed" toggle lets
 * users enter a free-text type for assets outside the taxonomy.
 */
export const AssetCategorySelect: React.FC<AssetCategorySelectProps> = ({
  form,
}) => {
  const category = form.watch("category");
  const assetType = form.watch("assetType");
  // Subcategory and sub-type live on the form (transient) so the number
  // builder can read the full main/sub/type/sub-type path together. Edit-mode
  // pre-fill is set in AssetForm's defaults.
  const subcategory = form.watch("subcategory") ?? "";
  const assetSubtype = form.watch("assetSubtype") ?? "";
  const errors = form.formState.errors;

  // Manual-type mode: on by default when the stored type isn't in the taxonomy.
  const [manualType, setManualType] = useState<boolean>(
    () =>
      Boolean(category && assetType) &&
      !findSubcategoryForType(category, assetType),
  );

  const subcategories = category ? getSubcategories(category) : [];
  const types =
    category && subcategory ? getTypeKeys(category, subcategory) : [];
  // 4th-level sub-types under the chosen type (e.g. Phone → Telephone). Empty
  // for types with no finer breakdown, which hides the Sub-type dropdown.
  const subtypes =
    !manualType && category && subcategory && assetType
      ? getSubtypes(category, subcategory, assetType)
      : [];
  const hasSubtypes = subtypes.length > 0;

  const onCategoryChange = (value: string) => {
    form.setValue("category", value, { shouldValidate: true });
    form.setValue("subcategory", "");
    setManualType(false);
    form.setValue("assetType", "", { shouldValidate: true });
    form.setValue("assetSubtype", "");
  };

  const onSubcategoryChange = (value: string) => {
    form.setValue("subcategory", value);
    setManualType(false);
    form.setValue("assetType", "", { shouldValidate: true });
    form.setValue("assetSubtype", "");
  };

  const onTypeChange = (value: string) => {
    form.setValue("assetType", value, { shouldValidate: true });
    // A different type has its own (or no) sub-types — clear any prior choice.
    form.setValue("assetSubtype", "");
  };

  const onSubtypeChange = (value: string) => {
    form.setValue("assetSubtype", value);
  };

  const categoryNumber = category ? getCategoryNumber(category) : undefined;
  const typeNumber = assetType ? getCategoryNumber(assetType) : undefined;
  const subtypeNumber = assetSubtype
    ? getCategoryNumber(assetSubtype)
    : undefined;

  // Imported assets can carry a category whose spelling differs from the
  // taxonomy (the source register's "Catergory:" lines). Surface it as an
  // option so the dropdown still shows the stored value.
  const categoryOptions =
    category && !MAIN_CATEGORIES.includes(category)
      ? [category, ...MAIN_CATEGORIES]
      : MAIN_CATEGORIES;

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
      {/* Category */}
      <div className="space-y-2">
        <div className="flex min-h-5 items-center justify-between gap-2">
          <Label>
            Category <span className="text-destructive">*</span>
          </Label>
          {categoryNumber !== undefined && (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              #{categoryNumber}
            </span>
          )}
        </div>
        <Select value={category || undefined} onValueChange={onCategoryChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && (
          <p className="text-[0.8rem] font-light italic text-destructive">
            {errors.category.message}
          </p>
        )}
      </div>

      {/* Subcategory */}
      <div className="space-y-2">
        <div className="flex min-h-5 items-center">
          <Label>Subcategory</Label>
        </div>
        <Select
          value={subcategory || undefined}
          onValueChange={onSubcategoryChange}
          disabled={!category || subcategories.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                !category
                  ? "Pick a category first"
                  : subcategories.length === 0
                    ? "No subcategories"
                    : "Select a subcategory"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {subcategories.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type */}
      <div className={`space-y-2 ${hasSubtypes ? "" : "sm:col-span-2"}`}>
        <div className="flex min-h-5 items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <Label>
              Type <span className="text-destructive">*</span>
            </Label>
            {typeNumber !== undefined && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                #{typeNumber}
              </span>
            )}
          </div>
          {category && (
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={manualType}
                onChange={(e) => {
                  setManualType(e.target.checked);
                  form.setValue("assetType", "", { shouldValidate: true });
                  form.setValue("assetSubtype", "");
                }}
                className="size-3.5 rounded border-input accent-foreground"
              />
              Not listed? Enter manually
            </label>
          )}
        </div>

        {manualType ? (
          <Input
            placeholder="Type a custom asset type"
            value={assetType}
            onChange={(e) =>
              form.setValue("assetType", e.target.value, {
                shouldValidate: true,
              })
            }
          />
        ) : (
          <Select
            value={assetType || undefined}
            onValueChange={onTypeChange}
            disabled={!subcategory || types.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !subcategory
                    ? "Pick a subcategory first"
                    : types.length === 0
                      ? "No types — enter manually"
                      : "Select a type"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {errors.assetType && (
          <p className="text-[0.8rem] font-light italic text-destructive">
            {errors.assetType.message}
          </p>
        )}
      </div>

      {/* Sub-type (only when the chosen type has a finer breakdown) */}
      {hasSubtypes && (
        <div className="space-y-2">
          <div className="flex min-h-5 items-center gap-2">
            <Label>Sub-type</Label>
            {subtypeNumber !== undefined && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                #{subtypeNumber}
              </span>
            )}
          </div>
          <Select
            value={assetSubtype || undefined}
            onValueChange={onSubtypeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select a ${assetType} type (optional)`} />
            </SelectTrigger>
            <SelectContent>
              {subtypes.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Narrows {assetType} further — used in the asset number.
          </p>
        </div>
      )}
    </div>
  );
};

export default AssetCategorySelect;
