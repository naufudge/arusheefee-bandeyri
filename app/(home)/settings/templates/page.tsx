"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  LayoutTemplate,
  Plus,
  Search as SearchIcon,
  SquarePen,
} from "lucide-react";
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
import { TemplateDialog } from "@/components/Settings/Templates/TemplateDialog";
import { DeleteTemplateButton } from "@/components/Settings/Templates/DeleteTemplateButton";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC, useTRPCClient } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

// Local row shape — kept narrow so TS doesn't have to expand the full
// Prisma return type (which includes the recursive JsonValue on
// `values` and explodes the instantiation depth).
type TemplateListRow = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string | Date;
  createdBy: { id: string; name: string } | null;
};

const TemplatesPage = () => {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const hasAccess = useHasPermission(PERMISSIONS.PV_CREATE);
  const [query, setQuery] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: trpc.templates.list.queryKey(),
    queryFn: async (): Promise<TemplateListRow[]> => {
      // Cast result through unknown to bypass the deep JsonValue infer.
      const result = (await trpcClient.templates.list.query()) as unknown;
      return result as TemplateListRow[];
    },
    enabled: hasAccess,
  });

  const filtered = useMemo(() => {
    if (!templates) return [];
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q),
    );
  }, [templates, query]);

  const stats = useMemo(() => {
    if (!templates) return null;
    const total = templates.length;
    const recent = templates[0];
    return {
      total,
      recentName: recent?.name ?? "—",
      recentAt: recent?.updatedAt,
    };
  }, [templates]);

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Settings &middot; Templates
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Manage PV Templates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reuse common voucher layouts. Save a template from the{" "}
            <Link
              href="/create"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create PV
            </Link>{" "}
            page; rename or delete here.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
          >
            <Plus className="size-4" />
            Create PV
          </Link>
        </div>
      </header>

      {/* KPI strip */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
        {isLoading || !stats ? (
          Array.from({ length: 2 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total templates"
              icon={LayoutTemplate}
              value={stats.total.toString()}
              sub={
                stats.total === 0
                  ? "No templates saved yet"
                  : `${stats.total === 1 ? "template" : "templates"} ready to apply`
              }
            />
            <KpiCard
              label="Most recent"
              icon={SquarePen}
              value={
                <span className="text-base font-medium tracking-tight">
                  {stats.recentName}
                </span>
              }
              sub={
                stats.recentAt
                  ? `Updated ${format(new Date(stats.recentAt), "d MMM yyyy")}`
                  : "—"
              }
            />
          </>
        )}
      </section>

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or description..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Result count */}
      {!isLoading && (
        <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Showing{" "}
          <span className="font-mono tabular-nums text-foreground">
            {filtered.length}
          </span>{" "}
          of{" "}
          <span className="font-mono tabular-nums">
            {templates?.length ?? 0}
          </span>
        </div>
      )}

      {/* Templates table */}
      <div className="mt-4 rounded-md border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <LayoutTemplate className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              {query
                ? "No templates match your search"
                : "No templates saved yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {query
                ? "Try a different name or description."
                : "Save your first template from the Create PV page."}
            </p>
            {!query && (
              <Link
                href="/create"
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
              >
                <Plus className="size-4" />
                Go to Create PV
              </Link>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-[60px] pl-6 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  #
                </TableHead>
                <TableHead className="h-9 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="h-9 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Description
                </TableHead>
                <TableHead className="h-9 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Created by
                </TableHead>
                <TableHead className="h-9 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Updated
                </TableHead>
                <TableHead className="h-9 pr-6 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tpl, index) => (
                <TableRow
                  key={tpl.id}
                  className="transition hover:bg-muted/40"
                >
                  <TableCell className="pl-6 font-mono text-xs tabular-nums text-muted-foreground">
                    {(index + 1).toString().padStart(2, "0")}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {tpl.name}
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate text-sm text-muted-foreground">
                    {tpl.description || (
                      <span className="italic text-muted-foreground/60">
                        none
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tpl.createdBy?.name ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {format(new Date(tpl.updatedAt), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-3 text-muted-foreground">
                      <TemplateDialog
                        template={tpl}
                        trigger={
                          <button
                            type="button"
                            aria-label="Edit template"
                            className="transition hover:text-blue-600"
                          >
                            <SquarePen className="size-4" />
                          </button>
                        }
                      />
                      <DeleteTemplateButton template={tpl} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default TemplatesPage;
