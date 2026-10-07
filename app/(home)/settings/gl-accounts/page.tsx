"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ListTree,
  ChevronLeft,
  ChevronRight,
  Link2,
  Plus,
  Search as SearchIcon,
  SquarePen,
  Wallet,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, KpiSkeleton } from "@/components/Dashboard/KpiCard";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { GlAccountDialog } from "@/components/Settings/GlAccounts/GlAccountDialog";
import { DeleteGlAccountButton } from "@/components/Settings/GlAccounts/DeleteGlAccountButton";
import { useHasPermission } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";

const PAGE_SIZE = 50;

type Filter = "all" | "pettyCash" | "inUse";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pettyCash", label: "Petty cash allowed" },
  { value: "inUse", label: "In use" },
];

const HEAD =
  "h-9 whitespace-nowrap text-[10px] font-medium uppercase tracking-wider text-muted-foreground";

// Page numbers with ellipses, e.g. 1 … 4 5 6 … 16.
function buildPageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) items.push("…");
  for (let p = left; p <= right; p++) items.push(p);
  if (right < total - 1) items.push("…");
  items.push(total);
  return items;
}

const GlAccountsPage = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hasAccess = useHasPermission(PERMISSIONS.GLACCOUNT_READ);
  const canCreate = useHasPermission(PERMISSIONS.GLACCOUNT_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.GLACCOUNT_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.GLACCOUNT_DELETE);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(searchInput);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: accounts, isLoading } = useQuery({
    ...trpc.glAccounts.listWithUsage.queryOptions(),
    enabled: hasAccess,
  });

  // Inline petty cash tick. Refreshes the pickers too, so the petty cash
  // form sees the change without waiting out its cache.
  const togglePettyCash = useMutation(
    trpc.glAccounts.update.mutationOptions({
      onSuccess: (account) => {
        queryClient.invalidateQueries({ queryKey: trpc.glAccounts.listWithUsage.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.glAccounts.list.queryKey() });
        toast({
          title: account.pettyCashAllowed
            ? "Allowed for petty cash"
            : "No longer allowed for petty cash",
          description: `${account.code} · ${account.longTextEn}`,
        });
      },
      onError: (err) =>
        toast({ title: "Could not update GL account", description: err.message }),
    }),
  );

  const rows = useMemo(
    () =>
      (accounts ?? []).map((a) => ({
        ...a,
        usage: a._count.glDetails + a._count.pettyCash,
      })),
    [accounts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((a) => {
      if (filter === "pettyCash" && !a.pettyCashAllowed) return false;
      if (filter === "inUse" && a.usage === 0) return false;
      if (!q) return true;
      return [
        String(a.code),
        a.shortTextEn,
        a.longTextEn,
        a.shortTextDv ?? "",
        a.longTextDv ?? "",
      ].some((text) => text.toLowerCase().includes(q));
    });
  }, [rows, query, filter]);

  const stats = useMemo(() => {
    if (!accounts) return null;
    return {
      total: rows.length,
      pettyCash: rows.filter((a) => a.pettyCashAllowed).length,
      inUse: rows.filter((a) => a.usage > 0).length,
    };
  }, [accounts, rows]);

  // Clamp during render so the page stays valid after filtering / deleting.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const startIdx = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const filtersActive = Boolean(query) || filter !== "all";
  const showActions = canUpdate || canDelete;

  const clearFilters = () => {
    setSearchInput("");
    setQuery("");
    setFilter("all");
    setPage(1);
  };

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Settings &middot; GL Accounts
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Chart of Accounts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            GL codes that can be charged on PVs. Tick an account to make it
            available on petty cash forms.
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-3">
            <GlAccountDialog
              trigger={
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
                >
                  <Plus className="size-4" />
                  Add account
                </button>
              }
            />
          </div>
        )}
      </header>

      {/* KPI strip */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading || !stats ? (
          Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="GL Accounts"
              icon={ListTree}
              value={stats.total.toString()}
              sub="in the chart of accounts"
            />
            <KpiCard
              label="Petty Cash"
              icon={Wallet}
              value={stats.pettyCash.toString()}
              sub={`${stats.pettyCash === 1 ? "account" : "accounts"} allowed on petty cash`}
            />
            <KpiCard
              label="In Use"
              icon={Link2}
              value={stats.inUse.toString()}
              sub="used by PVs or petty cash"
            />
          </>
        )}
      </section>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by code or name (English or Dhivehi)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Filter accounts"
            className="inline-flex h-9 items-center rounded-md border bg-background p-0.5"
          >
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => {
                  setFilter(f.value);
                  setPage(1);
                }}
                className={`h-full whitespace-nowrap rounded px-2.5 text-xs font-medium transition ${
                  filter === f.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      {!isLoading && (
        <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Showing{" "}
          <span className="font-mono tabular-nums text-foreground">
            {startIdx}–{endIdx}
          </span>{" "}
          of{" "}
          <span className="font-mono tabular-nums text-foreground">
            {filtered.length}
          </span>
          {filtersActive && (
            <>
              {" "}
              (from{" "}
              <span className="font-mono tabular-nums">{rows.length}</span>)
            </>
          )}
        </div>
      )}

      {/* Accounts table */}
      <div className="mt-4 rounded-md border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ListTree className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {filtersActive
                ? "No GL accounts match"
                : "No GL accounts yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtersActive
                ? "Try a different code or name, or another filter."
                : "Add accounts from the government Chart of Accounts."}
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${HEAD} w-[90px] pl-6`}>Code</TableHead>
                  <TableHead className={HEAD}>Name</TableHead>
                  <TableHead className={`${HEAD} hidden text-right md:table-cell`}>
                    Dhivehi
                  </TableHead>
                  <TableHead className={`${HEAD} w-[120px] px-4 text-center`}>
                    Petty cash
                  </TableHead>
                  <TableHead className={`${HEAD} w-[110px] text-right`}>
                    Used by
                  </TableHead>
                  {showActions && (
                    <TableHead className={`${HEAD} w-[90px] pr-6 text-right`}>
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((a) => {
                  const toggling =
                    togglePettyCash.isPending &&
                    togglePettyCash.variables?.id === a.id;
                  return (
                    <TableRow key={a.id} className="transition hover:bg-muted/40">
                      <TableCell className="pl-6 font-mono text-sm tabular-nums">
                        {a.code}
                      </TableCell>
                      <TableCell className="max-w-[420px] text-sm font-medium">
                        {a.longTextEn}
                      </TableCell>
                      <TableCell
                        dir="rtl"
                        className="hidden max-w-[260px] text-right font-faruma text-[15px] text-muted-foreground md:table-cell"
                      >
                        {a.longTextDv ?? (
                          <span dir="ltr" className="font-poppins text-[11px] italic text-muted-foreground/60">
                            none
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={a.pettyCashAllowed}
                          disabled={!canUpdate || toggling}
                          onChange={(e) =>
                            togglePettyCash.mutate({
                              id: a.id,
                              pettyCashAllowed: e.target.checked,
                            })
                          }
                          aria-label={`Allow ${a.code} for petty cash`}
                          title={
                            canUpdate
                              ? undefined
                              : "You don't have permission to edit GL accounts"
                          }
                          className="size-3.5 cursor-pointer rounded border-input accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {a.usage === 0 ? (
                          <span className="text-muted-foreground/60">—</span>
                        ) : (
                          <div className="space-y-0.5 font-mono tabular-nums">
                            {a._count.glDetails > 0 && (
                              <div>{a._count.glDetails} PV</div>
                            )}
                            {a._count.pettyCash > 0 && (
                              <div>{a._count.pettyCash} PC</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      {showActions && (
                        <TableCell className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-3 text-muted-foreground">
                            {canUpdate && (
                              <GlAccountDialog
                                account={a}
                                usage={a.usage}
                                trigger={
                                  <button
                                    type="button"
                                    aria-label="Edit GL account"
                                    className="transition hover:text-blue-600"
                                  >
                                    <SquarePen className="size-4" />
                                  </button>
                                }
                              />
                            )}
                            {canDelete && (
                              <DeleteGlAccountButton account={a} usage={a.usage} />
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <nav
          className="mt-6 flex items-center justify-center gap-1 pb-12"
          aria-label="Pagination"
        >
          <button
            type="button"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {buildPageItems(currentPage, totalPages).map((item, i) =>
            item === "…" ? (
              <span key={`gap-${i}`} className="px-1.5 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                aria-current={item === currentPage ? "page" : undefined}
                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 font-mono text-sm tabular-nums transition ${
                  item === currentPage
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}

      {/* Bottom spacing when there's no pagination bar */}
      {!isLoading && totalPages === 1 && <div className="pb-12" />}
    </div>
  );
};

export default GlAccountsPage;
