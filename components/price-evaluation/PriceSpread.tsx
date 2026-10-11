import React from "react";
import { cn } from "@/lib/utils";
import { formatNumberWithCommas } from "@/utils/helpers";

interface PriceSpreadProps {
  /** Total per vendor (MVR); null where the vendor didn't quote. */
  totals: (number | null)[];
  chosen: number | null;
  names: string[];
}

/**
 * The three quotes as ticks on a line from cheapest to dearest — the chosen
 * one solid — with what the choice saves against the highest quote.
 */
export function PriceSpread({ totals, chosen, names }: PriceSpreadProps) {
  const quoted = totals.filter((t): t is number => t !== null && t > 0);
  if (quoted.length < 2) return null;
  const min = Math.min(...quoted);
  const max = Math.max(...quoted);
  const range = max - min;
  const chosenTotal = chosen !== null ? totals[chosen] : null;
  const saves = chosenTotal != null ? max - chosenTotal : null;

  return (
    <div className="w-full max-w-[200px]">
      <div className="relative h-3">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        {totals.map((t, v) => {
          if (t === null || t <= 0) return null;
          const left = range > 0 ? ((t - min) / range) * 100 : 50;
          const isChosen = v === chosen;
          return (
            <span
              key={v}
              title={`${names[v] || `Vendor ${v + 1}`}: MVR ${formatNumberWithCommas(t)}`}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                isChosen
                  ? "z-10 size-2.5 bg-foreground ring-2 ring-card"
                  : "size-2 border border-foreground/40 bg-card",
              )}
              style={{ left: `${left}%` }}
            />
          );
        })}
      </div>
      {saves != null && saves > 0 && (
        <div className="mt-0.5 text-right text-[10.5px] text-muted-foreground">
          saves <span className="font-mono tabular-nums">MVR {formatNumberWithCommas(saves)}</span>
        </div>
      )}
    </div>
  );
}
