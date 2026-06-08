"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AssetSchema, type AssetValues } from "@/schemas/AssetSchema";
import { AssetCategorySelect } from "@/components/asset/AssetCategorySelect";
import { AssetDateField } from "@/components/asset/AssetDateField";
import { AssetNumberField } from "@/components/asset/AssetNumberField";
import { findSubcategoryForType } from "@/lib/constants/assetCategories";
import { getTypePath } from "@/lib/assetNumber";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AssetRecord = any;

interface AssetFormProps {
  asset?: AssetRecord;
}

function buildDefaults(asset?: AssetRecord): AssetValues {
  if (!asset) {
    return {
      assetNum: "",
      SAPassetNum: "",
      assetName: "",
      modelNum: "",
      manufacturerId: "",
      classification: "",
      previousLocation: "",
      presentLocation: "",
      datePrecision: "YEAR",
      year: "",
      date: null,
      price: "",
      condition: "",
      category: "",
      assetType: "",
      subcategory: "",
      assetSubtype: "",
      numberYear: String(new Date().getFullYear()),
    };
  }

  const precision: "YEAR" | "FULL" = asset.datePrecision === "FULL" ? "FULL" : "YEAR";
  const d = asset.date ? new Date(asset.date) : null;
  const category = asset.category ?? "";
  // Stored `assetType` is the leaf-most name. Split it back into the L3 type +
  // optional L4 sub-type so the cascade pre-selects both in edit mode.
  const storedLeaf = asset.assetType ?? "";
  const subcategory =
    category && storedLeaf
      ? findSubcategoryForType(category, storedLeaf) ?? ""
      : "";
  const leafPath =
    category && subcategory && storedLeaf
      ? getTypePath(category, subcategory, storedLeaf)
      : null;
  const assetType = leafPath?.typeName ?? storedLeaf;
  const assetSubtype = leafPath?.variantName ?? "";

  return {
    assetNum: asset.assetNum ?? "",
    SAPassetNum: asset.SAPassetNum ?? "",
    assetName: asset.assetName ?? "",
    modelNum: asset.modelNum ?? "",
    manufacturerId: asset.manufacturerId ?? "",
    classification: asset.classification ?? "",
    previousLocation: asset.previousLocation ?? "",
    presentLocation: asset.presentLocation ?? "",
    datePrecision: precision,
    year: precision === "YEAR" && d ? String(d.getUTCFullYear()) : "",
    date: precision === "FULL" ? d : null,
    price: asset.price !== null && asset.price !== undefined ? String(asset.price) : "",
    condition: asset.condition ?? "",
    category,
    assetType,
    subcategory,
    assetSubtype,
    numberYear: "",
  };
}

const Section: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <section className="rounded-md border bg-card">
    <header className="border-b px-5 py-3.5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      )}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const AssetForm: React.FC<AssetFormProps> = ({ asset }) => {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(asset);

  const form = useForm<AssetValues>({
    resolver: zodResolver(AssetSchema),
    defaultValues: buildDefaults(asset),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
  };

  const createMutation = useMutation(
    trpc.asset.create.mutationOptions({
      onSuccess: (data) => {
        toast({ title: "Success", description: "Asset created." });
        invalidate();
        router.push(`/asset/${encodeURIComponent(data.assetNum)}`);
      },
      onError: (error) => {
        toast({
          title: "Could not create asset",
          description: error.message || "An unknown error occurred.",
        });
      },
    }),
  );

  const updateMutation = useMutation(
    trpc.asset.update.mutationOptions({
      onSuccess: (data) => {
        toast({ title: "Success", description: `Asset ${data.assetNum} updated.` });
        invalidate();
        queryClient.invalidateQueries({
          queryKey: trpc.asset.getByNum.queryKey({ assetNum: data.assetNum }),
        });
        router.push(`/asset/${encodeURIComponent(data.assetNum)}`);
      },
      onError: (error) => {
        toast({
          title: "Could not update asset",
          description: error.message || "An unknown error occurred.",
        });
      },
    }),
  );

  const submitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: AssetValues) => {
    const derivedDate =
      values.datePrecision === "YEAR"
        ? values.year && /^\d{4}$/.test(values.year)
          ? new Date(Date.UTC(Number(values.year), 0, 1))
          : null
        : (values.date ?? null);

    const clean = (s?: string) => (s && s.trim() !== "" ? s.trim() : null);

    // Persist the most specific selection: the L4 sub-type if one was chosen,
    // otherwise the L3 type. (`subcategory`/`assetSubtype`/`numberYear` are
    // transient and never sent to the server.)
    const leafType =
      values.assetSubtype && values.assetSubtype.trim() !== ""
        ? values.assetSubtype.trim()
        : values.assetType;

    const payload = {
      assetNum: values.assetNum.trim(),
      SAPassetNum: clean(values.SAPassetNum),
      assetName: values.assetName.trim(),
      modelNum: clean(values.modelNum),
      manufacturerId: clean(values.manufacturerId),
      classification: clean(values.classification),
      previousLocation: clean(values.previousLocation),
      presentLocation: clean(values.presentLocation),
      date: derivedDate,
      datePrecision: values.datePrecision,
      price: values.price && values.price.trim() !== "" ? Number(values.price) : null,
      condition: clean(values.condition),
      category: values.category,
      assetType: leafType,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Category & type */}
        <Section
          title="Category & type"
          description="Pick where this asset sits in the register taxonomy — the asset number is built from this."
        >
          <AssetCategorySelect form={form} />
        </Section>

        {/* Identity */}
        <Section
          title="Identity"
          description="The asset's numbers and name."
        >
          <div className="mb-4">
            <AssetNumberField form={form} isEdit={isEdit} />
            {!isEdit && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Auto-built from the category &amp; type above, the year, and the
                next available number — or switch to manual entry.
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="SAPassetNum"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>SAP Asset No.</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 80002781"
                      className="font-mono"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="assetName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>
                    Asset Name &amp; Description{" "}
                    <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Executive Chair (Black Leather)"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="modelNum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Model number" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="manufacturerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manufacturer ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Manufacturer ID" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="classification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Classification</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Z652" className="font-mono" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Section>

        {/* Location & status */}
        <Section
          title="Location & status"
          description="Where the asset has been, where it is now, and its condition."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="previousLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Previous Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Previous location" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="presentLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Present Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Present location" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Good" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (MVR)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="e.g. 11500"
                      className="font-mono tabular-nums"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="sm:col-span-2">
              <AssetDateField form={form} />
            </div>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4" />
                {isEdit ? "Save changes" : "Create asset"}
              </>
            )}
          </button>
        </div>
      </form>
    </Form>
  );
};

export default AssetForm;
