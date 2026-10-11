"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Clock, Plus, Search as SearchIcon, ShoppingBag, Wallet } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, KpiSkeleton } from "@/components/Dashboard/KpiCard";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { StageTracker, ProcurementStatusPill } from "@/components/procurement/StageTracker";
import { ProcurementDialog } from "@/components/procurement/ProcurementDialog";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { formatNumberWithCommas } from "@/utils/helpers";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
] as const;

const ProcurementRegisterPage = () => {
  const trpc = useTRPC();
  const hasAccess = useHasPermission(PERMISSIONS.PROCUREMENT_READ);
  const canCreate = useHasPermission(PERMISSIONS.PROCUREMENT_CREATE);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: procurements, isLoading } = useQuery({
    ...trpc.procurement.list.queryOptions(),
    enabled: hasAccess,
  });
  const rows = useMemo(() => procurements ?? [], [procurements]);

  const yearOptions = useMemo(() => {
    const years = new Set(rows.map((p) => new Date(p.createdAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (status === "ongoing" && p.progress.completed) return false;
      if (status === "completed" && !p.progress.completed) return false;
      if (year !== "all" && String(new Date(p.createdAt).getFullYear()) !== year) return false;
      if (!q) return true;
      // Title plus every linked document's number and key text.
      const haystack = [
        p.title,
        p.notes ?? "",
        p.gsrForm?.gsrFormNum ?? "",
        p.gsrForm?.itemsSummary ?? "",
        p.priceEvaluation?.evalNum ?? "",
        p.priceEvaluation?.itemsSummary ?? "",
        p.priceEvaluation?.vendorName ?? "",
        ...p.pvs.flatMap((pv) => [pv.pvNum, pv.vendor]),
        ...p.assets.flatMap((a) => [a.assetNum, a.assetName]),
        ...p.assetCreations.flatMap((ac) => [...ac.formNums, ac.description]),
      ];
      return haystack.some((text) => text.toLowerCase().includes(q));
    });
  }, [rows, status, year, query]);

  const stats = useMemo(() => {
    const paid = rows
      .flatMap((p) => p.pvs)
      .filter((pv) => pv.status === "POSTED")
      .reduce((s, pv) => s + pv.totalMvr, 0);
    return {
      total: rows.length,
      ongoing: rows.filter((p) => !p.progress.completed).length,
      completed: rows.filter((p) => p.progress.completed).length,
      paid,
    };
  }, [rows]);

  const filtersActive = status !== "all" || year !== "all" || Boolean(query);
  const clearAll = () => {
    setStatus("all");
    setYear("all");
    setSearchInput("");
    setQuery("");
  };

  if (!hasAccess) return <NoAccessCard />;

  const newButton = (className: string) => (
    <ProcurementDialog
      trigger={
        <button type="button" className={className}>
          <Plus className="size-4" />
          New Procurement
        </button>
      }
    />
  );

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Procurement</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Procurements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each purchase with its requisition, price evaluation, asset forms and payments.
          </p>
        </div>
        {canCreate &&
          newButton(
            "inline-flex h-9 items-center gap-1.5 self-start rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted md:self-auto",
          )}
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Total" icon={ShoppingBag} value={stats.total.toString()} sub="procurements" />
            <KpiCard label="Ongoing" icon={Clock} value={stats.ongoing.toString()} sub="not yet paid" />
            <KpiCard label="Completed" icon={CircleCheck} value={stats.completed.toString()} sub="PV posted" />
            <KpiCard
              label="Paid"
              icon={Wallet}
              value={formatNumberWithCommas(stats.paid, false) ?? "0"}
              sub="MVR, posted PVs"
            />
          </>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, document number, vendor or asset..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filtersActive && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {!isLoading && (
        <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Showing <span className="font-mono tabular-nums text-foreground">{filtered.length}</span> of{" "}
          <span className="font-mono tabular-nums">{rows.length}</span>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 pb-12">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] w-full rounded-md" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-md border bg-card p-12 text-center">
            <ShoppingBag className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {filtersActive ? "No procurements match these filters" : "No procurements yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try adjusting or clearing the filters."
                : "Start one to keep a purchase's GSR, price evaluation, asset forms and PVs together."}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearAll}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                Clear filters
              </button>
            ) : canCreate ? (
              <div className="mt-5">
                {newButton(
                  "inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted",
                )}
              </div>
            ) : null}
          </div>
        ) : (
          filtered.map((p) => {
            const chips = [
              p.gsrForm && `GSR ${p.gsrForm.gsrFormNum}`,
              p.priceEvaluation && `PE ${p.priceEvaluation.evalNum}`,
              ...p.assetCreations.map((ac) => `ACF ${ac.formRange}`),
              p.assets.length ? `${p.assets.length} asset${p.assets.length === 1 ? "" : "s"}` : null,
              ...p.pvs.map((pv) => `PV ${pv.pvNum}`),
            ].filter((c): c is string => Boolean(c));
            const paid = p.pvs.filter((pv) => pv.status === "POSTED").reduce((s, pv) => s + pv.totalMvr, 0);
            return (
              <Link
                key={p.id}
                href={`/procurement/${p.id}`}
                className="group flex min-w-0 flex-col gap-3 rounded-md border bg-card p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:p-5"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold" title={p.title}>
                    {p.title}
                  </span>
                  <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                    <ProcurementStatusPill progress={p.progress} />
                    {p.isAsset && (
                      <span className="rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                        Asset
                      </span>
                    )}
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {format(new Date(p.createdAt), "d MMM yyyy")}
                    </span>
                  </span>
                  {chips.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {chips.map((c) => (
                        <span
                          key={c}
                          className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground"
                        >
                          {c}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-2">
                  <StageTracker progress={p.progress} compact />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {paid > 0 ? `Paid MVR ${formatNumberWithCommas(paid)}` : p.priceEvaluation?.total != null ? `Evaluated MVR ${formatNumberWithCommas(p.priceEvaluation.total)}` : "—"}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProcurementRegisterPage;
