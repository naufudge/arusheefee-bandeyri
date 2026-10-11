"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Check, Plus, Trash2, TriangleAlert, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Currencies, CurrencyFullNames } from "@/lib/constants/currencies";
import { formatNumberWithCommas } from "@/utils/helpers";
import {
  computeComparison,
  isDhivehi,
  unitMvr,
  VENDOR_COUNT,
} from "@/lib/price-eval";
import { toNumber, type PriceEvalFormValues } from "@/schemas/PriceEvalSchema";

const LETTERS = ["A", "B", "C"] as const;

const currencyOptions = [...Currencies].sort().map((code) => ({
  value: code,
  label: code,
  hint: CurrencyFullNames[code],
}));

const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";

// Item | Qty | three vendors | remove. The item column narrows on phones so
// more of the (horizontally scrolling) vendor columns stay in view.
const GRID =
  "grid grid-cols-[minmax(150px,1.5fr)_68px_repeat(3,minmax(200px,1fr))_40px] sm:grid-cols-[minmax(220px,1.5fr)_84px_repeat(3,minmax(200px,1fr))_44px]";

interface QuoteMatrixProps {
  /** Global GST % (the evaluation's own rate once it's been sent). */
  gstRate: number;
  /** MMA rates (MVR per unit) for the evaluation's month, when loaded. */
  mmaRates: Record<string, number> | undefined;
  /** e.g. "Jun 2026" — shown beside MMA-filled rates. */
  rateMonthLabel: string | null;
  /**
   * New evaluations: keep the cheapest vendor chosen as prices are entered,
   * until the user picks a vendor themselves.
   */
  autoSelectLowest?: boolean;
}

/**
 * The comparison at the heart of the price evaluation: items down the side,
 * the three vendors across, live MVR totals, and the cheapest options lit up.
 * Picking a vendor's footer chooses it.
 */
