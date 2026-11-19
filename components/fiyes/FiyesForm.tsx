"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormGetValues,
  type UseFormSetValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, CalendarIcon, Calculator, Plus, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DesignationField } from "@/components/shared/DesignationField";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { formatNumberWithCommas } from "@/utils/helpers";
import { toNumber } from "@/schemas/PriceEvalSchema";
import { FiyesFormSchema, type FiyesFormValues } from "@/schemas/FiyesSchema";
import {
  MONTH_NAMES,
  formsFor,
  isLinesForm,
  isRowsForm,
  monthBounds,
  parsePeriod,
  periodHasStarted,
  periodKey,
  periodLabel,
  type FiyesFormDef,
  type FiyesLinesForm,
  type FiyesPeriod,
} from "@/lib/fiyes";
import { formatDmy } from "@/lib/week";
import {
  DisclosureButton,
  FormCard,
  LinesEditor,
  LinesFormCard,
  RowsFormCard,
  entriesInput,
  filledLinesText,
  linesDefaults,
  rowsDefaults,
  useFilledLines,
  useHasErrors,
} from "./FormEntries";
import type { FiyesReturnDetail } from "./types";

const SECTION_LABEL = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";
const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";
const numText = (n: number | null | undefined) => (n == null ? "" : String(n));

