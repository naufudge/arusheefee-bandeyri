"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Sparkles } from "lucide-react";
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
import { AttachmentSection } from "@/components/attachments/AttachmentSection";
import {
  AttachmentQueue,
  type AttachmentQueueHandle,
} from "@/components/attachments/AttachmentQueue";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { glAccountOptions, useGlAccounts } from "@/hooks/use-gl-accounts";
import { PERMISSIONS } from "@/lib/permissions";
import {
  DEFAULT_METHOD,
  PE_ROLES,
  VENDOR_COUNT,
  suggestReason,
} from "@/lib/price-eval";
import {
  PriceEvalFormSchema,
  toNumber,
  type PriceEvalFormValues,
} from "@/schemas/PriceEvalSchema";
import { QuoteMatrix } from "./QuoteMatrix";
import type { PriceEvalDetail } from "./types";

const SECTION_LABEL =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";
const DHIVEHI_INPUT = "font-faruma text-[15px]";

// GST is on by default; untick it for vendors that don't charge it.
const blankVendor = () => ({
  name: "",
  currency: "MVR",
  exchangeRate: "1",
  chargesGst: true,
  discountPercent: "",
});
const blankItem = () => ({
  name: "",
  qty: "1",
  rates: Array.from({ length: VENDOR_COUNT }, () => ""),
});
const numText = (n: number | null | undefined) => (n == null ? "" : String(n));

function buildDefaults(pe?: PriceEvalDetail): PriceEvalFormValues {
  if (!pe) {
    return {
      evalNum: "",
      date: new Date(),
      section: "",
      method: DEFAULT_METHOD,
      glCode: 0,
      budgetBalance: "",
      vendors: Array.from({ length: VENDOR_COUNT }, blankVendor),
      items: [blankItem()],
      selectedVendor: null,
      selectionReason: "",
      preparedById: "",
      budgetCheckedById: "",
      checkedById: "",
      approvedById: "",
    };
  }
  return {
    evalNum: pe.evalNum,
    date: new Date(pe.date),
    section: pe.section,
    method: pe.method,
    glCode: pe.glAccount.code,
    budgetBalance: numText(pe.budgetBalance),
    vendors: Array.from({ length: VENDOR_COUNT }, (_, v) => {
      const vendor = pe.vendors[v];
      return vendor
        ? {
            name: vendor.name,
            currency: vendor.currency,
            exchangeRate: String(vendor.exchangeRate),
            chargesGst: vendor.chargesGst,
            discountPercent: numText(vendor.discountPercent),
          }
        : blankVendor();
    }),
    items: pe.items.length
      ? pe.items.map((it) => ({
          name: it.name,
          qty: String(it.qty),
          rates: Array.from({ length: VENDOR_COUNT }, (_, v) => numText(it.rates[v])),
        }))
      : [blankItem()],
    selectedVendor: pe.selectedVendor,
    selectionReason: pe.selectionReason ?? "",
    preparedById: pe.preparedById ?? "",
    budgetCheckedById: pe.budgetCheckedById ?? "",
    checkedById: pe.checkedById ?? "",
    approvedById: pe.approvedById ?? "",
  };
}

interface PriceEvalFormProps {
  /** Existing evaluation to edit; omit to create a new one. */
  evaluation?: PriceEvalDetail;
  /** Set when opened from a procurement: the new record joins it. */
  procurementId?: string;
}

