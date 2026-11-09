import React from "react";
import {
  BookText,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  Landmark,
  Package,
  Scale,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import {
  AssetCreationStatusPill,
  CeaStatusPill,
  GSRStatusPill,
  PcReconStatusPill,
  PettyCashStatusPill,
  PriceEvalStatusPill,
  StatusPill,
} from "@/components/approval/StatusPill";
import type { SearchModule } from "@/lib/search";
import { formatNumberWithCommas } from "@/utils/helpers";
import { cn } from "@/lib/utils";
import type { SearchGroup } from "./types";

// Same icons as the module's register in the sidebar.
export const MODULE_ICON: Record<SearchModule, React.ComponentType<{ className?: string }>> = {
  pv: BookText,
  pettycash: Wallet,
  gsr: ClipboardList,
  pcrecon: ClipboardCheck,
  priceeval: Scale,
  assetcreation: FileStack,
  asset: Package,
  procurement: ShoppingBag,
  cea: Landmark,
};

const THAANA = /[ހ-޿]/;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Marks each occurrence of the query, like a highlighter on a ledger. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="rounded-[2px] bg-amber-200/90 text-inherit dark:bg-amber-400/30"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * One line of text, set in Faruma right-to-left when it is Dhivehi. Kept
 * left-aligned so it stays beside its number, as the registers show it.
 */
export function Line({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const dhivehi = THAANA.test(text);
  return (
    <span
      dir={dhivehi ? "rtl" : undefined}
      title={text}
      className={cn("block truncate", dhivehi && "text-left font-faruma", className)}
    >
      <Highlight text={text} query={query} />
    </span>
  );
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD, as the registers show

// The group's own status pill, typed through the module discriminator.
function HitPill({ group, index }: { group: SearchGroup; index: number }) {
  switch (group.module) {
    case "pv": {
      const h = group.items[index];
      return <StatusPill status={h.status} parked={h.parked} />;
    }
    case "pettycash": {
      const h = group.items[index];
      return (
        <PettyCashStatusPill
          approvedCount={h.approvedCount}
          totalAssigned={h.totalAssigned}
          systemApproved={h.systemApproved}
        />
      );
    }
    case "gsr":
      return <GSRStatusPill status={group.items[index].status} />;
    case "pcrecon":
      return <PcReconStatusPill status={group.items[index].status} />;
    case "priceeval":
      return <PriceEvalStatusPill status={group.items[index].status} />;
    case "assetcreation":
      return <AssetCreationStatusPill status={group.items[index].status} />;
    case "cea":
      return <CeaStatusPill status={group.items[index].status} />;
    case "asset":
    case "procurement":
      return null;
  }
}

/** The body of one record result: number, text, pill, date. */
export function RecordRow({
  group,
  index,
  query,
}: {
  group: SearchGroup;
  index: number;
  query: string;
}) {
  const hit = group.items[index];
  const amount = group.module === "pv" ? group.items[index].amountMvr : null;
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-4">
        {hit.num && (
          <span
            title={hit.num}
            className="truncate font-mono text-[12.5px] font-medium tracking-tight sm:w-40 sm:shrink-0"
          >
            <Highlight text={hit.num} query={query} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <Line text={hit.title} query={query} className="text-[13px]" />
          {(hit.note || hit.subtitle) && (
            <Line
              text={hit.note ?? hit.subtitle ?? ""}
              query={query}
              className="text-[11px] text-muted-foreground"
            />
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <HitPill group={group} index={index} />
        {(hit.date || amount != null) && (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {amount != null && `MVR ${formatNumberWithCommas(amount) ?? "0.00"}`}
            {amount != null && hit.date && "  "}
            {hit.date && shortDate(hit.date)}
          </span>
        )}
      </span>
    </>
  );
}