export function QuoteMatrix({
  gstRate,
  mmaRates,
  rateMonthLabel,
  autoSelectLowest = false,
}: QuoteMatrixProps) {
  const { control, register, setValue, formState } =
    useFormContext<PriceEvalFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const items = useWatch({ control, name: "items" });
  const vendors = useWatch({ control, name: "vendors" });
  const selected = useWatch({ control, name: "selectedVendor" });

  const comparison = useMemo(
    () =>
      computeComparison(
        (items ?? []).map((it) => ({
          qty: toNumber(it.qty) ?? 0,
          rates: it.rates.map(toNumber),
        })),
        (vendors ?? []).map((v) => ({
          exchangeRate: toNumber(v.exchangeRate) ?? 0,
          chargesGst: v.chargesGst,
          discountPercent: toNumber(v.discountPercent),
        })),
        gstRate,
      ),
    [items, vendors, gstRate],
  );

  const vendorName = (v: number) => vendors?.[v]?.name?.trim() || `Vendor ${LETTERS[v]}`;

  // Set once the user picks a vendor; from then on their choice stands.
  const pickedByUser = useRef(false);
  useEffect(() => {
    if (!autoSelectLowest || pickedByUser.current) return;
    if (comparison.lowest !== null && comparison.lowest !== selected) {
      setValue("selectedVendor", comparison.lowest, { shouldDirty: true });
    }
  }, [autoSelectLowest, comparison.lowest, selected, setValue]);

  function chooseVendor(v: number) {
    pickedByUser.current = true;
    setValue("selectedVendor", v, { shouldDirty: true });
  }

  function changeCurrency(v: number, currency: string) {
    setValue(`vendors.${v}.currency`, currency, { shouldDirty: true });
    if (currency === "MVR") {
      setValue(`vendors.${v}.exchangeRate`, "1", { shouldDirty: true });
      return;
    }
    const rate = mmaRates?.[currency];
    // Leave the field alone when MMA has no figure, so it stays editable.
    setValue(`vendors.${v}.exchangeRate`, typeof rate === "number" ? String(rate) : "", {
      shouldDirty: true,
    });
  }

  const itemErrors = formState.errors.items;
  const chosen = selected ?? null;
  const lowest = comparison.lowest;
  const highest = comparison.highest;
  const overLowest =
    chosen !== null && lowest !== null && chosen !== lowest
      ? comparison.vendors[chosen].total - comparison.vendors[lowest].total
      : 0;

  return (
    <div className="rounded-md border bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[810px] sm:min-w-[940px]">
          {/* ---------- Vendor headers ---------- */}
          <div className={cn(GRID, "border-b")}>
            <div className="sticky left-0 z-10 flex items-end bg-card px-4 pb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Item / service
            </div>
            <div className="flex items-end justify-end px-2 pb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Qty
            </div>
            {Array.from({ length: VENDOR_COUNT }, (_, v) => {
              const vendor = vendors?.[v];
              const foreign = vendor && vendor.currency !== "MVR";
              const mma = vendor ? mmaRates?.[vendor.currency] : undefined;
              const rateLocked = foreign && typeof mma === "number";
              return (
                <div
                  key={v}
                  className={cn(
                    "space-y-2 border-l px-3 pb-3 pt-3",
                    chosen === v && "bg-foreground/[0.035]",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-5 items-center justify-center rounded bg-foreground font-mono text-[10px] font-semibold text-background">
                      {LETTERS[v]}
                    </span>
                    {lowest === v && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <Trophy className="size-3" />
                        Lowest
                      </span>
                    )}
                  </div>
                  <input
                    {...register(`vendors.${v}.name`)}
                    placeholder={`Vendor ${LETTERS[v]} name`}
                    dir="auto"
                    className={cn(
                      "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm font-medium outline-none ring-offset-background placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      isDhivehi(vendor?.name ?? "") && "font-faruma text-[15px]",
                    )}
                  />
                  {/* MVR quotes need no conversion, so only foreign ones get a rate box. */}
                  <div className={cn("grid gap-1.5", foreign ? "grid-cols-[1fr_92px]" : "grid-cols-1")}>
                    <SearchableSelect
                      value={vendor?.currency ?? "MVR"}
                      onValueChange={(c) => changeCurrency(v, c)}
                      options={currencyOptions}
                      searchPlaceholder="Search currency…"
                      className="h-8 px-2 text-xs"
                      contentClassName="w-[min(18rem,90vw)]"
                    />
                    {foreign && (
                      <input
                        {...register(`vendors.${v}.exchangeRate`)}
                        inputMode="decimal"
                        readOnly={rateLocked}
                        title={
                          rateLocked
                            ? `MMA rate for ${rateMonthLabel ?? "this month"}`
                            : "MMA has no rate for this currency and month — enter it"
                        }
                        aria-label={`Vendor ${LETTERS[v]} MVR rate`}
                        className={cn(
                          "h-8 w-full rounded-md border border-input bg-background px-2 text-right font-mono text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          rateLocked ? "bg-muted/60 text-muted-foreground" : "border-amber-400",
                        )}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">
                      {foreign
                        ? rateLocked
                          ? `MVR per ${vendor.currency} · MMA ${rateMonthLabel ?? ""}`
                          : "Enter the MVR rate"
                        : "Prices in MVR"}
                    </span>
                    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        {...register(`vendors.${v}.chargesGst`)}
                        className="size-3.5 rounded border-input accent-foreground"
                      />
                      GST
                    </label>
                  </div>
                </div>
              );
            })}
            <div />
          </div>

          {/* ---------- Items ---------- */}
          {fields.map((field, i) => {
            const nameValue = items?.[i]?.name ?? "";
            const rowError = itemErrors?.[i];
            return (
              <div key={field.id} className={cn(GRID, "group border-b last:border-b-0")}>
                <div className="sticky left-0 z-10 flex flex-col justify-center gap-1 bg-card px-4 py-2.5">
                  <input
                    {...register(`items.${i}.name`)}
                    placeholder={i === 0 ? "e.g. Printer Servicing" : "Item or service"}
                    dir="auto"
                    className={cn(
                      "h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none transition hover:border-input focus-visible:border-input focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring",
                      isDhivehi(nameValue) && "font-faruma text-[15px]",
                      rowError?.name && "border-red-400",
                    )}
                  />
                  {rowError?.name && (
                    <span className="px-2 text-[11px] text-red-600">{rowError.name.message}</span>
                  )}
                </div>
                <div className="flex items-center px-2 py-2.5">
                  <input
                    {...register(`items.${i}.qty`)}
                    inputMode="decimal"
                    aria-label="Quantity"
                    className={cn(
                      "h-9 w-full rounded-md border border-input bg-background px-2 text-right font-mono text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      rowError?.qty && "border-red-400",
                    )}
                  />
                </div>
                {Array.from({ length: VENDOR_COUNT }, (_, v) => {
                  const line = comparison.vendors[v]?.lines[i] ?? null;
                  const cheapest = comparison.cheapestLine[i];
                  const isCheapest = line !== null && cheapest !== null && line === cheapest;
                  const vendor = vendors?.[v];
                  const rate = toNumber(items?.[i]?.rates?.[v]);
                  const foreign = vendor && vendor.currency !== "MVR";
                  const qty = toNumber(items?.[i]?.qty) ?? 0;
                  return (
                    <div
                      key={v}
                      className={cn(
                        "relative flex flex-col justify-center gap-1 border-l px-3 py-2.5 transition-colors",
                        chosen === v && "bg-foreground/[0.035]",
                        isCheapest && "bg-emerald-50/80 dark:bg-emerald-900/15",
                      )}
                    >
                      <div className="relative">
                        {foreign && (
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground">
                            {vendor.currency}
                          </span>
                        )}
                        <input
                          {...register(`items.${i}.rates.${v}`)}
                          inputMode="decimal"
                          placeholder="—"
                          aria-label={`${vendorName(v)} price for item ${i + 1}`}
                          className={cn(
                            "h-9 w-full rounded-md border bg-background pr-2 text-right font-mono text-sm tabular-nums outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring",
                            foreign ? "pl-10" : "pl-2",
                            rate === null ? "border-dashed border-input" : "border-input",
                            isCheapest && "border-emerald-400 dark:border-emerald-700",
                          )}
                        />
                        {isCheapest && (
                          <span
                            className="absolute -right-1 -top-1 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                            aria-label="Cheapest for this item"
                          />
                        )}
                      </div>
                      {line !== null && (foreign || qty !== 1) && (
                        <span className="text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
                          {foreign && rate !== null
                            ? `${money(unitMvr(rate, toNumber(vendor.exchangeRate) ?? 0))} × ${qty} = `
                            : `× ${qty} = `}
                          <span className="text-foreground/80">MVR {money(line)}</span>
                        </span>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center justify-center">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={`Remove item ${i + 1}`}
                      className="rounded p-1.5 text-muted-foreground opacity-60 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* ---------- Add item ---------- */}
          <div className="border-b px-4 py-2.5">
            <button
              type="button"
              onClick={() =>
                append({ name: "", qty: "1", rates: Array.from({ length: VENDOR_COUNT }, () => "") })
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed px-3 text-xs font-medium text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Add item
            </button>
          </div>

          {/* ---------- Totals + choose ---------- */}
          {/* One grid row per line so labels and figures stay aligned. */}
          <div className="bg-muted/30">
            <FooterRow label="Subtotal" chosen={chosen} className="pt-4">
              {(v) => (
                <span className="text-muted-foreground">
                  {comparison.vendors[v].quotedAny ? money(comparison.vendors[v].subtotal) : "—"}
                </span>
              )}
            </FooterRow>
            <FooterRow
              label={
                <>
                  Discount<span className="ml-1 text-muted-foreground/70">(optional)</span>
                </>
              }
              chosen={chosen}
            >
              {(v) => {
                const t = comparison.vendors[v];
                const error = formState.errors.vendors?.[v]?.discountPercent;
                return (
                  <div className="flex items-center justify-end gap-2">
                    {t.discount > 0 && (
                      <span className="text-emerald-700 dark:text-emerald-400">− {money(t.discount)}</span>
                    )}
                    <div className="relative w-[72px]">
                      <input
                        {...register(`vendors.${v}.discountPercent`)}
                        inputMode="decimal"
                        placeholder="—"
                        aria-label={`${vendorName(v)} discount percentage`}
                        title={error?.message}
                        className={cn(
                          "h-7 w-full rounded-md border border-input bg-background pl-2 pr-5 text-right font-mono text-xs tabular-nums outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring",
                          error && "border-red-400",
                        )}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>
                );
              }}
            </FooterRow>
            <FooterRow label={`GST ${gstRate}%`} chosen={chosen}>
              {(v) => (
                <span className="text-muted-foreground">
                  {vendors?.[v]?.chargesGst ? money(comparison.vendors[v].gst) : "—"}
                </span>
              )}
            </FooterRow>
            <FooterRow
              label={
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground">
                  Total MVR
                </span>
              }
              chosen={chosen}
              className="pt-2"
            >
              {(v) => (
                <span
                  className={cn(
                    "text-base font-semibold",
                    lowest === v && "text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  {comparison.vendors[v].quotedAny ? money(comparison.vendors[v].total) : "—"}
                </span>
              )}
            </FooterRow>
          <div className={GRID}>
            <div className="sticky left-0 z-10 bg-muted/30" />
            <div />
            {Array.from({ length: VENDOR_COUNT }, (_, v) => {
              const t = comparison.vendors[v];
              const isChosen = chosen === v;
              return (
                <div key={v} className={cn("border-l px-3 pb-4 pt-1", isChosen && "bg-foreground/[0.035]")}>
                  <button
                    type="button"
                    onClick={() => chooseVendor(v)}
                    aria-pressed={isChosen}
                    className={cn(
                      "mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition",
                      isChosen
                        ? "border-foreground bg-foreground text-background"
                        : "bg-background hover:border-foreground/40",
                    )}
                  >
                    {isChosen ? <Check className="size-3.5" /> : null}
                    {isChosen ? "Chosen" : `Choose ${vendorName(v)}`}
                  </button>
                  {t.quotedAny && !t.quotedAll && (
                    <div className="mt-1.5 text-center text-[10.5px] text-muted-foreground">
                      Didn&apos;t quote every item
                    </div>
                  )}
                </div>
              );
            })}
            <div />
          </div>
          </div>
        </div>
      </div>

      {/* ---------- Outcome strip ---------- */}
      {chosen !== null && comparison.vendors[chosen]?.quotedAny && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-3 text-sm",
            overLowest > 0
              ? "bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
              : "bg-emerald-50/60 text-emerald-900 dark:bg-emerald-900/15 dark:text-emerald-200",
          )}
        >
          {overLowest > 0 && lowest !== null ? (
            <>
              <TriangleAlert className="size-4 shrink-0" />
              <span>
                <span className="font-medium">{vendorName(chosen)}</span> isn&apos;t the lowest
                quote — MVR {money(overLowest)} more than {vendorName(lowest)}. Explain why in the
                reason below.
              </span>
            </>
          ) : (
            <>
              <Check className="size-4 shrink-0" />
              <span>
                Buying from <span className="font-medium">{vendorName(chosen)}</span> for{" "}
                <span className="font-mono font-semibold tabular-nums">
                  MVR {money(comparison.vendors[chosen].total)}
                </span>
                {highest !== null && highest !== chosen && (
                  <>
                    {" "}— saves{" "}
                    <span className="font-mono tabular-nums">
                      MVR {money(comparison.vendors[highest].total - comparison.vendors[chosen].total)}
                    </span>{" "}
                    against the highest quote.
                  </>
                )}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// A totals line: label on the left, one cell per vendor (right-aligned).
function FooterRow({
  label,
  chosen,
  className,
  children,
}: {
  label: React.ReactNode;
  chosen: number | null;
  className?: string;
  children: (v: number) => React.ReactNode;
}) {
  return (
    <div className={GRID}>
      <div className={cn("sticky left-0 z-10 flex items-center bg-muted/30 px-4 py-1 text-xs text-muted-foreground", className)}>
        {label}
      </div>
      <div />
      {Array.from({ length: VENDOR_COUNT }, (_, v) => (
        <div
          key={v}
          className={cn(
            "flex min-h-8 items-center justify-end border-l px-3 py-1 text-right font-mono text-xs tabular-nums",
            chosen === v && "bg-foreground/[0.035]",
            className,
          )}
        >
          {children(v)}
        </div>
      ))}
      <div />
    </div>
  );
}
