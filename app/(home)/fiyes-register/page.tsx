"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { FilingCalendar } from "@/components/fiyes/FilingCalendar";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR - i);

const FiyesRegisterPage = () => {
  const trpc = useTRPC();
  const hasAccess = useHasPermission(PERMISSIONS.FIYES_READ);
  const canCreate = useHasPermission(PERMISSIONS.FIYES_CREATE);
  const [year, setYear] = useState(THIS_YEAR);

  const { data, isLoading } = useQuery({ ...trpc.fiyes.list.queryOptions({ year }), enabled: hasAccess });

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ministry of Finance</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Fiyes Returns</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Approve a return to get its Excel files to upload and its signed approval PDFs to attach.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canCreate && (
            <Link
              href="/fiyes/create"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
            >
              <Plus className="size-4" />
              New Return
            </Link>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Year</span>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9 w-[100px] font-mono tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)} className="font-mono tabular-nums">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <FilingCalendar year={year} returns={data} isLoading={isLoading} canCreate={canCreate} />
    </div>
  );
};

export default FiyesRegisterPage;
