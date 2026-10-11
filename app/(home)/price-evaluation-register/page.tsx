"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CircleCheck,
  Clock,
  Eye,
  Plus,
  Scale,
  Search as SearchIcon,
  SquarePen,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PriceEvalStatusPill } from "@/components/approval/StatusPill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { DownloadPriceEvalPdf } from "@/components/price-evaluation/DownloadPriceEvalPdf";
import { PriceSpread } from "@/components/price-evaluation/PriceSpread";
import { useHasPermission } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { computeComparison } from "@/lib/price-eval";
import { formatNumberWithCommas } from "@/utils/helpers";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "pending", label: "Awaiting a signature" },
  { value: "APPROVED", label: "Approved" },
] as const;

const PriceEvaluationRegisterPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hasAccess = useHasPermission(PERMISSIONS.PRICEEVAL_READ);
  const canCreate = useHasPermission(PERMISSIONS.PRICEEVAL_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.PRICEEVAL_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.PRICEEVAL_EDIT_LOCKED);
  const canDelete = useHasPermission(PERMISSIONS.PRICEEVAL_DELETE);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: evaluations, isLoading } = useQuery({
    ...trpc.priceEval.list.queryOptions(),
    enabled: hasAccess,
  });

  const deleteMutation = useMutation(
    trpc.priceEval.delete.mutationOptions({
      onSuccess: () => {
        toast({ title: "Price evaluation deleted" });
        queryClient.invalidateQueries({ queryKey: trpc.priceEval.list.queryKey() });
      },
      onError: (err) => toast({ title: "Could not delete", description: err.message }),
    }),
  );

  // Each evaluation with its comparison worked out once.
  const rows = useMemo(
    () =>
      (evaluations ?? []).map((pe) => {
        const comparison = computeComparison(pe.items, pe.vendors, pe.gstRate);
        const chosen = pe.selectedVendor;
        return {
          pe,
          totals: comparison.vendors.map((t) => (t.quotedAny ? t.total : null)),
          chosenTotal: chosen !== null ? (comparison.vendors[chosen]?.total ?? null) : null,
          chosenName: chosen !== null ? (pe.vendors[chosen]?.name ?? null) : null,
          itemsLine: pe.items.map((it) => it.name.trim()).filter(Boolean).join(", "),
        };
      }),
    [evaluations],
  );

  const yearOptions = useMemo(() => {
    const years = new Set(rows.map((r) => new Date(r.pe.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ pe, itemsLine }) => {
      if (status === "pending" && !pe.status.startsWith("PENDING_")) return false;
      if (status !== "all" && status !== "pending" && pe.status !== status) return false;
      if (year !== "all" && String(new Date(pe.date).getFullYear()) !== year) return false;
      if (!q) return true;
      return [pe.evalNum, pe.section, itemsLine, ...pe.vendors.map((v) => v.name)]
        .some((text) => text.toLowerCase().includes(q));
    });
  }, [rows, status, year, query]);

  const stats = useMemo(() => {
    const approved = rows.filter((r) => r.pe.status === "APPROVED");
    return {
      total: rows.length,
      pending: rows.filter((r) => r.pe.status.startsWith("PENDING_")).length,
      approved: approved.length,
      approvedValue: approved.reduce((s, r) => s + (r.chosenTotal ?? 0), 0),
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

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Procurement</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Price Evaluations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendor quotes compared before buying, with their budget check and approvals.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/price-evaluation/create"
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted md:self-auto"
          >
            <Plus className="size-4" />
            New Evaluation
          </Link>
        )}
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Total" icon={Scale} value={stats.total.toString()} sub="evaluations" />
            <KpiCard label="Pending" icon={Clock} value={stats.pending.toString()} sub="awaiting a signature" />
            <KpiCard label="Approved" icon={CircleCheck} value={stats.approved.toString()} sub="ready to buy" />
            <KpiCard
              label="Approved value"
              icon={Wallet}
              value={formatNumberWithCommas(stats.approvedValue, false) ?? "0"}
              sub="MVR, chosen quotes"
            />
          </>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by number, item, vendor or section..."
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
            <SelectTrigger className="h-9 w-[200px]">
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
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[88px] w-full rounded-md" />)
        ) : filtered.length === 0 ? (
          <div className="rounded-md border bg-card p-12 text-center">
            <Scale className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {filtersActive ? "No evaluations match these filters" : "No price evaluations yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try adjusting or clearing the filters."
                : "Compare three vendors' quotes before the next purchase."}
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
              <Link
                href="/price-evaluation/create"
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                <Plus className="size-4" />
                New Evaluation
              </Link>
            ) : null}
          </div>
        ) : (
          filtered.map(({ pe, totals, chosenTotal, chosenName, itemsLine }) => {
            const locked = pe.status !== "DRAFT";
            const editAllowed = canUpdate && (!locked || canEditLocked);
            const href = `/price-evaluation/${encodeURIComponent(pe.evalNum)}`;
            return (
              <div
                key={pe.id}
                className="group flex min-w-0 items-center gap-3 rounded-md border bg-card p-4 transition-shadow hover:shadow-sm sm:gap-6 sm:p-5"
              >
                <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
                  <div className="w-[84px] flex-shrink-0 truncate font-mono text-sm font-medium tracking-tight" title={pe.evalNum}>
                    {pe.evalNum}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm" dir="auto" title={itemsLine}>
                      {itemsLine || "—"}
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-2">
                      <PriceEvalStatusPill status={pe.status} />
                      <span className="truncate text-[11px] tabular-nums text-muted-foreground">
                        {format(new Date(pe.date), "d MMM yyyy")}
                      </span>
                    </span>
                  </div>

                  <div className="hidden w-[220px] flex-shrink-0 flex-col items-end gap-1 md:flex">
                    {chosenName ? (
                      <span className="flex w-full items-baseline justify-end gap-2">
                        <span className="truncate text-xs text-muted-foreground" title={chosenName}>
                          {chosenName}
                        </span>
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {chosenTotal !== null ? formatNumberWithCommas(chosenTotal) : "—"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No vendor chosen</span>
                    )}
                    <PriceSpread totals={totals} chosen={pe.selectedVendor} names={pe.vendors.map((v) => v.name)} />
                  </div>
                </Link>

                <div className="flex flex-shrink-0 items-center gap-2 text-muted-foreground sm:gap-3">
                  <Link href={href} aria-label="View" title="View detail" className="transition hover:text-foreground">
                    <Eye className="size-4" />
                  </Link>
                  {editAllowed && (
                    <button
                      type="button"
                      aria-label={locked ? "Override edit" : "Edit"}
                      title={locked ? "Override edit (sent evaluation)" : undefined}
                      onClick={() => router.push(`/price-evaluation/edit/${encodeURIComponent(pe.evalNum)}`)}
                      className={
                        locked
                          ? "text-amber-700 transition hover:text-amber-600 dark:text-amber-400"
                          : "transition hover:text-blue-600"
                      }
                    >
                      <SquarePen className="size-4" />
                    </button>
                  )}
                  <DownloadPriceEvalPdf evalNum={pe.evalNum} />
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button type="button" aria-label="Delete" className="transition hover:text-red-600">
                          <Trash2 className="size-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete price evaluation {pe.evalNum}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Its quotes, signatures and timeline are removed permanently. This can&apos;t
                            be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ evalNum: pe.evalNum })}
                            className="bg-red-700 hover:bg-red-800"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PriceEvaluationRegisterPage;
