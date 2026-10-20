"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Minus, Plus, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DesignationField } from "@/components/shared/DesignationField";
import { AssetCategorySelect } from "@/components/asset/AssetCategorySelect";
import { AssetDateField } from "@/components/asset/AssetDateField";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { PERMISSIONS } from "@/lib/permissions";
import {
  AC_ROLES,
  ASSET_CODING_FIELDS,
  MAX_FORMS,
  REQUEST_TYPES,
  followingFormNum,
  perPiecePrice,
} from "@/lib/asset-creation";
import { assetClassByCode, assetClassOptions } from "@/lib/asset-classes";
import { buildPrefix, getTypePath } from "@/lib/assetNumber";
import { findSubcategoryForType } from "@/lib/constants/assetCategories";
import { computeComparison, landedLine } from "@/lib/price-eval";
import { toNumber } from "@/schemas/PriceEvalSchema";
import {
  AssetCreationFormSchema,
  type AssetCreationFormValues,
} from "@/schemas/AssetCreationSchema";
import { formatNumberWithCommas } from "@/utils/helpers";
import type { AssetCreationDetail } from "./types";

const SECTION_LABEL =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

const numText = (n: number | null | undefined) => (n == null ? "" : String(n));
const clean = (s: string | null | undefined) => (s && s.trim() !== "" ? s.trim() : null);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function buildDefaults(ac?: AssetCreationDetail, duplicate = false): AssetCreationFormValues {
  if (!ac) {
    return {
      requestType: "CREATE",
      agencyName: "",
      businessArea: "",
      costCentre: "",
      fund: "",
      functionalArea: "",
      forms: [{ formNum: "", sapAssetNum: "" }],
      description1: "",
      description2: "",
      useOfAsset: "",
      location: "",
      quantity: "1",
      requestedAssetClass: "",
      vendor: "",
      manufacturer: "",
      purchasedNew: true,
      datePrecision: "YEAR",
      year: String(new Date().getFullYear()),
      date: null,
      commenceDate: null,
      countryOfOrigin: "",
      brand: "",
      originalValue: "",
      usefulLifeYears: "",
      usefulLifeReason: "",
      category: "",
      subcategory: "",
      assetType: "",
      assetSubtype: "",
      requestedById: "",
      authorizedById: "",
      sapUpdatedById: "",
    };
  }

  const acquired = ac.acquisitionDate ? new Date(ac.acquisitionDate) : null;
  // The stored register type is the leaf-most name; split it back into the
  // type + optional sub-type so the cascade pre-selects both.
  const category = ac.registerCategory ?? "";
  const storedLeaf = ac.registerAssetType ?? "";
  const subcategory =
    ac.registerSubcategory ??
    (category && storedLeaf ? (findSubcategoryForType(category, storedLeaf) ?? "") : "");
  const leafPath =
    category && subcategory && storedLeaf ? getTypePath(category, subcategory, storedLeaf) : null;

  return {
    requestType: ac.requestType,
    agencyName: ac.agencyName,
    businessArea: ac.businessArea,
    costCentre: ac.costCentre,
    fund: ac.fund,
    functionalArea: ac.functionalArea,
    // A duplicate gets fresh numbers (filled in once suggested) and no SAP
    // numbers.
    forms: ac.forms.map((f) =>
      duplicate
        ? { formNum: "", sapAssetNum: "" }
        : { formNum: f.formNum, sapAssetNum: f.sapAssetNum ?? "" },
    ),
    description1: ac.description1,
    description2: ac.description2 ?? "",
    useOfAsset: ac.useOfAsset ?? "",
    location: ac.location,
    quantity: String(ac.quantity),
    requestedAssetClass: ac.requestedAssetClass,
    vendor: ac.vendor ?? "",
    manufacturer: ac.manufacturer ?? "",
    purchasedNew: ac.purchasedNew,
    datePrecision: ac.acquisitionPrecision,
    year: ac.acquisitionPrecision === "YEAR" && acquired ? String(acquired.getUTCFullYear()) : "",
    date: ac.acquisitionPrecision === "FULL" ? acquired : null,
    commenceDate: ac.commenceDate ? new Date(ac.commenceDate) : null,
    countryOfOrigin: ac.countryOfOrigin ?? "",
    brand: ac.brand ?? "",
    originalValue: numText(ac.originalValue),
    usefulLifeYears: numText(ac.usefulLifeYears),
    usefulLifeReason: ac.usefulLifeReason ?? "",
    category,
    subcategory,
    assetType: leafPath?.typeName ?? storedLeaf,
    assetSubtype: leafPath?.variantName ?? "",
    requestedById: ac.requestedById ?? "",
    authorizedById: ac.authorizedById ?? "",
    sapUpdatedById: ac.sapUpdatedById ?? "",
  };
}

