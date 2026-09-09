"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  CircleDollarSign,
  FileSpreadsheet,
  Plus,
  ReceiptText,
  Store,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import RecentPvs from "@/components/Dashboard/RecentPvs";
import { KpiCard, KpiSkeleton } from "@/components/Dashboard/KpiCard";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { formatNumberWithCommas } from "@/utils/helpers";
import { toMvr } from "@/utils/currency";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export default function Home() {
  const [year, setYear] = useState<string>(CURRENT_YEAR.toString());
  const trpc = useTRPC();
  const hasAccess = useHasPermission(PERMISSIONS.DASHBOARD_READ);

  const { data: pvs, isLoading: pvsLoading } = useQuery({
    ...trpc.pv.byYear.queryOptions({ year }),
    enabled: hasAccess,
  });
  const { data: glData, isLoading: glLoading } = useQuery({
    ...trpc.pv.glTotalsByYear.queryOptions({ year }),
    enabled: hasAccess,
  });

  const stats = useMemo(() => {
    if (!pvs) return null;

    const vendors = new Set(pvs.map((p) => p.vendor));
    const processed = pvs.filter(
      (p) => p.transferNum && p.transferNum !== ""
    ).length;
    const pending = pvs.length - processed;

    let invoiceCount = 0;
    let totalExpenditure = 0;
    for (const pv of pvs) {
      invoiceCount += pv.invoices.length;
      for (const inv of pv.invoices) {
        for (const gl of inv.glDetails) {
          // GL amounts are in the PV's document currency; this figure is
          // reported as MVR.
          totalExpenditure += toMvr(gl.amount, pv.exchangeRate);
        }
      }
    }

    const avg = pvs.length > 0 ? totalExpenditure / pvs.length : 0;

    return {
      totalPvs: pvs.length,
      vendors: vendors.size,
      processed,
      pending,
      totalExpenditure,
      invoiceCount,
      avg,
    };
  }, [pvs]);

  const chartData = useMemo(() => {
    if (!glData) return [];
    return Object.entries(glData)
      .map(([code, value]) => ({ code, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [glData]);

  const isEmpty = !pvsLoading && pvs && pvs.length === 0;

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Budget Portal
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Arusheefee Bandeyri
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            National Archives of Maldives &middot; Fiscal Year {year}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
          >
            <Plus className="size-4" />
            New PV
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Period
            </span>
            <Select value={year} onValueChange={setYear}>
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
        {pvsLoading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total PVs"
              icon={ReceiptText}
              value={stats.totalPvs.toString()}
              sub={
                <>
                  <span className="text-emerald-700">{stats.processed} processed</span>
                  <span className="mx-1.5 text-muted-foreground/50">/</span>
                  <span>{stats.pending} pending</span>
                </>
              }
            />
            <KpiCard
              label="Vendors"
              icon={Store}
              value={stats.vendors.toString()}
              sub={`across ${stats.totalPvs} ${
                stats.totalPvs === 1 ? "voucher" : "vouchers"
              }`}
            />
            <KpiCard
              label="Total Expenditure"
              icon={CircleDollarSign}
              value={
                <>
                  <span className="mr-1.5 text-base font-medium text-muted-foreground">
                    MVR
                  </span>
                  {formatNumberWithCommas(stats.totalExpenditure) ?? "0.00"}
                </>
              }
              sub={`from ${stats.invoiceCount} ${
                stats.invoiceCount === 1 ? "invoice" : "invoices"
              }`}
            />
            <KpiCard
              label="Average per PV"
              icon={Banknote}
              value={
                <>
                  <span className="mr-1.5 text-base font-medium text-muted-foreground">
                    MVR
                  </span>
                  {formatNumberWithCommas(stats.avg) ?? "0.00"}
                </>
              }
              sub="mean voucher value"
            />
          </>
        )}
      </section>

      {/* Empty state */}
      {isEmpty && (
        <div className="mt-6 rounded-md border bg-card p-12 text-center">
          <FileSpreadsheet className="mx-auto size-10 text-muted-foreground/60" />
          <h2 className="mt-4 text-base font-semibold">
            No payment vouchers recorded for {year}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Either choose a different fiscal year or create the first PV for
            this period.
          </p>
          <Link
            href="/create"
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
          >
            <Plus className="size-4" />
            Create PV
          </Link>
        </div>
      )}

      {/* Chart + Recent PVs */}
      {!isEmpty && (
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex flex-col rounded-md border bg-card p-6 lg:col-span-8">
            <div className="flex items-baseline justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Expenditure by GL Account
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Top {chartData.length || 8} accounts &middot; FY {year}
                </p>
              </div>
              {!glLoading && chartData.length > 0 && (
                <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground tabular-nums">
                  MVR
                </span>
              )}
            </div>

            <div className="mt-6 min-h-[320px] flex-1">
              {glLoading ? (
                <Skeleton className="h-full w-full" />
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No GL distribution data for {year}.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="code"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 12,
                        fontFamily: "var(--font-geist-mono)",
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={70}
                      tick={{
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                        fontFamily: "var(--font-geist-mono)",
                      }}
                      tickFormatter={(v: number) => formatCompact(v)}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      content={<ChartTooltip />}
                    />
                    <Bar
                      dataKey="value"
                      fill="hsl(var(--foreground))"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-card lg:col-span-4">
            {pvsLoading || !pvs ? (
              <div className="p-6">
                <Skeleton className="h-5 w-32" />
                <div className="mt-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <RecentPvs pvs={pvs} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        GL {label}
      </div>
      <div className="mt-1 font-mono tabular-nums">
        MVR {formatNumberWithCommas(payload[0].value) ?? "0.00"}
      </div>
    </div>
  );
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toString();
}
