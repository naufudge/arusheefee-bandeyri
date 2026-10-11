"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CircleCheck,
  Clock,
  Eye,
  FileStack,
  Files,
  Plus,
  Search as SearchIcon,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AssetCreationStatusPill } from "@/components/approval/StatusPill";
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
import { DownloadAssetCreationPdf } from "@/components/asset-creation/DownloadAssetCreationPdf";
import { useHasPermission } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { formNumRange, requestTypeLabel } from "@/lib/asset-creation";
import { formatNumberWithCommas } from "@/utils/helpers";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "pending", label: "Awaiting a signature" },
  { value: "COMPLETED", label: "Completed" },
] as const;

const AssetCreationRegisterPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hasAccess = useHasPermission(PERMISSIONS.ASSETCREATION_READ);
  const canCreate = useHasPermission(PERMISSIONS.ASSETCREATION_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.ASSETCREATION_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.ASSETCREATION_EDIT_LOCKED);
  const canDelete = useHasPermission(PERMISSIONS.ASSETCREATION_DELETE);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: sets, isLoading } = useQuery({
    ...trpc.assetCreation.list.queryOptions(),
    enabled: hasAccess,
  });

  const deleteMutation = useMutation(
    trpc.assetCreation.delete.mutationOptions({
      onSuccess: () => {
        toast({ title: "Asset creation form deleted" });
        queryClient.invalidateQueries({ queryKey: trpc.assetCreation.list.queryKey() });
      },
      onError: (err) => toast({ title: "Could not delete", description: err.message }),
    }),
  );

  const rows = useMemo(
    () =>
      (sets ?? []).map((ac) => {
        const formNums = ac.forms.map((f) => f.formNum);
        return { ac, formNums, range: formNumRange(formNums) };
      }),
    [sets],
  );

  const yearOptions = useMemo(() => {
    const years = new Set(rows.map((r) => new Date(r.ac.createdAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ ac, formNums }) => {
      if (status === "pending" && !ac.status.startsWith("PENDING_")) return false;
      if (status !== "all" && status !== "pending" && ac.status !== status) return false;
      if (year !== "all" && String(new Date(ac.createdAt).getFullYear()) !== year) return false;
      if (!q) return true;
      return [
        ...formNums,
        ...ac.forms.map((f) => f.sapAssetNum ?? ""),
        ac.description1,
        ac.description2 ?? "",
        ac.vendor ?? "",
        ac.location,
        ac.requestedAssetClass,
      ].some((text) => text.toLowerCase().includes(q));
    });
  }, [rows, status, year, query]);

  const stats = useMemo(
    () => ({
      sets: rows.length,
      forms: rows.reduce((n, r) => n + r.formNums.length, 0),
      pending: rows.filter((r) => r.ac.status.startsWith("PENDING_")).length,
      completed: rows.filter((r) => r.ac.status === "COMPLETED").length,
    }),
    [rows],
  );

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
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Asset Creation Forms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SAP asset master data requests — authorised, then created in SAP and added to the
            asset register.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/asset-creation/create"
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted md:self-auto"
          >
            <Plus className="size-4" />
            New Form
          </Link>
        )}
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Sets" icon={FileStack} value={stats.sets.toString()} sub="of forms" />
            <KpiCard label="Forms" icon={Files} value={stats.forms.toString()} sub="SAP assets requested" />
            <KpiCard label="Pending" icon={Clock} value={stats.pending.toString()} sub="awaiting a signature" />
            <KpiCard label="Completed" icon={CircleCheck} value={stats.completed.toString()} sub="created in SAP" />
          </>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by form or SAP number, description, vendor or location..."
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
            <FileStack className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {filtersActive ? "No forms match these filters" : "No asset creation forms yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try adjusting or clearing the filters."
                : "Request a new SAP asset once its purchase is evaluated."}
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
                href="/asset-creation/create"
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                <Plus className="size-4" />
                New Form
              </Link>
            ) : null}
          </div>
        ) : (
          filtered.map(({ ac, formNums, range }) => {
            const locked = ac.status !== "DRAFT";
            const editAllowed = canUpdate && (!locked || canEditLocked);
            const first = formNums[0];
            const href = `/asset-creation/${encodeURIComponent(first)}`;
            const total = ac.originalValue != null ? ac.originalValue * formNums.length : null;
            return (
              <div
                key={ac.id}
                className="group flex min-w-0 items-center gap-3 rounded-md border bg-card p-4 transition-shadow hover:shadow-sm sm:gap-6 sm:p-5"
              >
                <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
                  <div className="flex w-[118px] flex-shrink-0 flex-col sm:w-[150px]">
                    <span className="truncate font-mono text-sm font-medium tracking-tight" title={range}>
                      {range}
                    </span>
                    {formNums.length > 1 && (
                      <span className="mt-0.5 text-[11px] text-muted-foreground">
                        {formNums.length} forms
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm" title={ac.description1}>
                      {ac.description1}
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                      <AssetCreationStatusPill status={ac.status} />
                      {ac.requestType !== "CREATE" && (
                        <span className="rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                          {requestTypeLabel(ac.requestType)}
                        </span>
                      )}
                      <span className="truncate text-[11px] tabular-nums text-muted-foreground">
                        {format(new Date(ac.createdAt), "d MMM yyyy")}
                        {ac.procurement ? ` · ${ac.procurement.title}` : ""}
                      </span>
                    </span>
                  </div>

                  <div className="hidden w-[200px] flex-shrink-0 flex-col items-end gap-1 md:flex">
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {total != null ? `MVR ${formatNumberWithCommas(total)}` : "—"}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      <span className="font-mono">{ac.assetClass ?? ac.requestedAssetClass}</span>
                      {" · "}
                      {ac.quantity} {ac.quantity === 1 ? "piece" : "pieces"}/form
                    </span>
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
                      title={locked ? "Override edit (sent set)" : undefined}
                      onClick={() => router.push(`/asset-creation/edit/${encodeURIComponent(first)}`)}
                      className={
                        locked
                          ? "text-amber-700 transition hover:text-amber-600 dark:text-amber-400"
                          : "transition hover:text-blue-600"
                      }
                    >
                      <SquarePen className="size-4" />
                    </button>
                  )}
                  <DownloadAssetCreationPdf formNum={first} />
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button type="button" aria-label="Delete" className="transition hover:text-red-600">
                          <Trash2 className="size-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {formNums.length > 1 ? `forms ${range}` : `form ${first}`}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The {formNums.length > 1 ? "forms" : "form"}, signatures and timeline are
                            removed permanently. Asset register entries made from it are kept. This
                            can&apos;t be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ formNum: first })}
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

export default AssetCreationRegisterPage;
