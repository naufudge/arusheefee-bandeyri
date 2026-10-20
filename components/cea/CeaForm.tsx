"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Layers, Link2, Plus, Trash2 } from "lucide-react";
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
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { glAccountOptions, useGlAccounts } from "@/hooks/use-gl-accounts";
import { formatNumberWithCommas } from "@/utils/helpers";
import { toNumber } from "@/schemas/PriceEvalSchema";
import { CeaFormSchema, type CeaFormValues } from "@/schemas/CeaSchema";
import type { CeaDetail } from "./types";

const SECTION_LABEL = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";
const DHIVEHI_INPUT = "font-faruma text-[15px]";
const TEXTAREA =
  "w-full resize-none rounded-md border border-input bg-background px-3 py-2 leading-7 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring";

/** Values a draft takes live from its procurement's price evaluation. */
export interface CeaLive {
  evalNum: string;
  section: string | null;
  glAccount: { code: number; longTextEn: string } | null;
  budgetBalance: number | null;
  items: { description: string | null; qty: number | null; cost: number | null }[];
}

export interface CeaFeDefaults {
  nameEn: string;
  nameDv: string;
  designationEn: string;
  designationDv: string;
}

// The columns the CEA always fills in itself, beside the item.
const OWN_FIELDS = [
  { key: "onHand", en: "Quantity on hand", dv: "މިހާރު ހުރި ޢަދަދު" },
  { key: "acquired", en: "When they were acquired", dv: "ހޯދުނު ތާރީޚު" },
  { key: "condition", en: "Condition of current ones", dv: "މިހާރު ހުރި ތަކެތީގެ ހާލަތު" },
] as const;

const blankItem = () => ({
  description: "",
  qty: "1",
  cost: "",
  onHand: "",
  acquired: "",
  condition: "",
  reason: "",
});
const numText = (n: number | null | undefined) => (n == null ? "" : String(n));
const text = (s: string | null | undefined) => s ?? "";
const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";

/** A loaded CEA's live values, when it's a draft following an evaluation. */
export function liveFromCea(cea: CeaDetail): CeaLive | null {
  const r = cea.resolved;
  if (!r.live || !r.sourceEvalNum) return null;
  return {
    evalNum: r.sourceEvalNum,
    section: r.section,
    glAccount: r.glAccount,
    budgetBalance: r.budgetBalance,
    items: r.rows,
  };
}

function buildDefaults(
  cea: CeaDetail | undefined,
  live: CeaLive | null,
  fe: CeaFeDefaults | undefined,
): CeaFormValues {
  if (cea) {
    const r = cea.resolved;
    return {
      ceaNum: cea.ceaNum,
      date: new Date(cea.date),
      section: text(r.section),
      glCode: r.glAccount?.code ?? 0,
      budgetBalance: numText(r.budgetBalance),
      feNameEn: text(cea.feNameEn),
      feNameDv: text(cea.feNameDv),
      feDesignationEn: text(cea.feDesignationEn),
      feDesignationDv: text(cea.feDesignationDv),
      requestedById: cea.requestedById ?? "",
      items: r.rows.length
        ? r.rows.map((row) => ({
            description: text(row.description),
            qty: numText(row.qty),
            cost: numText(row.cost),
            onHand: text(row.onHand),
            acquired: text(row.acquired),
            condition: text(row.condition),
            reason: text(row.reason),
          }))
        : live
          ? []
          : [blankItem()],
    };
  }
  return {
    ceaNum: "",
    date: new Date(),
    section: "",
    glCode: 0,
    budgetBalance: "",
    feNameEn: fe?.nameEn ?? "",
    feNameDv: fe?.nameDv ?? "",
    feDesignationEn: fe?.designationEn ?? "",
    feDesignationDv: fe?.designationDv ?? "",
    requestedById: "",
    // Live rows mirror the evaluation's items; the CEA adds its own columns.
    items: live
      ? live.items.map((it) => ({
          ...blankItem(),
          description: text(it.description),
          qty: numText(it.qty),
          cost: numText(it.cost),
        }))
      : [blankItem()],
  };
}

