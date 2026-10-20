"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Banknote,
  CircleCheck,
  Eye,
  FilePen,
  Landmark,
  Plus,
  Search as SearchIcon,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CeaStatusPill } from "@/components/approval/StatusPill";
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
import { DownloadCeaPdf } from "@/components/cea/DownloadCeaPdf";
import { useHasPermission } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { formatNumberWithCommas } from "@/utils/helpers";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SIGNED", label: "Signed" },
] as const;

const CeaRegisterPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hasAccess = useHasPermission(PERMISSIONS.CEA_READ);
  const canCreate = useHasPermission(PERMISSIONS.CEA_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.CEA_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.CEA_EDIT_LOCKED);
  const canDelete = useHasPermission(PERMISSIONS.CEA_DELETE);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: forms, isLoading } = useQuery({
    ...trpc.cea.list.queryOptions(),
    enabled: hasAccess,
  });

  const deleteMutation = useMutation(
    trpc.cea.delete.mutationOptions({
      onSuccess: () => {
        toast({ title: "CEA form deleted" });
        queryClient.invalidateQueries({ queryKey: trpc.cea.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.procurement.pathKey() });
      },
      onError: (err) => toast({ title: "Could not delete", description: err.message }),
    }),
  );

  const rows = forms ?? [];

  const yearOptions = useMemo(() => {
    const years = new Set((forms ?? []).map((c) => new Date(c.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [forms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (forms ?? []).filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (year !== "all" && String(new Date(c.date).getFullYear()) !== year) return false;
      if (!q) return true;
      return [
        c.ceaNum,
        c.resolved.section ?? "",
        c.resolved.glAccount ? String(c.resolved.glAccount.code) : "",
        c.procurement?.title ?? "",
        c.requestedBy?.name ?? "",
        ...c.resolved.rows.map((r) => r.description ?? ""),
      ].some((text) => text.toLowerCase().includes(q));
    });
  }, [forms, status, year, query]);

  const stats = useMemo(() => {
    const list = forms ?? [];
    return {
      total: list.length,
      drafts: list.filter((c) => c.status === "DRAFT").length,
      signed: list.filter((c) => c.status === "SIGNED").length,
      value: list.reduce((sum, c) => sum + (c.resolved.total ?? 0), 0),
    };
  }, [forms]);

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
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">CEA Forms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capital expenditure authorizations: approval to buy capital items not in the PSIP.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/cea/create"
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
            <KpiCard label="Forms" icon={Landmark} value={stats.total.toString()} sub="all years" />
            <KpiCard label="Drafts" icon={FilePen} value={stats.drafts.toString()} sub="not signed yet" />
            <KpiCard label="Signed" icon={CircleCheck} value={stats.signed.toString()} sub="ready to print" />
            <KpiCard
              label="Value"
              icon={Banknote}
              value={`MVR ${formatNumberWithCommas(stats.value) ?? "0.00"}`}
              sub="estimated cost"
            />
          </>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by number, item, section, budget code or procurement..."
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
            <SelectTrigger className="h-9 w-[160px]">
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
            <Landmark className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {filtersActive ? "No forms match these filters" : "No CEA forms yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try adjusting or clearing the filters."
                : "Create one from its procurement once the purchase is evaluated, or start one here."}
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
                href="/cea/create"
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                <Plus className="size-4" />
                New Form
              </Link>
            ) : null}
          </div>
        ) : (
          filtered.map((c) => {
            const locked = c.status !== "DRAFT";
            const editAllowed = canUpdate && (!locked || canEditLocked);
            const href = `/cea/${encodeURIComponent(c.ceaNum)}`;
            const first = c.resolved.rows.find((r) => r.description)?.description;
            const more = c.resolved.rows.length - 1;
            return (
              <div
                key={c.id}
                className="group flex min-w-0 items-center gap-3 rounded-md border bg-card p-4 transition-shadow hover:shadow-sm sm:gap-6 sm:p-5"
              >
                <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
                  <div className="flex w-[150px] flex-shrink-0 flex-col sm:w-[230px]">
                    <span className="truncate font-mono text-sm font-medium tracking-tight" title={c.ceaNum}>
                      {c.ceaNum}
                    </span>
                    <span className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {format(new Date(c.date), "d MMM yyyy")}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm">
                      {first ? (
                        <span dir="rtl" className="font-faruma text-[15px]">{first}</span>
                      ) : (
                        <span className="text-muted-foreground/60">No items</span>
                      )}
                      {more > 0 && <span className="text-muted-foreground"> + {more} more</span>}
                    </span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                      <CeaStatusPill status={c.status} />
                      <span className="truncate text-[11px] text-muted-foreground">
                        {c.requestedBy?.name ?? "No requester"}
                        {c.procurement ? ` · ${c.procurement.title}` : ""}
                      </span>
                    </span>
                  </div>

                  <div className="hidden w-[180px] flex-shrink-0 flex-col items-end gap-1 md:flex">
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {c.resolved.total != null ? `MVR ${formatNumberWithCommas(c.resolved.total)}` : "—"}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {c.resolved.glAccount ? (
                        <span className="font-mono">{c.resolved.glAccount.code}</span>
                      ) : (
                        "No budget code"
                      )}
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
                      title={locked ? "Override edit (signed form)" : undefined}
                      onClick={() => router.push(`/cea/edit/${encodeURIComponent(c.ceaNum)}`)}
                      className={
                        locked
                          ? "text-amber-700 transition hover:text-amber-600 dark:text-amber-400"
                          : "transition hover:text-blue-600"
                      }
                    >
                      <SquarePen className="size-4" />
                    </button>
                  )}
                  <DownloadCeaPdf ceaNum={c.ceaNum} />
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button type="button" aria-label="Delete" className="transition hover:text-red-600">
                          <Trash2 className="size-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete CEA form {c.ceaNum}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The form, its items and its timeline are removed permanently. This
                            can&apos;t be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ ceaNum: c.ceaNum })}
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

export default CeaRegisterPage;