/** The calendar day picked (local midnight) as UTC midnight, so it can't shift a day. */
const toUtcDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
/** A stored UTC-midnight date as that same day for the date picker. */
const fromUtcDay = (v: Date | string) => {
  const d = new Date(v);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

const blankPayable = () => ({
  invoiceNumber: "",
  invoiceDate: null,
  vendorName: "",
  vendorAccount: "",
  details: "",
  currency: "MVR",
  exchangeRate: "1",
  amount: "",
});

function buildDefaults(ret: FiyesReturnDetail | undefined, initialPeriod: string | undefined): FiyesFormValues {
  if (ret) {
    return {
      kind: ret.kind,
      year: ret.year,
      month: ret.month ?? 1,
      documentDate: fromUtcDay(ret.documentDate),
      enteredById: ret.enteredById ?? "",
      approvedById: ret.approvedById ?? "",
      pettyCashOpening: numText(ret.pettyCashOpening),
      pettyCashClosing: numText(ret.pettyCashClosing),
      payables: ret.payables.map((p) => ({
        invoiceNumber: p.invoiceNumber,
        invoiceDate: fromUtcDay(p.invoiceDate),
        vendorName: p.vendorName,
        vendorAccount: p.vendorAccount,
        details: p.details,
        currency: p.currency,
        exchangeRate: String(p.exchangeRate),
        amount: String(p.amount),
      })),
      lines: linesDefaults(ret.entries),
      rows: rowsDefaults(ret.entries),
    };
  }
  // A month's return is usually filed early the next month, so default to
  // last month (or the period the calendar tile asked for).
  const now = new Date();
  const last = now.getMonth() === 0 ? { year: now.getFullYear() - 1, month: 12 } : { year: now.getFullYear(), month: now.getMonth() };
  const asked = initialPeriod ? parsePeriod(initialPeriod) : null;
  return {
    kind: asked?.kind ?? "MONTHLY",
    year: asked?.year ?? last.year,
    month: asked?.month ?? last.month,
    documentDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    enteredById: "",
    approvedById: "",
    pettyCashOpening: "",
    pettyCashClosing: "",
    payables: [],
    lines: linesDefaults(),
    rows: rowsDefaults(),
  };
}

export function FiyesForm({ ret, initialPeriod }: { ret?: FiyesReturnDetail; initialPeriod?: string }) {
  const isEdit = Boolean(ret);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Built once: the form keeps the user's edits if the queries refetch.
  const [defaults] = useState(() => buildDefaults(ret, initialPeriod));
  const form = useForm<FiyesFormValues>({ resolver: zodResolver(FiyesFormSchema), defaultValues: defaults });
  const { control, setValue, getValues } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "payables" });
  // Form cards start open when they carry something; F01's petty cash always does.
  const [cashOpen, setCashOpen] = useState(true);
  const [payablesOpen, setPayablesOpen] = useState(defaults.payables.length > 0);
  const addInvoice = () => {
    append(blankPayable());
    setPayablesOpen(true);
  };

  const kind = useWatch({ control, name: "kind" });
  const year = useWatch({ control, name: "year" });
  const month = useWatch({ control, name: "month" });
  const period: FiyesPeriod = kind === "MONTHLY" ? { kind, year, month } : { kind, year, month: null };
  const key = periodKey(period);

  // ----- Signatories -----
  const { data: staff } = useQuery(trpc.staff.list.queryOptions());
  const currentStaff = useCurrentStaff(staff);
  const staffOptions = useMemo(
    () => (staff ?? []).filter((s) => s.designation?.trim()).map((s) => ({ value: s.id, label: s.name })),
    [staff],
  );
  const { data: lastApprover } = useQuery({ ...trpc.fiyes.lastApprover.queryOptions(), enabled: !isEdit });
  useEffect(() => {
    if (!isEdit && currentStaff && !getValues("enteredById")) setValue("enteredById", currentStaff.id);
  }, [isEdit, currentStaff, getValues, setValue]);
  useEffect(() => {
    if (!isEdit && lastApprover?.approvedById && !getValues("approvedById")) {
      setValue("approvedById", lastApprover.approvedById);
    }
  }, [isEdit, lastApprover, getValues, setValue]);
  const enteredById = useWatch({ control, name: "enteredById" });
  const approvedById = useWatch({ control, name: "approvedById" });
  const designationOf = (id: string) => staff?.find((s) => s.id === id)?.designation ?? "";
  // The workflow runs on these two; once sent, call the return back to change them.
  const signatoriesLocked = ret != null && ret.status !== "DRAFT";

  // ----- Period -----
  const { data: existing } = useQuery({ ...trpc.fiyes.list.queryOptions({ year }), enabled: !isEdit });
  const taken = !isEdit && (existing ?? []).some((r) => r.period === key);
  const started = periodHasStarted(period);

  // ----- F01 petty cash, calculated as the register export counts it -----
  const { data: balances, isFetching: balancesLoading } = useQuery({
    ...trpc.fiyes.pettyCashBalances.queryOptions({ year, month }),
    enabled: kind === "MONTHLY",
  });
  // Fill the figures once per period on a new return; an edit keeps what's stored.
  const filledFor = useRef<string | null>(isEdit ? key : null);
  useEffect(() => {
    if (!balances || kind !== "MONTHLY" || filledFor.current === key) return;
    filledFor.current = key;
    setValue("pettyCashOpening", String(balances.opening.balance), { shouldDirty: true });
    setValue("pettyCashClosing", String(balances.closing.balance), { shouldDirty: true });
  }, [balances, kind, key, setValue]);
  const opening = useWatch({ control, name: "pettyCashOpening" });
  const closing = useWatch({ control, name: "pettyCashClosing" });
  const differs =
    balances != null &&
    (toNumber(opening) !== balances.opening.balance || toNumber(closing) !== balances.closing.balance);
  const bounds = monthBounds(year, month);

  // ----- Save -----
  const onSaved = (result: { period: string }) => {
    queryClient.invalidateQueries({ queryKey: trpc.fiyes.list.pathKey() });
    queryClient.invalidateQueries({ queryKey: trpc.fiyes.getByPeriod.pathKey() });
    toast({ title: isEdit ? "Changes saved" : `${periodLabel(period)} return created` });
    router.push(`/fiyes/${result.period}`);
  };
  const onError = (err: { message: string }) => toast({ title: "Could not save", description: err.message });
  const createMutation = useMutation(trpc.fiyes.create.mutationOptions({ onSuccess: onSaved, onError }));
  const updateMutation = useMutation(trpc.fiyes.update.mutationOptions({ onSuccess: onSaved, onError }));
  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: FiyesFormValues) => {
    const common = {
      documentDate: toUtcDay(values.documentDate),
      enteredById: values.enteredById || null,
      approvedById: values.approvedById || null,
      entries: entriesInput(values.kind, values),
    };
    if (values.kind === "MONTHLY") {
      const monthly = {
        kind: "MONTHLY" as const,
        ...common,
        pettyCashOpening: toNumber(values.pettyCashOpening),
        pettyCashClosing: toNumber(values.pettyCashClosing),
      };
      if (ret) updateMutation.mutate({ ...monthly, period: ret.period });
      else createMutation.mutate({ ...monthly, year: values.year, month: values.month });
      return;
    }
    const yearly = {
      kind: "YEARLY" as const,
      ...common,
      payables: values.payables.map((p) => {
        const currency = p.currency.trim().toUpperCase();
        return {
          invoiceNumber: p.invoiceNumber.trim(),
          // Validated non-null by the form schema.
          invoiceDate: toUtcDay(p.invoiceDate as Date),
          vendorName: p.vendorName.trim(),
          vendorAccount: p.vendorAccount.trim(),
          details: p.details.trim(),
          currency,
          exchangeRate: currency === "MVR" ? 1 : (toNumber(p.exchangeRate) ?? 1),
          amount: toNumber(p.amount) ?? 0,
        };
      }),
    };
    if (ret) updateMutation.mutate({ ...yearly, period: ret.period });
    else createMutation.mutate({ ...yearly, year: values.year });
  };

  return (
    <Form {...form}>
      <form onSubmit={(e) => form.handleSubmit(onSubmit)(e)} className="space-y-8">
        {/* ---------- Period ---------- */}
        <section className="rounded-md border bg-card p-6">
          <div className={cn(SECTION_LABEL, "mb-5")}>Return</div>
          {!isEdit && (
            <div className="mb-5 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Return type">
              {(
                [
                  ["MONTHLY", "Monthly return", "F01 Cash on Hand, F03, F04, F05 and F12"],
                  ["YEARLY", "Year-end return", "The two F06 forms and F19 Payables"],
                ] as const
              ).map(([value, title, sub]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => {
                    setValue("kind", value);
                    if (value === "YEARLY" && getValues("year") === THIS_YEAR) setValue("year", THIS_YEAR - 1);
                  }}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-md border px-4 py-3 text-left transition",
                    kind === value ? "border-foreground bg-muted/60" : "hover:bg-muted/40",
                  )}
                >
                  <span className="text-sm font-medium">{title}</span>
                  <span className="text-xs text-muted-foreground">{sub}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              control={control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{kind === "MONTHLY" ? "Year" : "Financial year"}</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                    disabled={isEdit}
                  >
                    <FormControl>
                      <SelectTrigger className="tabular-nums">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)} className="tabular-nums">
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {kind === "MONTHLY" && (
              <FormField
                control={control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={isEdit}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MONTH_NAMES.map((name, i) => (
                          <SelectItem
                            key={name}
                            value={String(i + 1)}
                            disabled={!periodHasStarted({ kind: "MONTHLY", year, month: i + 1 })}
                          >
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={control}
              name="documentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-between pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
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
                  <FormDescription className="text-xs">Printed under both signatures.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {taken && (
            <p className="mt-4 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                {periodLabel(period)} already has a return.{" "}
                <Link href={`/fiyes/${key}`} className="font-medium underline underline-offset-4">
                  Open it
                </Link>
              </span>
            </p>
          )}
          {!started && (
            <p className="mt-4 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              {periodLabel(period)} hasn&apos;t started yet, so its return can&apos;t be filed.
            </p>
          )}
        </section>

        {/* ---------- Signatories ---------- */}
        <section className="rounded-md border bg-card p-6">
          <div className={cn(SECTION_LABEL, "mb-1")}>Signatories</div>
          <p className="mb-5 text-xs text-muted-foreground">
            {signatoriesLocked
              ? "This return has been sent; call it back to change who signs."
              : "Entered by signs by sending the return; Approved by signs by approving it. One approval signs every form in the return."}
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {(
              [
                ["enteredById", "Entered by", enteredById],
                ["approvedById", "Approved by", approvedById],
              ] as const
            ).map(([name, label, value]) => (
              <div key={name}>
                <FormField
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          options={staffOptions}
                          disabled={signatoriesLocked}
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
                <DesignationField value={designationOf(value)} className="mt-4" />
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Forms ---------- */}
        <div className="space-y-3">
          <div className="px-1">
            <div className={SECTION_LABEL}>Forms</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Fill in a form when there&apos;s something to report. A form left empty is filed as a nil
              return, exactly as its template.
            </p>
          </div>

          {(formsFor(kind) as FiyesFormDef[]).map((form) => {
            if (form.code === "F01" && isLinesForm(form)) {
              return (
                <FormCard
                  key={form.code}
                  form={form}
                  status="Petty cash from the register, plus any other cash on hand"
                  open={cashOpen}
                  onOpenChange={setCashOpen}
                  errorPaths={["pettyCashOpening", "pettyCashClosing", `lines.${form.code}`]}
                  action={() =>
                    balances &&
                    differs && (
                      <button
                        type="button"
                        onClick={() => {
                          setValue("pettyCashOpening", String(balances.opening.balance), { shouldDirty: true });
                          setValue("pettyCashClosing", String(balances.closing.balance), { shouldDirty: true });
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        <Calculator className="size-3.5" />
                        Use calculated figures
                      </button>
                    )
                  }
                >
                  <div className="text-sm font-medium">Petty cash</div>
                  <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                    Calculated from the petty cash register: the year&apos;s opening balance, plus top-up PVs,
                    less petty cash paid. Correct them if the cash count differs; they freeze once approved.
                  </p>

                  {balances && !balances.opening.openingSet && (
                    <div className="mb-5 flex gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                      <p>
                        No opening balance is set for {year}, so the calculation starts from zero. Set it on the{" "}
                        <Link href="/petty-cash-register" className="font-medium underline underline-offset-4">
                          petty cash register
                        </Link>{" "}
                        first.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        ["pettyCashOpening", `Amount as at ${formatDmy(bounds.first)}`, balances?.opening],
                        ["pettyCashClosing", `Amount as at ${formatDmy(bounds.last)}`, balances?.closing],
                      ] as const
                    ).map(([name, label, calc]) => (
                      <FormField
                        key={name}
                        control={control}
                        name={name}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{label}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                  MVR
                                </span>
                                <Input {...field} inputMode="decimal" className="pl-12 text-right font-mono tabular-nums" placeholder="0.00" />
                              </div>
                            </FormControl>
                            <FormDescription className="text-xs tabular-nums">
                              {balancesLoading && !calc
                                ? "Calculating…"
                                : calc
                                  ? `Register: ${money(calc.opening)} + ${money(calc.received)} top-ups − ${money(calc.paid)} paid = ${money(calc.balance)}`
                                  : " "}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>

                  <OtherCash form={form} control={control} bounds={bounds} />
                </FormCard>
              );
            }
            if (form.code === "F19") {
              return (
                <FormCard
                  key={form.code}
                  form={form}
                  status={
                    fields.length
                      ? `${fields.length} ${fields.length === 1 ? "invoice" : "invoices"} unpaid at 31 December ${year}`
                      : `Nil return: no invoices unpaid at 31 December ${year}`
                  }
                  open={payablesOpen}
                  onOpenChange={setPayablesOpen}
                  errorPaths={["payables"]}
                  action={() =>
                    fields.length === 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={addInvoice}>
                        <Plus className="size-4" />
                        Add invoice
                      </Button>
                    )
                  }
                >
                  {fields.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {fields.map((f, index) => (
                          <PayableRow
                            key={f.id}
                            index={index}
                            control={control}
                            getValues={getValues}
                            setValue={setValue}
                            onRemove={() => remove(index)}
                          />
                        ))}
                      </div>
                      <Button type="button" variant="outline" size="sm" className="mt-4" onClick={addInvoice}>
                        <Plus className="size-4" />
                        Add another invoice
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No invoices unpaid at 31 December {year}, so F19 is filed as a nil return.
                    </p>
                  )}
                </FormCard>
              );
            }
            if (isLinesForm(form)) return <LinesFormCard key={form.code} form={form} control={control} />;
            if (isRowsForm(form)) return <RowsFormCard key={form.code} form={form} control={control} />;
            return null;
          })}
        </div>

        <div className="flex items-center justify-end gap-3 border-t pt-6">
          <button
            type="submit"
            disabled={saving || taken || !started}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-6 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create return"}
          </button>
        </div>
      </form>
    </Form>
  );
}

// F01's lines besides petty cash, entered by hand: starts closed while they're
// all 0, and stays open while one is invalid.
function OtherCash({
  form,
  control,
  bounds,
}: {
  form: FiyesLinesForm;
  control: Control<FiyesFormValues>;
  bounds: { first: Date; last: Date };
}) {
  const bodyId = useId();
  const filled = useFilledLines(control, form);
  const hasErrors = useHasErrors([`lines.${form.code}`]);
  const [open, setOpen] = useState(filled > 0);
  const shown = open || hasErrors;
  return (
    <div className="mt-6 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 flex-1">
          <DisclosureButton shown={shown} onToggle={() => setOpen(!shown)} controls={bodyId}>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Other cash on hand</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {filled
                  ? filledLinesText(filled)
                  : "Nil: cashier float, undeposited revenue and deposits, cash advances and other cash"}
              </span>
            </span>
          </DisclosureButton>
        </h4>
        {!shown && filled === 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Enter amounts
          </Button>
        )}
      </div>
      {shown && (
        <div id={bodyId} className="mt-3">
          <LinesEditor form={form} control={control} bounds={bounds} />
        </div>
      )}
    </div>
  );
}

// One F19 invoice. A foreign currency takes MMA's rate for the invoice month,
// locked unless the lookup fails (as on the PV form).
function PayableRow({
  index,
  control,
  getValues,
  setValue,
  onRemove,
}: {
  index: number;
  control: Control<FiyesFormValues>;
  getValues: UseFormGetValues<FiyesFormValues>;
  setValue: UseFormSetValue<FiyesFormValues>;
  onRemove: () => void;
}) {
  const trpc = useTRPC();
  const date = useWatch({ control, name: `payables.${index}.invoiceDate` });
  const currency = (useWatch({ control, name: `payables.${index}.currency` }) ?? "").trim().toUpperCase();
  const amountText = useWatch({ control, name: `payables.${index}.amount` });
  const rateText = useWatch({ control, name: `payables.${index}.exchangeRate` });
  const isMvr = currency === "MVR";
  const validDate = date instanceof Date && !isNaN(date.getTime());
  // Anchored mid-month in UTC so the month can't shift across the timezone.
  const rateMonth = validDate ? new Date(Date.UTC(date.getFullYear(), date.getMonth(), 15)) : undefined;
  const { data: rates } = useQuery({
    ...trpc.exchangeRates.get.queryOptions({ date: rateMonth }),
    enabled: !isMvr && validDate && /^[A-Z]{3}$/.test(currency),
    retry: false,
  });
  const lookedUp = isMvr ? 1 : (rates as Record<string, number> | undefined)?.[currency];
  const rateLocked = typeof lookedUp === "number";
  useEffect(() => {
    if (typeof lookedUp === "number" && toNumber(getValues(`payables.${index}.exchangeRate`)) !== lookedUp) {
      setValue(`payables.${index}.exchangeRate`, String(lookedUp), { shouldDirty: true });
    }
  }, [lookedUp, index, getValues, setValue]);

  const amount = toNumber(amountText);
  const rate = isMvr ? 1 : toNumber(rateText);
  const mvr = amount !== null && rate !== null ? Math.round(amount * rate * 100) / 100 : null;

  const text = (name: "invoiceNumber" | "vendorName" | "vendorAccount" | "details", label: string, className?: string) => (
    <FormField
      control={control}
      name={`payables.${index}.${name}`}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="text-xs">{label}</FormLabel>
          <FormControl>
            <Input {...field} className="h-9" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove invoice ${index + 1}`}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {text("invoiceNumber", "Invoice number")}
        <FormField
          control={control}
          name={`payables.${index}.invoiceDate`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Invoice date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn("h-9 w-full justify-between pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                    >
                      <span className="truncate">{field.value ? format(field.value, "yyyy-MM-dd") : "Pick a date"}</span>
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
        {text("vendorName", "Vendor name")}
        {text("vendorAccount", "Vendor account")}
        {text("details", "Details", "sm:col-span-2")}
        <FormField
          control={control}
          name={`payables.${index}.currency`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Currency</FormLabel>
              <FormControl>
                <Input {...field} maxLength={3} className="h-9 uppercase" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`payables.${index}.amount`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Amount</FormLabel>
              <FormControl>
                <Input {...field} inputMode="decimal" className="h-9 text-right font-mono tabular-nums" placeholder="0.00" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isMvr && (
          <FormField
            control={control}
            name={`payables.${index}.exchangeRate`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Rate (MVR per {currency || "unit"})</FormLabel>
                <FormControl>
                  <Input {...field} inputMode="decimal" readOnly={rateLocked} className="h-9 text-right font-mono tabular-nums" />
                </FormControl>
                <FormDescription className="text-xs">
                  {rateLocked ? "MMA rate for the invoice month." : "Enter the rate; MMA had none."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className={cn("flex flex-col justify-end", isMvr ? "lg:col-start-4" : "")}>
          <span className="text-xs font-medium">Amount in MVR</span>
          <span className="mt-2 flex h-9 items-center justify-end rounded-md border border-dashed bg-muted/40 px-3 font-mono text-sm tabular-nums">
            {mvr === null ? "—" : money(mvr)}
          </span>
        </div>
      </div>
    </div>
  );
}
