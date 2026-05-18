"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

/**
 * Sidebar-only badge showing how many approve/reject actions are
 * currently waiting on the signed-in user. Renders nothing when the
 * count is 0 (or while the query is loading) so the nav row looks
 * clean. Same amber tone the StatusPill uses for pending states, so the
 * visual language is consistent.
 *
 * Driven by the `approvals.pendingCount` tRPC query, which is
 * invalidated by every approve/reject mutation in PVActionBar /
 * PCActionBar — so the badge auto-decrements after the user acts.
 */
export function PendingApprovalsBadge() {
  const trpc = useTRPC();
  const { data: count } = useQuery({
    ...trpc.approvals.pendingCount.queryOptions(),
    // Stale-while-revalidate: badge stays visible during background
    // refetches; explicit invalidations keep it fresh on mutations.
    staleTime: 30_000,
  });

  if (!count) return null;

  return (
    <span
      aria-label={`${count} pending approvals`}
      className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium tabular-nums text-amber-700 dark:text-amber-400"
    >
      {count}
    </span>
  );
}
