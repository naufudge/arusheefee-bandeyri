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
  Lock,
  Plus,
  ReceiptText,
  Search as SearchIcon,
  SquarePen,
  Trash2,
} from "lucide-react";
import { PettyCashStatusPill } from "@/components/approval/StatusPill";
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
import DownloadPdf from "@/components/petty-cash/DownloadPdf";
import { KpiCard, KpiSkeleton } from "@/components/Dashboard/KpiCard";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { formatNumberWithCommas } from "@/utils/helpers";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

type StatusFilter = "" | "pending" | "approved";

const PettyCashRegisterPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hasAccess = useHasPermission(PERMISSIONS.PETTYCASH_READ);
  const canDelete = useHasPermission(PERMISSIONS.PETTYCASH_DELETE);
  const canCreate = useHasPermission(PERMISSIONS.PETTYCASH_CREATE);
  const canEditLocked = useHasPermission(PERMISSIONS.PETTYCASH_EDIT_LOCKED);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [status, setStatus] = useState<StatusFilter>("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: records, isLoading } = useQuery({
    ...trpc.pettycash.byYear.queryOptions({ year: String(year) }),
    enabled: hasAccess,
  });

  const deleteMutation = useMutation(
    trpc.pettycash.delete.mutationOptions({
      onSuccess: () => {
        toast({ title: "Deleted", description: "Petty cash record removed." });
        queryClient.invalidateQueries({
          queryKey: trpc.pettycash.byYear.queryKey({ year: String(year) }),
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message ?? "Could not delete.",
        });
      },
    }),
  );

  // Approval = all 5 roles signed off. Anything less is pending.
  const isApproved = (record: { handledBy: { isApproved: boolean } | null; procurementApprovedBy: { isApproved: boolean } | null; budgetCheckedBy: { isApproved: boolean } | null; balanceHandedOverBy: { isApproved: boolean } | null; balanceCollectedBy: { isApproved: boolean } | null }) =>
    !!record.handledBy?.isApproved &&
    !!record.procurementApprovedBy?.isApproved &&
    !!record.budgetCheckedBy?.isApproved &&
    !!record.balanceHandedOverBy?.isApproved &&
    !!record.balanceCollectedBy?.isApproved;

  const filtered = useMemo(() => {
    if (!records) return [];
    let result = [...records];

    if (status) {
      result = result.filter((r) =>
        status === "approved" ? isApproved(r) : !isApproved(r),
      );
    }

    if (query) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.pettyCashNum.toLowerCase().includes(q) ||
          r.formNum.toLowerCase().includes(q) ||
          r.sectionUnit.toLowerCase().includes(q),
      );
    }

    return result;
  }, [records, status, query]);

  const stats = useMemo(() => {
    const approved = filtered.filter(isApproved).length;
    const pending = filtered.length - approved;
    const totalValue = filtered.reduce(
      (sum, r) => sum + r.totalRequiredAmount,
      0,
    );
    return { total: filtered.length, approved, pending, totalValue };
  }, [filtered]);

  const formatDate = (d: Date | string) => new Date(d).toLocaleDateString("en-CA");

  const filtersActive = !!status || !!query;
  const handleClearAll = () => {
    setStatus("");
    setSearchInput("");
    setQuery("");
  };

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Petty Cash
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Petty Cash Register
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage all petty cash requests &middot; FY {year}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canCreate && (
            <Link
              href="/petty-cash/create"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
            >
              <Plus className="size-4" />
              New Petty Cash
            </Link>
          )}
          <div className="flex items-center gap-2" suppressHydrationWarning>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Period
            </span>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
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

      {/* KPIs */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total"
              icon={ReceiptText}
              value={stats.total.toString()}
              sub={
                filtersActive
                  ? `of ${records?.length ?? 0} for FY ${year}`
                  : `records in FY ${year}`
              }
            />
            <KpiCard
              label="Approved"
              icon={CircleCheck}
              value={stats.approved.toString()}
              sub={
                <span className="text-emerald-700">
                  {stats.total === 0
                    ? "0%"
                    : `${Math.round((stats.approved / stats.total) * 100)}% complete`}
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
                  : `${stats.pending === 1 ? "record" : "records"} awaiting approval`
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
              sub="across visible records"
            />
          </>
        )}
      </section>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by petty cash #, form #, or section..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Select
          value={status || "all"}
          onValueChange={(v) =>
            setStatus(v === "all" ? "" : (v as StatusFilter))
          }
        >
          <SelectTrigger className="h-9 w-[150px] text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
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

      {!isLoading && (
        <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Showing{" "}
          <span className="font-mono tabular-nums text-foreground">
            {filtered.length}
          </span>{" "}
          of{" "}
          <span className="font-mono tabular-nums">{records?.length ?? 0}</span>
        </div>
      )}

      {/* List */}
      <div className="mt-4 flex flex-col gap-3 pb-12">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-md" />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-md border bg-card p-12 text-center">
            <FileSpreadsheet className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {filtersActive
                ? "No records match these filters"
                : `No petty cash records for ${year}`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try adjusting or clearing the filters."
                : "Either choose a different fiscal year or create the first record."}
            </p>
            {filtersActive ? (
              <button
                type="button"
                onClick={handleClearAll}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                Clear filters
              </button>
            ) : canCreate ? (
              <Link
                href="/petty-cash/create"
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                <Plus className="size-4" />
                Create petty cash
              </Link>
            ) : null}
          </div>
        ) : (
          filtered.map((record) => {
            const approved = isApproved(record);
            const roles = [
              record.handledBy,
              record.procurementApprovedBy,
              record.budgetCheckedBy,
              record.balanceHandedOverBy,
              record.balanceCollectedBy,
            ];
            const approvedCount = roles.filter((r) => r?.isApproved).length;
            const totalAssigned = roles.filter((r) => r !== null).length;
            return (
              <div
                key={record.id}
                className="group flex min-w-0 items-center gap-3 rounded-md border bg-card p-4 transition-shadow hover:shadow-sm sm:gap-6 sm:p-5"
              >
                <Link
                  href={`/petty-cash/${record.pettyCashNum}`}
                  className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6"
                >
                  <div
                    className="max-w-[140px] flex-shrink-0 truncate font-mono text-sm font-medium tracking-tight sm:max-w-[180px]"
                    title={record.pettyCashNum}
                  >
                    {record.pettyCashNum}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    {(() => {
                      const itemList = record.items
                        .map((it) => it.name || it.nameDhivehi || "")
                        .filter((n) => n.length > 0)
                        .join(", ");
                      return (
                        <span className="truncate text-sm" title={itemList}>
                          {itemList || "—"}
                        </span>
                      );
                    })()}
                    <span className="mt-1 flex min-w-0 items-center gap-2">
                      <PettyCashStatusPill
                        approvedCount={approvedCount}
                        totalAssigned={totalAssigned}
                      />
                      <span className="truncate text-[11px] text-muted-foreground">
                        Form {record.formNum} &middot; {record.sectionUnit}
                      </span>
                    </span>
                  </div>

                  <div className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:block">
                    {formatDate(record.date)}
                  </div>

                  <div className="hidden text-right md:block">
                    <div className="font-mono text-sm tabular-nums">
                      {formatNumberWithCommas(record.totalRequiredAmount)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      MVR
                    </div>
                  </div>
                </Link>

                <div className="flex flex-shrink-0 items-center gap-2 text-muted-foreground sm:gap-3">
                  <Link
                    href={`/petty-cash/${record.pettyCashNum}`}
                    aria-label="View"
                    className="transition hover:text-foreground"
                    title="View detail"
                  >
                    <Eye className="size-4" />
                  </Link>
                  {approved && !canEditLocked ? (
                    <button
                      type="button"
                      aria-label="Edit (locked)"
                      disabled
                      className="cursor-not-allowed opacity-50"
                      title="Locked: fully approved"
                    >
                      <Lock className="size-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={approved ? "Override edit" : "Edit"}
                      onClick={() =>
                        router.push(`/petty-cash/edit/${record.pettyCashNum}`)
                      }
                      title={
                        approved ? "Override edit (fully approved)" : undefined
                      }
                      className={
                        approved
                          ? "text-amber-700 transition hover:text-amber-600 dark:text-amber-400"
                          : "transition hover:text-blue-600"
                      }
                    >
                      <SquarePen className="size-4" />
                    </button>
                  )}

                  <DownloadPdf pettyCashNum={record.pettyCashNum} />

                  {canDelete && (
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
                            This will permanently delete petty cash{" "}
                            <span className="font-mono">
                              {record.pettyCashNum}
                            </span>{" "}
                            from the register.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              deleteMutation.mutate({
                                pettyCashNum: record.pettyCashNum,
                              })
                            }
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

export default PettyCashRegisterPage;