export function PriceEvalForm({ evaluation, procurementId }: PriceEvalFormProps) {
  const isEdit = Boolean(evaluation);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canUploadAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_UPLOAD);
  const canDeleteAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_DELETE);
  const attachmentQueueRef = useRef<AttachmentQueueHandle | null>(null);

  const defaults = useMemo(() => buildDefaults(evaluation), [evaluation]);
  const form = useForm<PriceEvalFormValues>({
    resolver: zodResolver(PriceEvalFormSchema),
    defaultValues: defaults,
    values: evaluation ? defaults : undefined,
  });
  const { control, setValue, getValues } = form;

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

  const { data: glAccounts, isLoading: glLoading } = useGlAccounts();
  const glOptions = useMemo(() => glAccountOptions(glAccounts ?? []), [glAccounts]);

  const { data: globalGst } = useQuery(trpc.settings.gstRate.queryOptions());
  // A sent evaluation keeps the rate it was sent with; drafts follow the
  // global rate (the server applies it on save).
  const gstRate =
    evaluation && evaluation.status !== "DRAFT"
      ? evaluation.gstRate
      : (globalGst ?? evaluation?.gstRate ?? 8);

  // MMA publishes monthly rates; quotes convert at the evaluation's month.
  const watchedDate = useWatch({ control, name: "date" });
  const rateMonth =
    watchedDate instanceof Date && !isNaN(watchedDate.getTime())
      ? new Date(Date.UTC(watchedDate.getFullYear(), watchedDate.getMonth(), 15))
      : undefined;
  const { data: mmaRates } = useQuery({
    ...trpc.exchangeRates.get.queryOptions({ date: rateMonth }),
    retry: false,
  });
  const rateMonthLabel = rateMonth ? format(rateMonth, "MMM yyyy") : null;

  // Refill foreign vendors' rates when MMA's figures arrive or the month
  // changes. Left alone on first load of a saved evaluation so its stored
  // rates are never silently rewritten.
  const ratedMonthRef = useRef<string | null>(null);
  useEffect(() => {
    const month = rateMonth ? rateMonth.toISOString().slice(0, 7) : null;
    const previous = ratedMonthRef.current;
    ratedMonthRef.current = month;
    if (!mmaRates) return;
    const monthChanged = previous !== null && previous !== month;
    getValues("vendors").forEach((vendor, v) => {
      if (vendor.currency === "MVR") return;
      const rate = mmaRates[vendor.currency];
      if (typeof rate !== "number") return;
      const current = toNumber(vendor.exchangeRate);
      if (!current || current === 1 || monthChanged || !isEdit) {
        if (current !== rate) {
          setValue(`vendors.${v}.exchangeRate`, String(rate), { shouldDirty: true });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mmaRates, rateMonth?.getTime()]);

  // New evaluation: suggest the next number and pre-select the preparer.
  const { data: nextNum } = useQuery({
    ...trpc.priceEval.nextNumber.queryOptions({ year: new Date().getFullYear() }),
    enabled: !isEdit,
  });
  useEffect(() => {
    if (!isEdit && nextNum && !getValues("evalNum")) setValue("evalNum", nextNum);
  }, [isEdit, nextNum, getValues, setValue]);
  useEffect(() => {
    if (!isEdit && currentStaff && !getValues("preparedById")) {
      setValue("preparedById", currentStaff.id);
    }
  }, [isEdit, currentStaff, getValues, setValue]);

  // ----- Save -----
  const onSaved = async (result: { evalNum: string; id?: string }) => {
    if (result.id && attachmentQueueRef.current && !attachmentQueueRef.current.isEmpty()) {
      const ok = await attachmentQueueRef.current.flush("price_evaluation", result.id);
      if (!ok) {
        toast({
          title: "Some quotations didn't upload",
          description: "The evaluation was saved — add them again from its page.",
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: trpc.priceEval.list.queryKey() });
    queryClient.invalidateQueries({
      queryKey: trpc.priceEval.getByNum.queryKey({ evalNum: result.evalNum }),
    });
    toast({ title: isEdit ? "Changes saved" : "Price evaluation created" });
    router.push(
      procurementId && !isEdit
        ? `/procurement/${procurementId}`
        : `/price-evaluation/${encodeURIComponent(result.evalNum)}`,
    );
  };
  const onError = (err: { message: string }) =>
    toast({ title: "Could not save", description: err.message });

  // `onSaved` (which reads the attachment queue ref) is passed per call in
  // the submit handler, so nothing touches the ref during render.
  const createMutation = useMutation(trpc.priceEval.create.mutationOptions({ onError }));
  const updateMutation = useMutation(trpc.priceEval.update.mutationOptions({ onError }));
  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: PriceEvalFormValues) => {
    const payload = {
      evalNum: values.evalNum.trim(),
      date: values.date,
      section: values.section,
      method: values.method,
      glCode: values.glCode,
      budgetBalance: toNumber(values.budgetBalance),
      vendors: values.vendors.map((v) => ({
        name: v.name.trim(),
        currency: v.currency,
        exchangeRate: toNumber(v.exchangeRate) ?? 1,
        chargesGst: v.chargesGst,
        discountPercent: toNumber(v.discountPercent),
      })),
      items: values.items.map((it) => ({
        name: it.name.trim(),
        qty: toNumber(it.qty) ?? 1,
        rates: it.rates.map(toNumber),
      })),
      selectedVendor: values.selectedVendor,
      selectionReason: values.selectionReason.trim() || null,
      preparedById: values.preparedById || null,
      budgetCheckedById: values.budgetCheckedById || null,
      checkedById: values.checkedById || null,
      approvedById: values.approvedById || null,
    };
    if (isEdit) updateMutation.mutate(payload, { onSuccess: onSaved });
    else createMutation.mutate({ ...payload, procurementId: procurementId ?? null }, { onSuccess: onSaved });
  };

  // The reason defaults to the form's standard sentence for the chosen
  // vendor, and follows the choice (or a renamed vendor) until the user
  // writes their own wording.
  const selected = useWatch({ control, name: "selectedVendor" });
  const vendorsNow = useWatch({ control, name: "vendors" });
  const reasonNow = useWatch({ control, name: "selectionReason" });
  const chosenName = selected != null ? vendorsNow[selected]?.name?.trim() : "";
  // "Lowest of N quotes" only makes sense with two or more; a single
  // quotation (allowed under the limit) needs the user's own reason.
  const quoteCount = vendorsNow.filter((v) => v.name.trim()).length;
  const suggestion = chosenName && quoteCount >= 2 ? suggestReason(quoteCount, chosenName) : null;
  // The last sentence filled in automatically, to tell it apart from edits.
  const autoReasonRef = useRef<string | null>(null);
  useEffect(() => {
    const current = getValues("selectionReason").trim();
    const untouched = current === "" || current === autoReasonRef.current || current === suggestion;
    if (!untouched) return;
    // With no suggestion, an earlier automatic sentence no longer fits.
    const next = suggestion ?? "";
    autoReasonRef.current = suggestion;
    if (current !== next) {
      setValue("selectionReason", next, { shouldDirty: true });
    }
  }, [suggestion, getValues, setValue]);

  return (
    <Form {...form}>
        <form onSubmit={(e) => form.handleSubmit(onSubmit)(e)} className="space-y-8">
          {/* ---------- Details ---------- */}
          <section className="rounded-md border bg-card p-6">
            <div className={cn(SECTION_LABEL, "mb-5")}>Details</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={control}
                name="evalNum"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Form number</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isEdit} className="font-mono" placeholder="2026-1" />
                    </FormControl>
                    {!isEdit && <FormDescription className="text-xs">Suggested; editable.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
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
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requesting section</FormLabel>
                    <FormControl>
                      <Input {...field} dir="rtl" lang="dv" className={DHIVEHI_INPUT} placeholder="ސެކްޝަން" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evaluation method</FormLabel>
                    <FormControl>
                      <Input {...field} dir="rtl" lang="dv" className={DHIVEHI_INPUT} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ---------- Budget ---------- */}
          <section className="rounded-md border bg-card p-6">
            <div className={cn(SECTION_LABEL, "mb-1")}>Budget</div>
            <p className="mb-5 text-xs text-muted-foreground">
              The budget checker confirms the code&apos;s balance (or corrects it) and whether
              funds are available when they sign.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
              <FormField
                control={control}
                name="glCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget code</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(v) => field.onChange(Number(v))}
                        options={glOptions}
                        disabled={glLoading}
                        placeholder={glLoading ? "Loading GL accounts…" : "Select a GL code"}
                        searchPlaceholder="Search code or name…"
                        contentClassName="w-[min(32rem,90vw)]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="budgetBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Code balance <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" placeholder="MVR" className="text-right font-mono tabular-nums" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* ---------- Quotes ---------- */}
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className={SECTION_LABEL}>Quotes</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter each vendor&apos;s unit price in their currency. Totals are in MVR.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-500" /> cheapest for that item
              </span>
            </div>
            <QuoteMatrix
              gstRate={gstRate}
              mmaRates={mmaRates}
              rateMonthLabel={rateMonthLabel}
              autoSelectLowest={!isEdit}
            />
            {form.formState.errors.items?.root?.message && (
              <p className="mt-2 text-sm text-red-600">{form.formState.errors.items.root.message}</p>
            )}
          </section>

          {/* ---------- Selection reason ---------- */}
          <section className="rounded-md border bg-card p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className={SECTION_LABEL}>Reason for choosing</div>
              {suggestion && reasonNow.trim() !== suggestion && (
                <button
                  type="button"
                  onClick={() => setValue("selectionReason", suggestion, { shouldDirty: true })}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted"
                >
                  <Sparkles className="size-3.5" />
                  Use standard wording
                </button>
              )}
            </div>
            <FormField
              control={control}
              name="selectionReason"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <textarea
                      {...field}
                      dir="rtl"
                      lang="dv"
                      rows={3}
                      placeholder="ތަކެތި/ޚިދުމަތް ހޯދަން އަގަށް އެއްބަސްވި ސަބަބު"
                      className={cn(
                        "w-full resize-none rounded-md border border-input bg-background px-3 py-2 leading-7 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
                        DHIVEHI_INPUT,
                      )}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    {quoteCount >= 2
                      ? "Filled in with the standard wording for the vendor chosen above — edit it if there's a different reason."
                      : "With a single quotation, write why this vendor was chosen."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          {/* ---------- Signatories ---------- */}
          <section>
            <div className="mb-4">
              <h2 className={SECTION_LABEL}>Signatories</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Signed in this order once the evaluation is sent.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PE_ROLES.map((role, index) => {
                const name = `${role.key}Id` as const;
                return (
                  <div key={role.key} className="flex flex-col gap-3 rounded-md border bg-card p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        <span className="mr-1.5 font-mono text-foreground/60">{index + 1}</span>
                        {role.en}
                      </span>
                    </div>
                    <div dir="rtl" className="font-faruma text-[13px] leading-6 text-muted-foreground">
                      {role.dv}
                    </div>
                    <FormField
                      control={control}
                      name={name}
                      render={({ field }) => (
                        <>
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
                          <DesignationField value={staff?.find((s) => s.id === field.value)?.designation} />
                        </>
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---------- Quotations (attachments) ---------- */}
          {evaluation?.id ? (
            <AttachmentSection
              referenceType="price_evaluation"
              referenceId={evaluation.id}
              canAdd={canUploadAttachments}
              canDelete={canDeleteAttachments}
            />
          ) : (
            <AttachmentQueue ref={attachmentQueueRef} />
          )}

          <div className="flex items-center justify-end gap-3 border-t pt-6">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create evaluation"}
            </button>
          </div>
        </form>
    </Form>
  );
}