interface AssetCreationFormProps {
  /** Existing set to edit; omit to create a new one. */
  assetCreation?: AssetCreationDetail;
  /** "Duplicate": start a new set with this one's details. */
  source?: AssetCreationDetail;
  /** Set when opened from a procurement: the new record joins it. */
  procurementId?: string;
}

export function AssetCreationForm({ assetCreation, source, procurementId }: AssetCreationFormProps) {
  const isEdit = Boolean(assetCreation);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canReadProcurement = useHasPermission(PERMISSIONS.PROCUREMENT_READ);
  const canReadPe = useHasPermission(PERMISSIONS.PRICEEVAL_READ);

  const defaults = useMemo(
    () => (assetCreation ? buildDefaults(assetCreation) : buildDefaults(source, true)),
    [assetCreation, source],
  );
  const form = useForm<AssetCreationFormValues>({
    resolver: zodResolver(AssetCreationFormSchema),
    defaultValues: defaults,
    values: assetCreation ? defaults : undefined,
  });
  const { control, setValue, getValues } = form;
  const formRows = useFieldArray({ control, name: "forms" });

  // ----- Reference data -----
  const { data: staff } = useQuery(trpc.staff.list.queryOptions());
  const currentStaff = useCurrentStaff(staff);
  const staffOptions = useMemo(
    () =>
      (staff ?? [])
        .filter((s) => s.designation?.trim())
        .map((s) => ({ value: s.id, label: s.name })),
    [staff],
  );
  const classOptions = useMemo(() => assetClassOptions(), []);

  // New set: suggest numbers, the SAP coding and the requester.
  const [initialCount] = useState(defaults.forms.length);
  const { data: nextNums } = useQuery({
    ...trpc.assetCreation.nextNumbers.queryOptions({ count: initialCount }),
    enabled: !isEdit,
  });
  useEffect(() => {
    if (isEdit || !nextNums) return;
    const current = getValues("forms");
    if (current.every((f) => !f.formNum.trim())) {
      current.forEach((_, i) => {
        if (nextNums[i]) setValue(`forms.${i}.formNum`, nextNums[i]);
      });
    }
  }, [isEdit, nextNums, getValues, setValue]);

  // The global defaults: they fill a new set, and the functional area offers
  // a reset to its default on any set.
  const { data: coding } = useQuery(
    trpc.settings.assetCoding.queryOptions(),
  );
  useEffect(() => {
    if (!coding || getValues("agencyName")) return;
    for (const { key } of ASSET_CODING_FIELDS) setValue(key, coding[key]);
  }, [coding, getValues, setValue]);

  useEffect(() => {
    if (!isEdit && currentStaff && !getValues("requestedById")) {
      setValue("requestedById", currentStaff.id);
    }
  }, [isEdit, currentStaff, getValues, setValue]);

  // From a procurement: offer the price evaluation's items and vendor.
  const { data: procurement } = useQuery({
    ...trpc.procurement.getById.queryOptions({ id: procurementId ?? "" }),
    enabled: Boolean(procurementId) && !isEdit && canReadProcurement,
  });
  const evalNum = procurement?.priceEvaluation?.evalNum;
  const { data: pe } = useQuery({
    ...trpc.priceEval.getByNum.queryOptions({ evalNum: evalNum ?? "" }),
    enabled: Boolean(evalNum) && canReadPe,
  });
  const peItems = useMemo(() => {
    if (!pe || pe.selectedVendor == null) return [];
    const chosen = pe.selectedVendor;
    const vendor = pe.vendors[chosen];
    const comparison = computeComparison(pe.items, pe.vendors, pe.gstRate);
    return pe.items.flatMap((it, i) => {
      const line = comparison.vendors[chosen]?.lines[i];
      if (line == null || !vendor) return [];
      const landed = landedLine(line, vendor, pe.gstRate);
      return [{ index: i, name: it.name, qty: it.qty, landed, unit: landed / it.qty }];
    });
  }, [pe]);
  const peVendor = pe && pe.selectedVendor != null ? pe.vendors[pe.selectedVendor]?.name : null;
  useEffect(() => {
    if (!isEdit && peVendor && !getValues("vendor").trim()) setValue("vendor", peVendor);
  }, [isEdit, peVendor, getValues, setValue]);

  // An item picked from the evaluation sets the value from its cost per
  // piece, and keeps it in step with the quantity until the user types
  // their own figure.
  const [unitCost, setUnitCost] = useState<number | null>(null);
  const [pickedItem, setPickedItem] = useState("");
  const autoValueRef = useRef<string | null>(null);
  const quantityNow = useWatch({ control, name: "quantity" });
  useEffect(() => {
    if (unitCost == null) return;
    const qty = toNumber(quantityNow);
    if (!qty || qty < 1) return;
    const current = getValues("originalValue").trim();
    if (current !== "" && current !== autoValueRef.current) return;
    const next = String(round2(unitCost * qty));
    autoValueRef.current = next;
    if (current !== next) setValue("originalValue", next, { shouldDirty: true });
  }, [unitCost, quantityNow, getValues, setValue]);

  const applyPeItem = (value: string) => {
    const item = peItems.find((it) => String(it.index) === value);
    if (!item) return;
    setPickedItem(value);
    setValue("description1", item.name, { shouldDirty: true, shouldValidate: true });
    // One form for the lot: all its pieces go on it.
    const single = getValues("forms").length === 1;
    if (single) setValue("quantity", String(item.qty));
    const qty = single ? item.qty : (toNumber(getValues("quantity")) ?? 1);
    const total = String(round2(item.unit * qty));
    autoValueRef.current = total;
    setValue("originalValue", total, { shouldDirty: true, shouldValidate: true });
    setUnitCost(item.unit);
  };

  // ----- Watched values -----
  const requestType = useWatch({ control, name: "requestType" });
  const classCode = useWatch({ control, name: "requestedAssetClass" });
  const assetClass = assetClassByCode(classCode);
  const lifeNow = useWatch({ control, name: "usefulLifeYears" });
  const lifeChanged =
    assetClass != null && toNumber(lifeNow) != null && toNumber(lifeNow) !== assetClass.defaultLife;
  const valueNow = useWatch({ control, name: "originalValue" });
  const formsNow = useWatch({ control, name: "forms" });
  const functionalAreaNow = useWatch({ control, name: "functionalArea" });
  const signers = useWatch({ control, name: ["requestedById", "authorizedById", "sapUpdatedById"] });

  // Asset register preview (Create only).
  const [category, subcategory, assetType, assetSubtype, precision, year, date] = useWatch({
    control,
    name: ["category", "subcategory", "assetType", "assetSubtype", "datePrecision", "year", "date"],
  });
  const acquisitionYear =
    precision === "FULL" && date ? String(date.getFullYear()) : year || String(new Date().getFullYear());
  const registerPrefix = buildPrefix({
    year: acquisitionYear,
    category,
    subcategory: subcategory ?? "",
    assetType: assetSubtype || assetType || "",
  }).prefix;
  const pieces = formsNow.length * (toNumber(quantityNow) ?? 0);

  const onClassChange = (code: string) => {
    const previous = assetClassByCode(getValues("requestedAssetClass"));
    const next = assetClassByCode(code);
    setValue("requestedAssetClass", code, { shouldDirty: true, shouldValidate: true });
    // Follow the class's default life unless the user set their own.
    const life = getValues("usefulLifeYears").trim();
    if (next && (life === "" || (previous && toNumber(life) === previous.defaultLife))) {
      setValue("usefulLifeYears", String(next.defaultLife));
    }
  };

  const addForm = () => {
    const last = getValues("forms").at(-1)?.formNum ?? "";
    formRows.append({ formNum: followingFormNum(last) ?? "", sapAssetNum: "" });
  };

  // ----- Save -----
  const onSaved = (result: { formNum: string }) => {
    queryClient.invalidateQueries({ queryKey: trpc.assetCreation.list.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.assetCreation.getByNum.pathKey() });
    if (procurementId) {
      queryClient.invalidateQueries({ queryKey: trpc.procurement.getById.queryKey({ id: procurementId }) });
      queryClient.invalidateQueries({ queryKey: trpc.procurement.list.queryKey() });
    }
    toast({ title: isEdit ? "Changes saved" : "Asset creation form created" });
    router.push(
      procurementId && !isEdit
        ? `/procurement/${procurementId}`
        : `/asset-creation/${encodeURIComponent(result.formNum)}`,
    );
  };
  const onError = (err: { message: string }) =>
    toast({ title: "Could not save", description: err.message });

  const createMutation = useMutation(trpc.assetCreation.create.mutationOptions({ onError }));
  const updateMutation = useMutation(trpc.assetCreation.update.mutationOptions({ onError }));
  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: AssetCreationFormValues) => {
    const acquisitionDate =
      values.datePrecision === "YEAR"
        ? values.year && /^\d{4}$/.test(values.year)
          ? new Date(Date.UTC(Number(values.year), 0, 1))
          : null
        : (values.date ?? null);
    const creating = values.requestType === "CREATE";
    const leafType = values.assetSubtype?.trim() || values.assetType?.trim() || "";

    const payload = {
      requestType: values.requestType,
      agencyName: values.agencyName.trim(),
      businessArea: values.businessArea.trim(),
      costCentre: values.costCentre.trim(),
      fund: values.fund.trim(),
      functionalArea: values.functionalArea.trim(),
      forms: values.forms.map((f) => ({
        formNum: f.formNum.trim(),
        sapAssetNum: clean(f.sapAssetNum),
      })),
      description1: values.description1.trim(),
      description2: clean(values.description2),
      useOfAsset: clean(values.useOfAsset),
      location: values.location.trim(),
      quantity: toNumber(values.quantity) ?? 1,
      requestedAssetClass: values.requestedAssetClass,
      vendor: clean(values.vendor),
      manufacturer: clean(values.manufacturer),
      purchasedNew: values.purchasedNew,
      acquisitionDate,
      acquisitionPrecision: values.datePrecision,
      commenceDate: values.commenceDate ?? null,
      countryOfOrigin: clean(values.countryOfOrigin),
      brand: clean(values.brand),
      originalValue: toNumber(values.originalValue),
      usefulLifeYears: toNumber(values.usefulLifeYears),
      usefulLifeReason: clean(values.usefulLifeReason),
      registerCategory: creating ? clean(values.category) : null,
      registerSubcategory: creating ? clean(values.subcategory) : null,
      registerAssetType: creating && leafType ? leafType : null,
      requestedById: values.requestedById || null,
      authorizedById: values.authorizedById || null,
      sapUpdatedById: values.sapUpdatedById || null,
    };
    if (assetCreation) {
      updateMutation.mutate({ id: assetCreation.id, ...payload }, { onSuccess: onSaved });
    } else {
      createMutation.mutate(
        { ...payload, procurementId: procurementId ?? null },
        { onSuccess: onSaved },
      );
    }
  };

  const textField = (
    name: "description1" | "description2" | "useOfAsset" | "location" | "vendor" | "manufacturer" | "countryOfOrigin" | "brand",
    label: string,
    placeholder?: string,
    optional = true,
  ) => (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label}
            {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
          </FormLabel>
          <FormControl>
            <Input {...field} placeholder={placeholder} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={(e) => form.handleSubmit(onSubmit)(e)} className="space-y-8">
        {/* ---------- Forms in this set ---------- */}
        <section className="rounded-md border bg-card p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className={SECTION_LABEL}>Forms</div>
              <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                Fill in the details once for every form that shares them — each form gets its own
                number, and its SAP asset number when the asset is created in SAP.
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span className="text-xs font-medium">Request for</span>
              <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                {REQUEST_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setValue("requestType", t.value, { shouldDirty: true })}
                    className={cn(
                      "rounded-[5px] px-3 py-1.5 text-xs font-medium transition sm:py-1",
                      requestType === t.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Number of forms</span>
                <div className="flex h-10 items-center rounded-md border bg-background">
                  <button
                    type="button"
                    aria-label="One fewer form"
                    disabled={formRows.fields.length <= 1}
                    onClick={() => formRows.remove(formRows.fields.length - 1)}
                    className="flex h-full w-10 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-30"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="flex-1 text-center font-mono text-base font-semibold tabular-nums">
                    {formRows.fields.length}
                  </span>
                  <button
                    type="button"
                    aria-label="One more form"
                    disabled={formRows.fields.length >= MAX_FORMS}
                    onClick={addForm}
                    className="flex h-full w-10 items-center justify-center text-muted-foreground transition hover:text-foreground disabled:opacity-30"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  One per SAP asset — e.g. 5 laptops tracked separately need 5 forms.
                </p>
              </div>
              <FormField
                control={control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity on each form</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="numeric" className="font-mono tabular-nums" />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      Pieces per form, as printed on it.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="min-w-0">
              <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b pb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                <span>#</span>
                <span>Form no.</span>
                <span>SAP asset no.</span>
              </div>
              <ol className="max-h-[360px] divide-y overflow-y-auto">
                {formRows.fields.map((row, i) => (
                  <li key={row.id} className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-3 py-2">
                    <span className="pt-2.5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                    <FormField
                      control={control}
                      name={`forms.${i}.formNum`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} className="h-9 font-mono text-sm" placeholder="1506/2026/009" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name={`forms.${i}.sapAssetNum`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              {...field}
                              className="h-9 font-mono text-sm"
                              placeholder={requestType === "CREATE" ? "At SAP update" : "Existing asset no."}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </li>
                ))}
              </ol>
              {form.formState.errors.forms?.root?.message || form.formState.errors.forms?.message ? (
                <p className="mt-2 text-sm text-red-600">
                  {form.formState.errors.forms?.root?.message ?? form.formState.errors.forms?.message}
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Numbers are suggested in sequence; edit any of them.
                  {requestType === "CREATE" && " The SAP updater enters the SAP asset numbers when they sign."}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ---------- SAP coding ---------- */}
        {/* Agency, business area, cost centre and fund come from Settings →
            General; only the functional area varies by form. */}
        <section className="rounded-md border bg-card p-6">
          <div className={cn(SECTION_LABEL, "mb-5")}>SAP coding</div>
          <div>
            <FormField
              control={control}
              name="functionalArea"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Functional area</FormLabel>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <FormControl>
                      <Input
                        {...field}
                        className="font-mono text-sm sm:w-[280px]"
                        placeholder="S067005001001001"
                      />
                    </FormControl>
                    {coding &&
                      (functionalAreaNow.trim() === coding.functionalArea ? (
                        <span className="text-[11px] text-muted-foreground">Default</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setValue("functionalArea", coding.functionalArea, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                        >
                          <RotateCcw className="size-3" />
                          Reset to default
                        </button>
                      ))}
                  </div>
                  <FormDescription className="text-[11px]">
                    Starts with the default from Settings → General; change it for this form if
                    the asset falls under a different functional area.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* ---------- Asset general information ---------- */}
        <section className="rounded-md border bg-card p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className={SECTION_LABEL}>Asset general information</div>
            {peItems.length > 0 && (
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                <SearchableSelect
                  value={pickedItem}
                  onValueChange={applyPeItem}
                  options={peItems.map((it) => ({
                    value: String(it.index),
                    label: it.name,
                    hint: `${it.qty} × MVR ${formatNumberWithCommas(round2(it.unit))}`,
                  }))}
                  placeholder={`Use an item from price evaluation ${evalNum}`}
                  searchPlaceholder="Search items…"
                  className="h-8 w-full text-xs sm:w-[300px]"
                  contentClassName="w-[min(26rem,90vw)]"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {textField("description1", "Description 1", "e.g. Ynk - Dining Chair Pu Seat Metal Leg Black H-1936", false)}
            </div>
            {textField("description2", "Description 2", "e.g. Dining Chair")}
            {textField("useOfAsset", "Use of the asset", "e.g. For use by office staff")}
            {textField("location", "Location in which the asset will be used", "e.g. Office Breakroom", false)}
            <FormField
              control={control}
              name="requestedAssetClass"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requested asset class</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      value={field.value}
                      onValueChange={onClassChange}
                      options={classOptions}
                      placeholder="Select an asset class"
                      searchPlaceholder="Search class, code or GL…"
                      contentClassName="w-[min(30rem,90vw)]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md bg-muted/40 px-4 py-3 text-xs">
            <span className="text-muted-foreground">Requested GL code</span>
            {assetClass ? (
              <>
                <span className="font-mono text-sm font-semibold">{assetClass.glCode}</span>
                <span>{assetClass.glName}</span>
                <span className="text-muted-foreground sm:ml-auto">
                  Default life {assetClass.defaultLife} year{assetClass.defaultLife === 1 ? "" : "s"}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">Set by the asset class</span>
            )}
          </div>
        </section>

        {/* ---------- Asset origin information ---------- */}
        <section className="rounded-md border bg-card p-6">
          <div className={cn(SECTION_LABEL, "mb-5")}>Asset origin information</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {textField("vendor", "Vendor")}
            {textField("manufacturer", "Manufacturer")}
            <div className="space-y-2">
              <span className="text-sm font-medium">Asset purchased</span>
              <div className="flex h-10 items-center">
                <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                  {[
                    { value: true, label: "New" },
                    { value: false, label: "Used" },
                  ].map((o) => (
                    <FormField
                      key={o.label}
                      control={control}
                      name="purchasedNew"
                      render={({ field }) => (
                        <button
                          type="button"
                          onClick={() => field.onChange(o.value)}
                          className={cn(
                            "rounded-[5px] px-4 py-1.5 text-xs font-medium transition",
                            field.value === o.value
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {o.label}
                        </button>
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            <AssetDateField form={form} label="Acquisition date" />
            <FormField
              control={control}
              name="commenceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Asset use commence date
                    <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-between pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                        >
                          <span className="truncate">
                            {field.value ? format(field.value, "PP") : "Pick a date"}
                          </span>
                          <CalendarIcon className="ml-2 size-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={(d) => field.onChange(d ?? null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {field.value && (
                    <button
                      type="button"
                      onClick={() => field.onChange(null)}
                      className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            {textField("countryOfOrigin", "Country of origin")}
            {textField("brand", "Type / brand name")}
            <FormField
              control={control}
              name="originalValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Original value <span className="font-normal text-muted-foreground">(MVR, per form)</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="decimal" className="text-right font-mono tabular-nums" placeholder="0.00" />
                  </FormControl>
                  {(() => {
                    const qty = toNumber(quantityNow) ?? 0;
                    const each = perPiecePrice(toNumber(valueNow), qty);
                    return qty > 1 && each != null ? (
                      <FormDescription className="text-[11px]">
                        For {qty} pieces — MVR {formatNumberWithCommas(each)} each in the register.
                      </FormDescription>
                    ) : null;
                  })()}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* ---------- Depreciation ---------- */}
        <section className="rounded-md border bg-card p-6">
          <div className={cn(SECTION_LABEL, "mb-1")}>Depreciation information</div>
          <p className="mb-5 text-xs text-muted-foreground">
            The useful life only needs a reason when it differs from the asset class&apos;s
            default.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
            <FormField
              control={control}
              name="usefulLifeYears"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Useful life</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input {...field} inputMode="numeric" className="pr-14 font-mono tabular-nums" />
                    </FormControl>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                      years
                    </span>
                  </div>
                  {assetClass && (
                    <FormDescription className="text-[11px]">
                      Default for {assetClass.code}: {assetClass.defaultLife} years
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="usefulLifeReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Reason
                    {!lifeChanged && <span className="ml-1 font-normal text-muted-foreground">(only if changed)</span>}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} disabled={!lifeChanged && !field.value} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        {/* ---------- Asset register (Create) ---------- */}
        {requestType === "CREATE" && (
          <section className="rounded-md border bg-card p-6">
            <div className={cn(SECTION_LABEL, "mb-1")}>Asset register</div>
            <p className="mb-5 text-xs text-muted-foreground">
              Not printed. When the SAP update is signed, the register gets one entry per piece
              under this category.
            </p>
            <AssetCategorySelect form={form} />
            <div
              className={cn(
                "mt-5 rounded-md border border-dashed px-4 py-3 text-xs",
                registerPrefix ? "text-foreground/80" : "text-muted-foreground",
              )}
            >
              {registerPrefix ? (
                <>
                  Completing adds <span className="font-semibold">{pieces}</span> register{" "}
                  {pieces === 1 ? "entry" : "entries"}, numbered{" "}
                  <span className="font-mono">{registerPrefix}…</span> from the next free number.
                </>
              ) : (
                "Pick a category, subcategory and type — needed before sending."
              )}
            </div>
          </section>
        )}

        {/* ---------- Signatories ---------- */}
        <section>
          <div className="mb-4">
            <h2 className={SECTION_LABEL}>Signatories</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Signed in this order once the set is sent. Their ID card numbers print as the SAP
              User ID on the form.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {AC_ROLES.map((role, index) => {
              const name = `${role.key}Id` as const;
              const person = staff?.find((s) => s.id === signers[index]);
              return (
                <div key={role.key} className="flex flex-col gap-3 rounded-md border bg-card p-5">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    <span className="mr-1.5 font-mono text-foreground/60">{index + 1}</span>
                    {role.label}
                  </span>
                  <FormField
                    control={control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <SearchableSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            options={staffOptions}
                            placeholder="Select staff"
                            searchPlaceholder="Search staff…"
                            emptyMessage="No staff available"
                            contentClassName="w-[min(22rem,90vw)]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DesignationField value={person?.designation} />
                  {person && (
                    <span className="text-[11px] text-muted-foreground">
                      {person.idCardNo ? (
                        <>
                          ID card <span className="font-mono text-foreground">{person.idCardNo}</span>
                        </>
                      ) : (
                        "No ID card no. — add it in Settings → Staff"
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : formsNow.length > 1
                  ? `Create ${formsNow.length} forms`
                  : "Create form"}
          </button>
        </div>
      </form>
    </Form>
  );
}
