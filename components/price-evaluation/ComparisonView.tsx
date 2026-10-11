"use client";

import React, { useMemo } from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberWithCommas } from "@/utils/helpers";
import { computeComparison, isDhivehi, unitMvr } from "@/lib/price-eval";

const LETTERS = ["A", "B", "C"] as const;
const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";

interface Vendor {
  name: string;
  currency: string;
  exchangeRate: number;
  chargesGst: boolean;
  discountPercent?: number | null;
}
interface Item {
  id?: string;
  name: string;
  qty: number;
  rates: (number | null)[];
}

interface ComparisonViewProps {
  vendors: Vendor[];
  items: Item[];
  gstRate: number;
  selectedVendor: number | null;
}

/**
 * Read-only comparison for the detail page: the three totals as bars (the
 * chosen one solid), then the full item-by-vendor table.
 */
export function ComparisonView({ vendors, items, gstRate, selectedVendor }: ComparisonViewProps) {
  const comparison = useMemo(
    () => computeComparison(items, vendors, gstRate),
    [items, vendors, gstRate],
  );
  const { lowest, highest } = comparison;
  // The discount line only appears when a vendor actually offered one.
  const anyDiscount = comparison.vendors.some((t) => t.discount > 0);
  const max = Math.max(...comparison.vendors.map((t) => t.total), 0);
  const chosen = selectedVendor;
  const saving =
    chosen !== null && highest !== null && highest !== chosen
      ? comparison.vendors[highest].total - comparison.vendors[chosen].total
      : null;

  return (
    <div>
      {/* ---------- Totals as bars ---------- */}
      <div className="space-y-3 px-4 py-4 sm:px-5">
        {vendors.map((vendor, v) => {
          const t = comparison.vendors[v];
          const width = max > 0 && t.quotedAny ? Math.max(2, (t.total / max) * 100) : 0;
          const isChosen = chosen === v;
          return (
            // Phones: name and total on one line, the bar underneath.
            <div
              key={v}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,10rem)_1fr_auto]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded font-mono text-[10px] font-semibold",
                    isChosen ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                  )}
                >
                  {LETTERS[v]}
                </span>
                <span
                  className={cn(
                    "truncate text-sm",
                    isChosen ? "font-semibold" : "text-muted-foreground",
                    isDhivehi(vendor.name) && "font-faruma",
                  )}
                  title={vendor.name}
                >
                  {vendor.name || `Vendor ${LETTERS[v]}`}
                </span>
              </div>
              <div className="relative order-last col-span-2 h-2.5 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700",
                    isChosen ? "bg-foreground" : "bg-foreground/20",
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="flex items-center gap-2">
                {lowest === v && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Trophy className="size-2.5" />
                    Lowest
                  </span>
                )}
                <span
                  className={cn(
                    "text-right font-mono text-sm tabular-nums sm:w-28",
                    isChosen ? "font-semibold" : "text-muted-foreground",
                  )}
                >
                  {t.quotedAny ? money(t.total) : "—"}
                </span>
              </div>
            </div>
          );
        })}
        {saving !== null && saving > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">
            Choosing {vendors[chosen!]?.name} saves{" "}
            <span className="font-mono tabular-nums text-foreground">MVR {money(saving)}</span>{" "}
            against the highest quote
            {highest !== null && comparison.vendors[highest].total > 0
              ? ` (${Math.round((saving / comparison.vendors[highest].total) * 100)}%)`
              : ""}
            .
          </p>
        )}
        {chosen !== null && lowest !== null && chosen !== lowest && (
          <p className="pt-1 text-xs text-amber-700 dark:text-amber-400">
            The chosen vendor isn&apos;t the lowest — MVR{" "}
            {money(comparison.vendors[chosen].total - comparison.vendors[lowest].total)} more than{" "}
            {vendors[lowest]?.name}. See the reason.
          </p>
        )}
      </div>

      {/* ---------- Item-by-vendor table ---------- */}
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium sm:px-5">Item / service</th>
              <th className="px-2 py-2 text-right font-medium">Qty</th>
              {vendors.map((vendor, v) => (
                <th
                  key={v}
                  className={cn(
                    "border-l px-3 py-2 text-right font-medium",
                    chosen === v && "bg-foreground/[0.04] text-foreground",
                  )}
                >
                  <span className="normal-case tracking-normal">{vendor.name || `Vendor ${LETTERS[v]}`}</span>
                  {vendor.currency !== "MVR" && (
                    <span className="block font-mono text-[10px] normal-case tracking-normal">
                      {vendor.currency} @ {vendor.exchangeRate}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item, i) => (
              <tr key={item.id ?? i}>
                <td
                  className={cn("px-4 py-2.5 sm:px-5", isDhivehi(item.name) && "font-faruma text-right")}
                  dir={isDhivehi(item.name) ? "rtl" : undefined}
                >
                  {item.name}
                </td>
                <td className="px-2 py-2.5 text-right font-mono tabular-nums">{item.qty}</td>
                {vendors.map((vendor, v) => {
                  const rate = item.rates[v];
                  const line = comparison.vendors[v].lines[i];
                  const cheapest = comparison.cheapestLine[i];
                  const isCheapest = line !== null && cheapest !== null && line === cheapest;
                  return (
                    <td
                      key={v}
                      className={cn(
                        "border-l px-3 py-2.5 text-right",
                        chosen === v && "bg-foreground/[0.04]",
                        isCheapest && "bg-emerald-50/80 dark:bg-emerald-900/15",
                      )}
                    >
                      {line === null || rate == null ? (
                        <span className="text-muted-foreground/60">not quoted</span>
                      ) : (
                        <>
                          <div className="font-mono tabular-nums">
                            {isCheapest && (
                              <span className="mr-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-emerald-500" />
                            )}
                            {money(line)}
                          </div>
                          {(vendor.currency !== "MVR" || item.qty !== 1) && (
                            <div className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                              {vendor.currency !== "MVR"
                                ? `${vendor.currency} ${money(rate)} → ${money(unitMvr(rate, vendor.exchangeRate))}`
                                : money(rate)}
                              {item.qty !== 1 ? ` × ${item.qty}` : ""}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30 text-xs">
            <tr>
              <td className="px-4 pt-3 text-muted-foreground sm:px-5" colSpan={2}>Subtotal</td>
              {vendors.map((_, v) => (
                <td key={v} className={cn("border-l px-3 pt-3 text-right font-mono tabular-nums text-muted-foreground", chosen === v && "bg-foreground/[0.04]")}>
                  {comparison.vendors[v].quotedAny ? money(comparison.vendors[v].subtotal) : "—"}
                </td>
              ))}
            </tr>
            {anyDiscount && (
              <tr>
                <td className="px-4 pt-1 text-muted-foreground sm:px-5" colSpan={2}>Discount</td>
                {vendors.map((vendor, v) => (
                  <td key={v} className={cn("border-l px-3 pt-1 text-right font-mono tabular-nums", chosen === v && "bg-foreground/[0.04]")}>
                    {comparison.vendors[v].discount > 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        − {money(comparison.vendors[v].discount)}
                        <span className="ml-1 text-muted-foreground">({vendor.discountPercent}%)</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}
            <tr>
              <td className="px-4 pt-1 text-muted-foreground sm:px-5" colSpan={2}>GST {gstRate}%</td>
              {vendors.map((vendor, v) => (
                <td key={v} className={cn("border-l px-3 pt-1 text-right font-mono tabular-nums text-muted-foreground", chosen === v && "bg-foreground/[0.04]")}>
                  {vendor.chargesGst ? money(comparison.vendors[v].gst) : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 pb-3 pt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] sm:px-5" colSpan={2}>
                Total MVR
              </td>
              {vendors.map((_, v) => (
                <td
                  key={v}
                  className={cn(
                    "border-l px-3 pb-3 pt-1.5 text-right font-mono text-sm font-semibold tabular-nums",
                    chosen === v && "bg-foreground/[0.04]",
                    lowest === v && "text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  {comparison.vendors[v].quotedAny ? money(comparison.vendors[v].total) : "—"}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
