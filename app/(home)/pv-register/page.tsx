"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CircleCheck,
  Clock,
  Eye,
  FileSpreadsheet,
  Plus,
  Printer,
  ReceiptText,
  Search as SearchIcon,
  SquarePen,
  Trash2,
} from "lucide-react";
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
import Filter from "@/components/shared/Filter";
import ExportPVs from "@/components/pv/ExportPVs";
import ImportPvs from "@/components/pv/ImportPvs";
import { KpiCard, KpiSkeleton } from "@/components/Dashboard/KpiCard";
import { formatNumberWithCommas, removeDuplicates } from "@/utils/helpers";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FilterType } from "@/types";


const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const PvRegisterPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  const [filters, setFilters] = useState<FilterType>({
    year: CURRENT_YEAR,
    vendor: "",
    status: "",
  });

  // Debounce the search input -> query
  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch PVs for the selected fiscal year (server-side date-range filter)
  const { data: pvs, isLoading: loading } = useQuery(
    trpc.pv.byYear.queryOptions({ year: String(filters.year) })
  );

  const deleteMutation = useMutation(
    trpc.pv.delete.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Successfully deleted the PV.",
        });
        queryClient.invalidateQueries({
          queryKey: trpc.pv.byYear.queryKey({ year: String(filters.year) }),
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unknown error occurred.",
        });
      },
    })
  );

  const vendors = useMemo(
    () => (pvs ? removeDuplicates(pvs.map((p) => p.vendor).sort()) : []),
    [pvs]
  );

  const filteredPvs = useMemo(() => {
    if (!pvs) return [];
    let result = [...pvs];

    if (filters.vendor) {
      const v = filters.vendor.toLowerCase();
      result = result.filter((item) => item.vendor.toLowerCase() === v);
    }

    if (filters.status) {
      result = result.filter((item) =>
        filters.status === "pending"
          ? !item.transferNum || item.transferNum === ""
          : item.transferNum && item.transferNum !== ""
      );
    }

    if (query) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.pvNum.toLowerCase().includes(q) ||
          item.notes.toLowerCase().includes(q) ||
          item.vendor.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pvs, filters, query]);

  const stats = useMemo(() => {
    const processed = filteredPvs.filter(
      (p) => p.transferNum && p.transferNum !== ""
    ).length;
    const pending = filteredPvs.length - processed;
    const totalValue = filteredPvs.reduce(
      (sum, p) => sum + p.invoices.reduce((s, i) => s + i.invoiceTotal, 0),
      0
    );
    return {
      total: filteredPvs.length,
      processed,
      pending,
      totalValue,
    };
  }, [filteredPvs]);

  const totalForPv = (pv: { invoices: { invoiceTotal: number }[] }) =>
    pv.invoices.reduce((sum, i) => sum + i.invoiceTotal, 0);

  const formatDate = (d: Date | string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-CA"); // YYYY-MM-DD
  };

  const filtersActive =
    Boolean(filters.vendor) || Boolean(filters.status) || Boolean(query);

  const handleClearAll = () => {
    setFilters((prev) => ({ ...prev, vendor: "", status: "" }));
    setSearchInput("");
    setQuery("");
  };

  const handlePrintClick = (pvNum: string) => {
    localStorage.setItem("pvNum", pvNum);
    router.push("/print");
  };

  const handleDeleteClick = (pvNum: string) => {
    deleteMutation.mutate({ pvNum });
  };

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Payment Vouchers
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            PV Register
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage all payment vouchers &middot; FY {filters.year}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/create"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
          >
            <Plus className="size-4" />
            New PV
          </Link>
          <ImportPvs
            onImported={() =>
              queryClient.invalidateQueries({
                queryKey: trpc.pv.byYear.queryKey({
                  year: String(filters.year),
                }),
              })
            }
          />
          <ExportPVs year={filters.year} />
          <div className="flex items-center gap-2" suppressHydrationWarning>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Period
            </span>
            <Select
              value={String(filters.year)}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, year: Number(value) }))
              }
            >
              <SelectTrigger className="h-9 w-[110px] font-mono tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem
                    key={y}
                    value={y.toString()}
                    className="font-mono tabular-nums"
                  >
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* KPI strip */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total"
              icon={ReceiptText}
              value={stats.total.toString()}
              sub={
                filtersActive
                  ? `of ${pvs?.length ?? 0} for FY ${filters.year}`
                  : `vouchers in FY ${filters.year}`
              }
            />
            <KpiCard
              label="Processed"
              icon={CircleCheck}
              value={stats.processed.toString()}
              sub={
                <span className="text-emerald-700">
                  {stats.total === 0
                    ? "0%"
                    : `${Math.round((stats.processed / stats.total) * 100)}% complete`}
                </span>
              }
            />
            <KpiCard
              label="Pending"
              icon={Clock}
              value={stats.pending.toString()}
              sub={
                stats.pending === 0
                  ? "all caught up"
                  : `${stats.pending === 1 ? "voucher" : "vouchers"} awaiting transfer`
              }
            />
            <KpiCard
              label="Total Value"
              icon={Banknote}
              value={
                <>
                  <span className="mr-1.5 text-base font-medium text-muted-foreground">
                    MVR
                  </span>
                  {formatNumberWithCommas(stats.totalValue) ?? "0.00"}
                </>
              }
              sub="across visible vouchers"
            />
          </>
        )}
      </section>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by PV #, notes, or vendor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter
            vendors={vendors}
            filters={filters}
            setFilters={setFilters}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      {!loading && (
        <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Showing{" "}
          <span className="font-mono tabular-nums text-foreground">
            {filteredPvs.length}
          </span>{" "}
          of{" "}
          <span className="font-mono tabular-nums">{pvs?.length ?? 0}</span>
        </div>
      )}

      {/* PV list */}
      <div className="mt-4 flex flex-col gap-3 pb-12">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-md" />
          ))
        ) : filteredPvs.length === 0 ? (
          <div className="rounded-md border bg-card p-12 text-center">
            <FileSpreadsheet className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {filtersActive
                ? "No vouchers match these filters"
                : `No payment vouchers recorded for ${filters.year}`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try adjusting or clearing the filters."
                : "Either choose a different fiscal year or create the first PV for this period."}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={handleClearAll}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                Clear filters
              </button>
            ) : (
              <Link
                href="/create"
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                <Plus className="size-4" />
                Create PV
              </Link>
            )}
          </div>
        ) : (
          filteredPvs.map((pv) => {
            const processed = !!(pv.transferNum && pv.transferNum !== "");
            return (
              <div
                key={pv.id}
                className="group flex items-center gap-6 rounded-md border bg-card p-5 transition-shadow hover:shadow-sm"
              >
                <Link
                  href={`/edit/${pv.pvNum}`}
                  className="flex flex-1 items-center gap-6 min-w-0"
                >
                  {/* PV Number */}
                  <div className="font-mono text-sm font-medium tracking-tight">
                    {pv.pvNum}
                  </div>

                  {/* Description + vendor */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm" title={pv.notes}>
                      {pv.notes}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span
                        className={`size-1.5 rounded-full ${
                          processed ? "bg-emerald-600" : "bg-amber-500"
                        }`}
                      />
                      <span className="truncate text-[11px] text-muted-foreground">
                        {pv.vendor}
                      </span>
                    </span>
                  </div>

                  {/* Date */}
                  <div className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:block">
                    {formatDate(pv.date)}
                  </div>

                  {/* Amount */}
                  <div className="hidden text-right md:block">
                    <div className="font-mono text-sm tabular-nums">
                      {formatNumberWithCommas(totalForPv(pv))}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      MVR
                    </div>
                  </div>
                </Link>

                {/* Action icons */}
                <div className="flex items-center gap-3 text-muted-foreground">
                  <button
                    type="button"
                    aria-label="View"
                    className="transition hover:text-emerald-600"
                  >
                    <Eye className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Edit"
                    onClick={() => router.push(`/edit/${pv.pvNum}`)}
                    className="transition hover:text-blue-600"
                  >
                    <SquarePen className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Print"
                    onClick={() => handlePrintClick(pv.pvNum)}
                    className="transition hover:text-purple-600"
                  >
                    <Printer className="size-4" />
                  </button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label="Delete"
                        className="transition hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete PV{" "}
                          <span className="font-mono">{pv.pvNum}</span> from the
                          register.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteClick(pv.pvNum)}
                          className="bg-red-700 hover:bg-red-800"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PvRegisterPage;
