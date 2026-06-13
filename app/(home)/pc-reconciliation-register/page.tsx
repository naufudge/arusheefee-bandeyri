"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ClipboardCheck,
  CircleCheck,
  Clock,
  Eye,
  FileText,
  Plus,
  Search as SearchIcon,
  SquarePen,
  Trash2,
} from "lucide-react";
import { PcReconStatusPill } from "@/components/approval/StatusPill";
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
import DownloadReconciliationPdf from "@/components/treasury/DownloadReconciliationPdf";
import { KpiCard, KpiSkeleton } from "@/components/Dashboard/KpiCard";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_CHECK", label: "Awaiting check" },
  { value: "PENDING_AUTHORIZATION", label: "Awaiting authorization" },
  { value: "COMPLETED", label: "Completed" },
] as const;

// English period label derived from the report's Sunday→Thursday week range.
function periodEn(report: {
  weekStart: Date | string;
  weekEnd: Date | string;
}): string {
  return `${format(new Date(report.weekStart), "d MMM")} – ${format(
    new Date(report.weekEnd),
    "d MMM yyyy",
  )}`;
}

const ReconciliationRegisterPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hasAccess = useHasPermission(PERMISSIONS.PCRECON_READ);
  const canCreate = useHasPermission(PERMISSIONS.PCRECON_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.PCRECON_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.PCRECON_EDIT_LOCKED);
  const canDelete = useHasPermission(PERMISSIONS.PCRECON_DELETE);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: reports, isLoading: loading } = useQuery({
    ...trpc.pcRecon.list.queryOptions(),
    enabled: hasAccess,
  });

  const deleteMutation = useMutation(
    trpc.pcRecon.delete.mutationOptions({
      onSuccess: () => {
        toast({ title: "Success", description: "Report deleted." });
        queryClient.invalidateQueries({ queryKey: trpc.pcRecon.list.queryKey() });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unknown error occurred.",
        });
      },
    }),
  );

  const filtered = useMemo(() => {
    if (!reports) return [];
    let result = [...reports];
    if (status !== "all") result = result.filter((r) => r.status === status);
    if (query) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.reportNum.toLowerCase().includes(q) ||
          r.periodText.toLowerCase().includes(q),
      );
    }
    return result;
  }, [reports, status, query]);

  const stats = useMemo(() => {
    const all = reports ?? [];
    return {
      total: all.length,
      draft: all.filter((r) => r.status === "DRAFT").length,
      pending: all.filter(
        (r) =>
          r.status === "PENDING_CHECK" ||
          r.status === "PENDING_AUTHORIZATION",
      ).length,
      completed: all.filter((r) => r.status === "COMPLETED").length,
    };
  }, [reports]);

  const filtersActive = status !== "all" || Boolean(query);

  const handleClearAll = () => {
    setStatus("all");
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
            Reconciliation Register
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Weekly petty cash reconciliation reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canCreate && (
            <Link
              href="/pc-reconciliation/create"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
            >
              <Plus className="size-4" />
              New Report
            </Link>
          )}
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total"
              icon={ClipboardCheck}
              value={stats.total.toString()}
              sub="reports"
            />
            <KpiCard
              label="Draft"
              icon={FileText}
              value={stats.draft.toString()}
              sub="not yet sent"
            />
            <KpiCard
              label="Pending"
              icon={Clock}
              value={stats.pending.toString()}
              sub="awaiting approval"
            />
            <KpiCard
              label="Completed"
              icon={CircleCheck}
              value={stats.completed.toString()}
              sub="fully approved"
            />
          </>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by report # or period..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
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
              onClick={handleClearAll}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {!loading && (
        <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Showing{" "}
          <span className="font-mono tabular-nums text-foreground">
            {filtered.length}
          </span>{" "}
          of{" "}
          <span className="font-mono tabular-nums">{reports?.length ?? 0}</span>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 pb-12">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-md" />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-md border bg-card p-12 text-center">
            <ClipboardCheck className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {filtersActive
                ? "No reports match these filters"
                : "No reconciliation reports yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try adjusting or clearing the filters."
                : "Create the first weekly reconciliation report."}
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
                href="/pc-reconciliation/create"
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                <Plus className="size-4" />
                Create Report
              </Link>
            ) : null}
          </div>
        ) : (
          filtered.map((report) => {
            const locked = report.status !== "DRAFT";
            const editAllowed = canUpdate && (!locked || canEditLocked);
            return (
              <div
                key={report.id}
                className="group flex min-w-0 items-center gap-3 rounded-md border bg-card p-4 transition-shadow hover:shadow-sm sm:gap-6 sm:p-5"
              >
                <Link
                  href={`/pc-reconciliation/${encodeURIComponent(report.reportNum)}`}
                  className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6"
                >
                  <div
                    className="max-w-[120px] flex-shrink-0 truncate font-mono text-sm font-medium tracking-tight sm:max-w-[160px]"
                    title={report.reportNum}
                  >
                    {report.reportNum}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm" title={periodEn(report)}>
                      {periodEn(report)}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <PcReconStatusPill status={report.status} />
                      <span className="truncate text-[11px] text-muted-foreground">
                        {report.items.length}{" "}
                        {report.items.length === 1 ? "item" : "items"}
                      </span>
                    </span>
                  </div>
                </Link>

                <div className="flex flex-shrink-0 items-center gap-2 text-muted-foreground sm:gap-3">
                  <Link
                    href={`/pc-reconciliation/${encodeURIComponent(report.reportNum)}`}
                    aria-label="View"
                    className="transition hover:text-foreground"
                    title="View detail"
                  >
                    <Eye className="size-4" />
                  </Link>
                  {editAllowed && (
                    <button
                      type="button"
                      aria-label={locked ? "Override edit" : "Edit"}
                      onClick={() =>
                        router.push(
                          `/pc-reconciliation/edit/${encodeURIComponent(report.reportNum)}`,
                        )
                      }
                      title={locked ? "Override edit (locked report)" : undefined}
                      className={
                        locked
                          ? "text-amber-700 transition hover:text-amber-600 dark:text-amber-400"
                          : "transition hover:text-blue-600"
                      }
                    >
                      <SquarePen className="size-4" />
                    </button>
                  )}

                  <DownloadReconciliationPdf reportNum={report.reportNum} />

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
                            This action cannot be undone. This will permanently
                            delete report{" "}
                            <span className="font-mono">{report.reportNum}</span>
                            .
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              deleteMutation.mutate({
                                reportNum: report.reportNum,
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

export default ReconciliationRegisterPage;
