"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import type { ApprovalEventKind } from "@prisma/client";
import {
  ClipboardList,
  Eye,
  FileSpreadsheet,
  History,
  Inbox,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasAnyPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { KpiCard, KpiSkeleton } from "@/components/Dashboard/KpiCard";
import { StatusPill } from "@/components/approval/StatusPill";
import { PVActionBar } from "@/components/approval/PVActionBar";
import { PCActionBar } from "@/components/approval/PCActionBar";
import {
  KIND_ICON,
  KIND_LABEL,
  KIND_TONE,
  PC_ROLE_LABEL,
} from "@/components/approval/event-display";

type Tab = "pending" | "history";

function formatMVR(amount: number | null | undefined) {
  if (amount == null) return null;
  return `MVR ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const PendingApprovalsPage = () => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const hasAccess = useHasAnyPermission([
    PERMISSIONS.PV_READ,
    PERMISSIONS.PETTYCASH_READ,
  ]);

  const [tab, setTab] = useState<Tab>("pending");

  const { data: pending, isLoading: pendingLoading } = useQuery({
    ...trpc.approvals.pending.queryOptions(),
    enabled: hasAccess,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    ...trpc.approvals.history.queryOptions({ limit: 100 }),
    enabled: hasAccess && tab === "history",
  });

  const totals = useMemo(() => {
    const pvs = pending?.pvs.length ?? 0;
    const pcs = pending?.pcRoles.length ?? 0;
    return { pvs, pcs, total: pvs + pcs };
  }, [pending]);

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Inbox
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Pending Approvals
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Records awaiting your action — and your prior approval decisions.
          </p>
        </div>
      </header>

      {/* KPI strip */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pendingLoading ? (
          Array.from({ length: 3 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total pending"
              icon={Inbox}
              value={totals.total.toString()}
              sub={
                totals.total === 0
                  ? "Inbox zero"
                  : totals.total === 1
                    ? "1 item awaiting you"
                    : `${totals.total} items awaiting you`
              }
            />
            <KpiCard
              label="Payment vouchers"
              icon={ReceiptText}
              value={totals.pvs.toString()}
              sub={
                totals.pvs === 0
                  ? "No PV decisions queued"
                  : "Verifier or authoriser action"
              }
            />
            <KpiCard
              label="Petty cash"
              icon={Wallet}
              value={totals.pcs.toString()}
              sub={
                totals.pcs === 0
                  ? "No petty cash role waiting"
                  : "Role approvals queued"
              }
            />
          </>
        )}
      </section>

      {/* Tab toggle */}
      <div className="mt-6 inline-flex rounded-md border bg-card p-1">
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
          <ClipboardList className="size-3.5" />
          Pending
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          <History className="size-3.5" />
          History
        </TabButton>
      </div>

      {/* Body */}
      <div className="mt-4 pb-16">
        {tab === "pending" ? (
          <PendingTab
            data={pending}
            isLoading={pendingLoading}
            currentUserId={session?.user?.id}
          />
        ) : (
          <HistoryTab data={history} isLoading={historyLoading} />
        )}
      </div>
    </div>
  );
};

// ----- Tab control -----

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-[12.5px] font-medium transition ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ----- Pending tab -----

interface PendingTabProps {
  data:
    | {
        pvs: NonNullable<unknown>[];
        pcRoles: NonNullable<unknown>[];
      }
    | undefined;
  isLoading: boolean;
  currentUserId: string | undefined;
}

function PendingTab({ data, isLoading, currentUserId }: PendingTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-md" />
        ))}
      </div>
    );
  }

  const pvs =
    (data?.pvs as PvPendingRow[] | undefined) ?? ([] as PvPendingRow[]);
  const pcRoles =
    (data?.pcRoles as PcPendingRow[] | undefined) ?? ([] as PcPendingRow[]);

  if (pvs.length === 0 && pcRoles.length === 0) {
    return (
      <div className="rounded-md border bg-card p-12 text-center">
        <Inbox className="mx-auto size-10 text-muted-foreground/60" />
        <h2 className="mt-4 text-base font-semibold">Nothing waiting on you</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          When you&apos;re assigned as a verifier or authoriser, items will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {pvs.length > 0 && (
        <section>
          <header className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold">Payment vouchers</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
              {pvs.length}
            </span>
          </header>
          <div className="flex flex-col gap-3">
            {pvs.map((pv) => (
              <PvPendingCard
                key={pv.id}
                pv={pv}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        </section>
      )}

      {pcRoles.length > 0 && (
        <section>
          <header className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold">Petty cash roles</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
              {pcRoles.length}
            </span>
          </header>
          <div className="flex flex-col gap-3">
            {pcRoles.map((entry) => (
              <PcPendingCard key={`${entry.pettyCash.id}:${entry.role}`} entry={entry} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ----- PV pending row -----

type PvStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "PENDING_AUTHORISATION_ONE"
  | "PENDING_AUTHORISATION_TWO"
  | "APPROVED"
  | "REJECTED";

type PvPendingRow = {
  id: string;
  pvNum: string;
  vendor: string;
  currency: string;
  status: PvStatus;
  updatedAt: string | Date;
  verifiedById: string | null;
  authorisedByOneId: string | null;
  authorisedByTwoId: string | null;
  invoices: { invoiceTotal: number }[];
};

function PvPendingCard({
  pv,
  currentUserId,
}: {
  pv: PvPendingRow;
  currentUserId: string | undefined;
}) {
  const total = pv.invoices.reduce((s, inv) => s + inv.invoiceTotal, 0);
  const since = formatDistanceToNow(new Date(pv.updatedAt), { addSuffix: true });

  return (
    <div className="group flex min-w-0 flex-col gap-3 rounded-md border bg-card p-5 transition-shadow hover:shadow-sm md:flex-row md:items-center md:gap-6">
      <Link
        href={`/pv/${pv.pvNum}`}
        className="flex min-w-0 flex-1 items-center gap-6"
      >
        <div
          className="truncate font-mono text-sm font-medium tracking-tight max-w-[180px]"
          title={pv.pvNum}
        >
          {pv.pvNum}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm" title={pv.vendor}>
            {pv.vendor}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <StatusPill status={pv.status} />
            <span className="truncate text-[11px] text-muted-foreground">
              Waiting {since}
            </span>
          </span>
        </div>
        <div className="hidden text-right md:block">
          <div className="font-mono text-sm tabular-nums">
            {total.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {pv.currency}
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 md:flex-shrink-0">
        {currentUserId && (
          <PVActionBar
            pvNum={pv.pvNum}
            status={pv.status}
            currentUserId={currentUserId}
            verifiedById={pv.verifiedById}
            authorisedByOneId={pv.authorisedByOneId}
            authorisedByTwoId={pv.authorisedByTwoId}
          />
        )}
        <Link
          href={`/pv/${pv.pvNum}`}
          aria-label="View detail"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          title="View detail"
        >
          <Eye className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ----- PC pending row -----

type PCRoleName =
  | "handledBy"
  | "procurementApprovedBy"
  | "budgetCheckedBy"
  | "balanceHandedOverBy"
  | "balanceCollectedBy";

type PcPendingRow = {
  pettyCash: {
    id: string;
    pettyCashNum: string;
    formNum: string;
    sectionUnit: string;
    date: string | Date;
    totalRequiredAmount: number;
  };
  role: PCRoleName;
  row: {
    id: string;
    amount: number | null;
    date: string | Date;
  };
};

function PcPendingCard({ entry }: { entry: PcPendingRow }) {
  const { pettyCash, role, row } = entry;
  const roleLabel = PC_ROLE_LABEL[role] ?? role;

  return (
    <div className="group flex min-w-0 flex-col gap-3 rounded-md border bg-card p-5 transition-shadow hover:shadow-sm md:flex-row md:items-center md:gap-6">
      <Link
        href={`/petty-cash/${pettyCash.pettyCashNum}`}
        className="flex min-w-0 flex-1 items-center gap-6"
      >
        <div
          className="truncate font-mono text-sm font-medium tracking-tight max-w-[180px]"
          title={pettyCash.pettyCashNum}
        >
          {pettyCash.pettyCashNum}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm" title={pettyCash.sectionUnit}>
            {pettyCash.sectionUnit}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {roleLabel}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              Form {pettyCash.formNum} · {format(new Date(pettyCash.date), "d MMM yyyy")}
            </span>
          </span>
        </div>
        <div className="hidden text-right md:block">
          <div className="font-mono text-sm tabular-nums">
            {formatMVR(row.amount ?? pettyCash.totalRequiredAmount) ?? "—"}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {row.amount != null ? "for role" : "total"}
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2 md:flex-shrink-0">
        <PCActionBar
          pettyCashNum={pettyCash.pettyCashNum}
          role={role}
          visible
        />
        <Link
          href={`/petty-cash/${pettyCash.pettyCashNum}`}
          aria-label="View detail"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          title="View detail"
        >
          <Eye className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ----- History tab -----

// Server-side `history` filters to the approve/reject subset of kinds,
// but TS doesn't narrow that — keep the local type wide and trust the
// shared event-display tables to handle every variant.
type HistoryRow = {
  id: string;
  kind: ApprovalEventKind;
  pettyCashRole: string | null;
  comment: string | null;
  createdAt: string | Date;
  pv: { id: string; pvNum: string; vendor: string; status: PvStatus } | null;
  pettyCash: {
    id: string;
    pettyCashNum: string;
    sectionUnit: string;
    formNum: string;
  } | null;
};

function HistoryTab({
  data,
  isLoading,
}: {
  data: HistoryRow[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border bg-card p-12 text-center">
        <FileSpreadsheet className="mx-auto size-10 text-muted-foreground/60" />
        <h2 className="mt-4 text-base font-semibold">No history yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve or reject something and your decisions will show up here.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {data.map((event) => (
        <HistoryRow key={event.id} event={event} />
      ))}
    </ol>
  );
}

function HistoryRow({ event }: { event: HistoryRow }) {
  const Icon = KIND_ICON[event.kind];
  const tone = KIND_TONE[event.kind];
  const target = event.pv
    ? {
        label: event.pv.pvNum,
        sub: event.pv.vendor,
        href: `/pv/${event.pv.pvNum}`,
        kindBadge: "PV" as const,
      }
    : event.pettyCash
      ? {
          label: event.pettyCash.pettyCashNum,
          sub: `Form ${event.pettyCash.formNum} · ${event.pettyCash.sectionUnit}`,
          href: `/petty-cash/${event.pettyCash.pettyCashNum}`,
          kindBadge: "PC" as const,
        }
      : null;

  const roleSuffix = event.pettyCashRole
    ? ` · ${PC_ROLE_LABEL[event.pettyCashRole] ?? event.pettyCashRole}`
    : "";

  return (
    <li>
      <Link
        href={target?.href ?? "#"}
        className="flex items-start gap-3 rounded-md border bg-card p-4 transition hover:shadow-sm"
      >
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ring-2 ${tone.bg} ${tone.ring}`}
        >
          <Icon className={`size-4 ${tone.icon}`} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium">
              {KIND_LABEL[event.kind]}
              {roleSuffix}
            </span>
            {target && (
              <>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {target.kindBadge}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {target.label}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  · {target.sub}
                </span>
              </>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {format(new Date(event.createdAt), "d MMM yyyy, HH:mm")}
            </span>
          </div>
          {event.comment && (
            <p className="mt-1.5 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs text-foreground">
              {event.comment}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

export default PendingApprovalsPage;
