"use client";

import React, { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Pencil, RefreshCw, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/lib/trpc";
import { buildPrefix, validateAssetNumber } from "@/lib/assetNumber";
import type { AssetValues } from "@/schemas/AssetSchema";

interface AssetNumberFieldProps {
  form: UseFormReturn<AssetValues>;
  isEdit: boolean;
}

/** Green/amber status line comparing the number to the selected taxonomy. */
function NumberStatus({
  assetNum,
  category,
  subcategory,
  assetType,
}: {
  assetNum: string;
  category: string;
  subcategory: string;
  assetType: string;
}) {
  if (!assetNum) return null;
  const v = validateAssetNumber(assetNum, { category, subcategory, assetType });
  // For type-less subcategories `assetType` is empty — show the subcategory.
  const leafLabel = assetType || subcategory;

  if (v.formatOk && v.matchesCategory) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="size-3.5" />
        Matches {leafLabel}
      </p>
    );
  }
  if (v.formatOk && category && leafLabel && !v.matchesCategory) {
    return (
      <p className="flex items-start gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-px size-3.5 shrink-0" />
        <span>
          Doesn&apos;t match the selected category/type.{" "}
          <span className="font-normal">{v.issues.join(" ")}</span>
        </span>
      </p>
    );
  }
  if (!v.formatOk) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-3.5" />
        Not a recognised asset-number format.
      </p>
    );
  }
  return null;
}

/** Read-only view used in edit mode (the number is the permanent slug). */
const ReadonlyView: React.FC<{ form: UseFormReturn<AssetValues> }> = ({
  form,
}) => {
  const assetNum = form.watch("assetNum") ?? "";
  const category = form.watch("category");
  const subcategory = form.watch("subcategory") ?? "";
  const assetType = form.watch("assetType");
  const assetSubtype = form.watch("assetSubtype") ?? "";
  // The leaf-most selection drives the type/variant segments of the number.
  const effectiveType = assetSubtype || assetType || "";

  return (
    <div className="space-y-2">
      <Label>Asset Number</Label>
      <Input disabled value={assetNum} className="font-mono" />
      <p className="text-[11px] text-muted-foreground">
        The asset number is the permanent identifier and can&apos;t be changed.
      </p>
      <NumberStatus
        assetNum={assetNum}
        category={category}
        subcategory={subcategory}
        assetType={effectiveType}
      />
    </div>
  );
};