// A value shown read-only because the price evaluation supplies it.
function LiveValue({ label, children, dv }: { label: string; children: React.ReactNode; dv?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div
        dir={dv ? "rtl" : undefined}
        className={cn(
          "flex min-h-10 items-center rounded-md border border-dashed bg-muted/40 px-3 py-1.5 text-sm",
          dv && cn(DHIVEHI_INPUT, "leading-7"),
        )}
      >
        {children ?? <span className="text-muted-foreground">Not set on the evaluation</span>}
      </div>
    </div>
  );
}

interface CeaFormProps {
  /** Existing form to edit; omit to create a new one. */
  cea?: CeaDetail;
  /** Create only: what the procurement's price evaluation supplies (null when none). */
  live?: CeaLive | null;
  /** Create only: the FE from Settings → General. */
  feDefaults?: CeaFeDefaults;
  /** Set when opened from a procurement: the new form joins it. */
  procurementId?: string;
}

export function CeaForm({ cea, live: liveProp, feDefaults, procurementId }: CeaFormProps) {
  const isEdit = Boolean(cea);
  const live = cea ? liveFromCea(cea) : (liveProp ?? null);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Built once: the form keeps the user's edits if the queries refetch.
  const [defaults] = useState(() => buildDefaults(cea, live, feDefaults));
  const form = useForm<CeaFormValues>({
    resolver: zodResolver(CeaFormSchema),
    defaultValues: defaults,
  });
  const { control, setValue, getValues } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

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

  // New form: suggest the next number and pre-select the requester.
  const { data: nextNum } = useQuery({
    ...trpc.cea.nextNumber.queryOptions({ year: new Date().getFullYear() }),
    enabled: !isEdit,
  });
  useEffect(() => {
    if (!isEdit && nextNum && !getValues("ceaNum")) setValue("ceaNum", nextNum);
  }, [isEdit, nextNum, getValues, setValue]);
  useEffect(() => {
    if (!isEdit && currentStaff && !getValues("requestedById")) setValue("requestedById", currentStaff.id);
  }, [isEdit, currentStaff, getValues, setValue]);

  // The chosen requester's designation, shown under their name as on the PV form.
  const requesterId = useWatch({ control, name: "requestedById" });
  const requesterDesignation =
    staff?.find((s) => s.id === requesterId)?.designation ??
    (cea?.requestedBy && cea.requestedBy.id === requesterId ? cea.requestedBy.designation : "");

  const watchedItems = useWatch({ control, name: "items" });
  const costs = live ? live.items.map((it) => it.cost) : watchedItems.map((it) => toNumber(it.cost));
  const total = costs.reduce<number>((sum, c) => sum + (c ?? 0), 0);
  const missingCosts = costs.some((c) => c == null);

  // ----- Save -----
  const onSaved = (result: { ceaNum: string }) => {
    queryClient.invalidateQueries({ queryKey: trpc.cea.list.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.cea.getByNum.pathKey() });
    queryClient.invalidateQueries({ queryKey: trpc.procurement.pathKey() });
    toast({ title: isEdit ? "Changes saved" : "CEA form created" });
    // Signing is the next step, on the form's page.
    router.push(`/cea/${encodeURIComponent(result.ceaNum)}`);
  };
  const onError = (err: { message: string }) => toast({ title: "Could not save", description: err.message });

  const createMutation = useMutation(trpc.cea.create.mutationOptions({ onSuccess: onSaved, onError }));
  const updateMutation = useMutation(trpc.cea.update.mutationOptions({ onSuccess: onSaved, onError }));
  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: CeaFormValues) => {
    const optional = (s: string) => s.trim() || null;
    const payload = {
      date: values.date,
      section: optional(values.section),
      glCode: values.glCode || null,
      budgetBalance: toNumber(values.budgetBalance),
      feNameEn: optional(values.feNameEn),
      feNameDv: optional(values.feNameDv),
      feDesignationEn: optional(values.feDesignationEn),
      feDesignationDv: optional(values.feDesignationDv),
      requestedById: values.requestedById || null,
      items: values.items.map((it) => ({
        description: optional(it.description),
        qty: toNumber(it.qty),
        cost: toNumber(it.cost),
        onHand: optional(it.onHand),
        acquired: optional(it.acquired),
        condition: optional(it.condition),
        reason: optional(it.reason),
      })),
    };
    if (cea) updateMutation.mutate({ ceaNum: cea.ceaNum, ...payload });
    else createMutation.mutate({ ceaNum: values.ceaNum.trim(), ...payload, procurementId: procurementId ?? null });
  };

  // A signed form carries its requester's signature; reopen it to change them.
  const requesterLocked = cea != null && cea.status !== "DRAFT";

  return (
    <Form {...form}>
      <form onSubmit={(e) => form.handleSubmit(onSubmit)(e)} className="space-y-8">
        {live && (
          <div className="flex gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
            <Link2 className="mt-0.5 size-4 shrink-0" />
            <p>
              Linked to price evaluation{" "}
              <Link
                href={`/price-evaluation/${encodeURIComponent(live.evalNum)}`}
                className="font-mono font-medium underline-offset-4 hover:underline"
              >
                {live.evalNum}
              </Link>
              . The section, budget code, code balance and each item&apos;s quantity and cost come
              from it (the chosen vendor&apos;s price, with GST) while this form is a draft. Change
              them there; signing freezes them on this form.
            </p>
          </div>
        )}

        {/* ---------- Details ---------- */}
        <section className="rounded-md border bg-card p-6">
          <div className={cn(SECTION_LABEL, "mb-5")}>Details</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
            <FormField
              control={control}
              name="ceaNum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Form number</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isEdit} className="font-mono" placeholder="(FRM)433-CA/433/2026/1" />
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
                          <span className="truncate">{field.value ? format(field.value, "PP") : "Pick a date"}</span>
                          <CalendarIcon className="ml-2 size-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value ?? undefined} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            {live ? (
              <LiveValue label="Department / section" dv>
                {live.section}
              </LiveValue>
            ) : (
              <FormField
                control={control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department / section</FormLabel>
                    <FormControl>
                      <Input {...field} dir="rtl" lang="dv" className={DHIVEHI_INPUT} placeholder="ސެކްޝަން" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </section>

        {/* ---------- Budget ---------- */}
        <section className="rounded-md border bg-card p-6">
          <div className={cn(SECTION_LABEL, "mb-5")}>Budget</div>
          {live ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
              <LiveValue label="Budget code">
                {live.glAccount && (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-mono tabular-nums">{live.glAccount.code}</span>
                    <span className="truncate text-muted-foreground">{live.glAccount.longTextEn}</span>
                  </span>
                )}
              </LiveValue>
              <LiveValue label="Code balance">
                {live.budgetBalance != null && (
                  <span className="ml-auto font-mono tabular-nums">MVR {money(live.budgetBalance)}</span>
                )}
              </LiveValue>
            </div>
          ) : (
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
                    <FormLabel>Code balance</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" placeholder="MVR" className="text-right font-mono tabular-nums" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </section>

        {/* ---------- Items ---------- */}
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className={SECTION_LABEL}>Items</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {live
                  ? "One row per item on the price evaluation. Fill in what the office has now and why more are needed."
                  : "One row per item to buy, with its estimated cost in MVR."}
              </p>
            </div>
            <div className="text-right">
              <div className={SECTION_LABEL}>Estimated cost</div>
              <div className="font-mono text-lg font-semibold tabular-nums">MVR {money(total)}</div>
            </div>
          </div>

          {fields.length === 0 && (
            <div className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Price evaluation {live?.evalNum} has no items yet.
            </div>
          )}

          <div className="space-y-4">
            {fields.map((f, i) => {
              const liveItem = live?.items[i];
              return (
                <div key={f.id} className="rounded-md border bg-card">
                  <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                    <span className={SECTION_LABEL}>
                      <span className="mr-1.5 font-mono text-foreground/60">{i + 1}</span>
                      Item
                    </span>
                    {!live && fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        aria-label={`Remove item ${i + 1}`}
                        className="text-muted-foreground transition hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,0.7fr)_minmax(0,1fr)]">
                    {liveItem ? (
                      <>
                        <LiveValue label="Item" dv>
                          {liveItem.description}
                        </LiveValue>
                        <LiveValue label="Quantity">
                          {liveItem.qty != null && <span className="font-mono tabular-nums">{liveItem.qty}</span>}
                        </LiveValue>
                        <LiveValue label="Cost">
                          {liveItem.cost != null ? (
                            <span className="ml-auto font-mono tabular-nums">{money(liveItem.cost)}</span>
                          ) : (
                            <span className="text-muted-foreground">No vendor chosen</span>
                          )}
                        </LiveValue>
                      </>
                    ) : (
                      <>
                        <FormField
                          control={control}
                          name={`items.${i}.description`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Item</FormLabel>
                              <FormControl>
                                <Input {...field} dir="rtl" lang="dv" className={DHIVEHI_INPUT} placeholder="ބާވަތް" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name={`items.${i}.qty`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input {...field} inputMode="decimal" className="text-right font-mono tabular-nums" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name={`items.${i}.cost`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estimated cost</FormLabel>
                              <FormControl>
                                <Input {...field} inputMode="decimal" placeholder="MVR" className="text-right font-mono tabular-nums" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 border-t px-4 pb-4 pt-3 sm:grid-cols-3">
                    {OWN_FIELDS.map((own) => (
                      <FormField
                        key={own.key}
                        control={control}
                        name={`items.${i}.${own.key}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-baseline justify-between gap-2">
                              <span>{own.en}</span>
                              <span dir="rtl" className="font-faruma text-xs font-normal text-muted-foreground">
                                {own.dv}
                              </span>
                            </FormLabel>
                            <FormControl>
                              <Input {...field} dir="rtl" lang="dv" className={DHIVEHI_INPUT} placeholder="-" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                    <FormField
                      control={control}
                      name={`items.${i}.reason`}
                      render={({ field }) => (
                        <FormItem className="sm:col-span-3">
                          <FormLabel className="flex items-baseline justify-between gap-2">
                            <span>Why more are needed</span>
                            <span dir="rtl" className="font-faruma text-xs font-normal text-muted-foreground">
                              އިތުރަށް ބޭނުންވާ ސަބަބު
                            </span>
                          </FormLabel>
                          <FormControl>
                            <textarea {...field} dir="rtl" lang="dv" rows={2} className={cn(TEXTAREA, DHIVEHI_INPUT)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {!live && (
            <button
              type="button"
              onClick={() => append(blankItem())}
              disabled={fields.length >= 50}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              <Plus className="size-4" />
              Add item
            </button>
          )}
          {live && missingCosts && fields.length > 0 && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Choose the vendor on price evaluation {live.evalNum} to cost every item before signing.
            </p>
          )}
          {form.formState.errors.items?.root?.message && (
            <p className="mt-2 text-sm text-red-600">{form.formState.errors.items.root.message}</p>
          )}
        </section>

        {/* ---------- Signatories ---------- */}
        <section>
          <div className="mb-4">
            <h2 className={SECTION_LABEL}>Signatories</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The requester signs in the app, and the office stamp prints with their signature.
              The Financial Executive signs the printed form by hand.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="rounded-md border bg-card p-5">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className={SECTION_LABEL}>Financial Executive</span>
                <span dir="rtl" className="font-faruma text-[13px] text-muted-foreground">
                  ހުއްދަ ދެއްވި މާލީ ޒިންމާދާރު ވެރިޔާ
                </span>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                {isEdit ? "As printed on this form." : "From Settings → General; change it for this form if needed."}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={control}
                  name="feNameEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="English" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="feNameDv"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (Dhivehi)</FormLabel>
                      <FormControl>
                        <Input {...field} dir="rtl" lang="dv" className={DHIVEHI_INPUT} placeholder="ނަން" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="feDesignationEn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="English" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="feDesignationDv"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation (Dhivehi)</FormLabel>
                      <FormControl>
                        <Input {...field} dir="rtl" lang="dv" className={DHIVEHI_INPUT} placeholder="މަޤާމު" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex flex-col rounded-md border bg-card p-5">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className={SECTION_LABEL}>Requested by</span>
                <span dir="rtl" className="font-faruma text-[13px] text-muted-foreground">
                  ހުއްދައަށް އެދި ހުށަހެޅި
                </span>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                {requesterLocked ? "Signed this form; reopen it to change who requests it." : "Signs the form in the app."}
              </p>
              <FormField
                control={control}
                name="requestedById"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        options={staffOptions}
                        disabled={requesterLocked}
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
              <DesignationField value={requesterDesignation} className="mt-4" />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create form"}
          </button>
        </div>
      </form>
    </Form>
  );
}
