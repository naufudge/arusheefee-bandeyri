import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}

export function KpiCard({ label, value, sub, icon: Icon }: KpiCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-md border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-4 font-mono text-2xl font-medium tracking-tight tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-md border bg-card p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-8 rounded-md" />
      </div>
      <Skeleton className="mt-5 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-24" />
    </div>
  );
}
