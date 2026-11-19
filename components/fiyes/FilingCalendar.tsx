"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, CalendarRange, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FiyesStatusPill } from "@/components/approval/StatusPill";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumberWithCommas } from "@/utils/helpers";
import { MONTH_NAMES, formsFor, periodHasStarted, periodKey } from "@/lib/fiyes";
import type { FiyesListItem } from "./types";

const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";
const formList = (kind: "MONTHLY" | "YEARLY") => formsFor(kind).map((f) => f.code.replace("-", " ")).join(", ");

/**
 * A year of Fiyes returns: twelve monthly tiles and the year-end return.
 * Gaps (months that have started with no return) are dashed, so what's
 * outstanding stands out at a glance.
 */
export function FilingCalendar({
  year,
  returns,
  isLoading,
  canCreate,
}: {
  year: number;
  returns: FiyesListItem[] | undefined;
  isLoading: boolean;
  canCreate: boolean;
}) {
  const byPeriod = new Map((returns ?? []).map((r) => [r.period, r]));
  const due = MONTH_NAMES.filter((_, i) => periodHasStarted({ kind: "MONTHLY", year, month: i + 1 })).length;
  const approved = (returns ?? []).filter((r) => r.kind === "MONTHLY" && r.status === "APPROVED").length;

  return (
    <>
      <section className="mt-6 rounded-md border bg-card">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 sm:px-5">
          <CalendarDays className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Monthly returns</h2>
          <span className="text-xs text-muted-foreground">{formList("MONTHLY")}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{approved}</span> of{" "}
            <span className="tabular-nums">{due}</span> {due === 1 ? "month" : "months"} approved
          </span>
        </header>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4 xl:grid-cols-6">
          {MONTH_NAMES.map((name, i) => {
            const period = periodKey({ kind: "MONTHLY", year, month: i + 1 });
            return isLoading ? (
              <Skeleton key={name} className="h-[118px] rounded-md" />
            ) : (
              <MonthTile
                key={name}
                name={name}
                period={period}
                started={periodHasStarted({ kind: "MONTHLY", year, month: i + 1 })}
                ret={byPeriod.get(period)}
                canCreate={canCreate}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-md border bg-card">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 sm:px-5">
          <CalendarRange className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Year-end return</h2>
          <span className="text-xs text-muted-foreground">{formList("YEARLY")}</span>
        </header>
        <div className="p-4 sm:p-5">
          {isLoading ? (
            <Skeleton className="h-[72px] rounded-md" />
          ) : (
            <YearTile year={year} ret={byPeriod.get(String(year))} canCreate={canCreate} />
          )}
        </div>
      </section>
    </>
  );
}

function MonthTile({
  name,
  period,
  started,
  ret,
  canCreate,
}: {
  name: string;
  period: string;
  started: boolean;
  ret: FiyesListItem | undefined;
  canCreate: boolean;
}) {
  const short = name.slice(0, 3);
  if (ret) {
    return (
      <Link
        href={`/fiyes/${period}`}
        className="flex min-h-[118px] flex-col rounded-md border bg-background p-3 transition hover:border-foreground/30 hover:shadow-sm"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">{short}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{period}</span>
        </div>
        <FiyesStatusPill status={ret.status} className="mt-1.5 self-start" />
        <div className="mt-auto pt-3">
          {ret.pettyCashClosing === null ? (
            <span className="text-xs text-muted-foreground">Petty cash not entered</span>
          ) : (
            <>
              <div className="font-mono text-base font-semibold tabular-nums">
                <span className="mr-1 text-[10px] font-normal text-muted-foreground">MVR</span>
                {money(ret.pettyCashClosing)}
              </div>
              <div className="text-[10px] text-muted-foreground">petty cash at month end</div>
            </>
          )}
        </div>
      </Link>
    );
  }

  // Not filed yet: a gap to fill (months that have started), or not open yet.
  return (
    <div
      className={cn(
        "flex min-h-[118px] flex-col rounded-md border border-dashed p-3",
        started ? "border-foreground/25" : "border-border bg-muted/30 text-muted-foreground",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{short}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{period}</span>
      </div>
      <span className="mt-1.5 text-xs text-muted-foreground">{started ? "Not started" : `Opens 1 ${short}`}</span>
      {started && canCreate && (
        <Link
          href={`/fiyes/create?period=${period}`}
          className="mt-auto inline-flex items-center gap-1 self-start rounded-md border bg-background px-2 py-1 text-xs font-medium transition hover:bg-muted"
        >
          <Plus className="size-3.5" />
          Start return
        </Link>
      )}
    </div>
  );
}

function YearTile({ year, ret, canCreate }: { year: number; ret: FiyesListItem | undefined; canCreate: boolean }) {
  const started = periodHasStarted({ kind: "YEARLY", year, month: null });
  if (ret) {
    return (
      <Link
        href={`/fiyes/${year}`}
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border bg-background p-4 transition hover:border-foreground/30 hover:shadow-sm"
      >
        <div>
          <div className="text-sm font-semibold">Financial year {year}</div>
          <div className="text-xs text-muted-foreground">Dated {format(new Date(ret.documentDate), "d MMM yyyy")}</div>
        </div>
        <FiyesStatusPill status={ret.status} />
        <div className="ml-auto text-right">
          <div className="font-mono text-base font-semibold tabular-nums">
            <span className="mr-1 text-[10px] font-normal text-muted-foreground">MVR</span>
            {money(ret.payableTotal)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {ret.payableCount === 0
              ? "no payables (nil F19)"
              : `${ret.payableCount} ${ret.payableCount === 1 ? "payable" : "payables"} at year end`}
          </div>
        </div>
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-foreground/25 p-4">
      <div>
        <div className="text-sm font-semibold">Financial year {year}</div>
        <div className="text-xs text-muted-foreground">
          {started ? "Not started. It's filed once the year has closed." : `Opens in ${year}`}
        </div>
      </div>
      {started && canCreate && (
        <Link
          href={`/fiyes/create?period=${year}`}
          className="ml-auto inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
        >
          <Plus className="size-3.5" />
          Start year-end return
        </Link>
      )}
    </div>
  );
}