/** Create-mode builder: auto-generate from the taxonomy or enter manually. */
const BuilderView: React.FC<{ form: UseFormReturn<AssetValues> }> = ({
  form,
}) => {
  const trpc = useTRPC();
  const category = form.watch("category");
  const subcategory = form.watch("subcategory") ?? "";
  const assetType = form.watch("assetType");
  const assetSubtype = form.watch("assetSubtype") ?? "";
  // The leaf-most selection (sub-type if chosen) drives the type/variant
  // segments of the number.
  const effectiveType = assetSubtype || assetType || "";
  const numberYear = form.watch("numberYear") ?? "";
  const assetNum = form.watch("assetNum") ?? "";
  const error = form.formState.errors.assetNum?.message;

  const [manual, setManual] = useState(false);
  // A sequence the user typed, scoped to the prefix it was typed for (so it
  // auto-clears when the prefix changes and the suggestion takes over again).
  const [seqEdit, setSeqEdit] = useState<{ prefix: string; value: string } | null>(
    null,
  );

  const prefixResult = buildPrefix({
    year: numberYear,
    category,
    subcategory,
    assetType: effectiveType,
  });
  const prefix = prefixResult.prefix;
  const canFetch = !manual && prefix !== null;

  const nextItemQuery = useQuery({
    ...trpc.asset.nextItem.queryOptions({
      yy: prefixResult.yy ?? "00",
      mainNum: prefixResult.path.mainNum ?? 0,
      subNum: prefixResult.path.subNum ?? 0,
      typeNum: prefixResult.path.typeNum ?? 0,
      variantNum: prefixResult.path.variantNum ?? null,
      noType: prefixResult.leafSubcategory,
    }),
    enabled: canFetch,
  });

  const override =
    seqEdit && prefix && seqEdit.prefix === prefix ? seqEdit.value : null;
  const autoSeq = nextItemQuery.data ? String(nextItemQuery.data.nextItem) : "";
  const sequence = override ?? autoSeq;
  const fullNumber = prefix && sequence ? prefix + sequence : "";

  // Commit the assembled number into the form (auto mode only). Writing via
  // RHF's setValue (not a useState setter) keeps the field validated; the
  // equality guard prevents an update loop.
  useEffect(() => {
    if (manual) return;
    if (fullNumber && fullNumber !== assetNum) {
      form.setValue("assetNum", fullNumber, { shouldValidate: true });
    }
  }, [manual, fullNumber, assetNum, form]);

  const year = new Date().getFullYear();

  return (
    <div className="space-y-2">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label>
          Asset Number <span className="text-destructive">*</span>
        </Label>
        <button
          type="button"
          onClick={() => setManual((m) => !m)}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          {manual ? (
            <>
              <Wand2 className="size-3.5" />
              Auto-generate
            </>
          ) : (
            <>
              <Pencil className="size-3.5" />
              Enter manually
            </>
          )}
        </button>
      </div>

      {manual ? (
        <Input
          placeholder="e.g. 433-18-02-15-79-01"
          className="font-mono"
          value={assetNum}
          onChange={(e) =>
            form.setValue("assetNum", e.target.value, { shouldValidate: true })
          }
        />
      ) : prefix === null ? (
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="w-28 space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Number year
              </Label>
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder={String(year)}
                value={numberYear}
                onChange={(e) =>
                  form.setValue(
                    "numberYear",
                    e.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                className="h-9 font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
            Select the{" "}
            <span className="font-medium text-foreground">
              {prefixResult.missing
                .filter((m) => !m.endsWith("number"))
                .join(", ") || "category and type"}
            </span>{" "}
            above to auto-build the asset number.
            {prefixResult.missing.some((m) => m.endsWith("number")) && (
              <>
                {" "}
                (Some selected items have no taxonomy code — switch to{" "}
                <span className="font-medium">Enter manually</span>.)
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-24 space-y-1">
              <Label className="text-[11px] text-muted-foreground">Year</Label>
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder={String(year)}
                value={numberYear}
                onChange={(e) =>
                  form.setValue(
                    "numberYear",
                    e.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                className="h-9 font-mono tabular-nums"
              />
            </div>
            <div className="w-24 space-y-1">
              <Label className="text-[11px] text-muted-foreground">Item #</Label>
              <Input
                inputMode="numeric"
                placeholder="1"
                value={sequence}
                onChange={(e) =>
                  setSeqEdit({
                    prefix,
                    value: e.target.value.replace(/\D/g, ""),
                  })
                }
                className="h-9 font-mono tabular-nums"
              />
            </div>
            {nextItemQuery.data && (
              <button
                type="button"
                onClick={() => {
                  setSeqEdit(null);
                  nextItemQuery.refetch();
                }}
                title="Use the next available number"
                className="mb-px inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <RefreshCw
                  className={`size-3.5 ${nextItemQuery.isFetching ? "animate-spin" : ""}`}
                />
                next: {nextItemQuery.data.nextItem}
              </button>
            )}
          </div>

          {/* Live preview */}
          <div className="rounded-md border bg-card px-3 py-2.5">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Asset number
            </div>
            <div className="mt-0.5 font-mono text-base font-medium tracking-tight">
              {fullNumber || (
                <span className="text-muted-foreground">{prefix}…</span>
              )}
            </div>
          </div>
        </div>
      )}

      <NumberStatus
        assetNum={assetNum}
        category={category}
        subcategory={subcategory}
        assetType={effectiveType}
      />
      {error && (
        <p className="text-[0.8rem] font-light italic text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

export const AssetNumberField: React.FC<AssetNumberFieldProps> = ({
  form,
  isEdit,
}) =>
  isEdit ? <ReadonlyView form={form} /> : <BuilderView form={form} />;

export default AssetNumberField;
