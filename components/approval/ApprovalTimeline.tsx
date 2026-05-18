import React from "react";
import { format } from "date-fns";
import {
  Send,
  Undo2,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  RotateCcw,
} from "lucide-react";
import type { ApprovalEventKind } from "@prisma/client";

interface TimelineEvent {
  id: string;
  kind: ApprovalEventKind;
  pettyCashRole?: string | null;
  comment?: string | null;
  createdAt: Date | string;
  actor: { id: string; name: string; designation: string };
}

interface ApprovalTimelineProps {
  events: TimelineEvent[];
}

const KIND_LABEL: Record<ApprovalEventKind, string> = {
  SENT_FOR_VERIFICATION: "Sent for verification",
  CALLED_BACK: "Called back to draft",
  VERIFIED: "Verified",
  AUTHORISED_ONE: "Authorised (stage 1)",
  AUTHORISED_TWO: "Authorised (stage 2)",
  REJECTED: "Rejected",
  PC_ROLE_APPROVED: "Approved",
  PC_ROLE_REJECTED: "Rejected",
  PC_ROLE_RESET_ON_EDIT: "Reset on edit",
};

const KIND_ICON: Record<ApprovalEventKind, React.ComponentType<{ className?: string }>> = {
  SENT_FOR_VERIFICATION: Send,
  CALLED_BACK: Undo2,
  VERIFIED: CheckCircle2,
  AUTHORISED_ONE: ShieldCheck,
  AUTHORISED_TWO: ShieldCheck,
  REJECTED: XCircle,
  PC_ROLE_APPROVED: CheckCircle2,
  PC_ROLE_REJECTED: XCircle,
  PC_ROLE_RESET_ON_EDIT: RotateCcw,
};

const KIND_TONE: Record<
  ApprovalEventKind,
  { bg: string; ring: string; icon: string }
> = {
  SENT_FOR_VERIFICATION: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    ring: "ring-blue-200 dark:ring-blue-800/60",
    icon: "text-blue-600 dark:text-blue-400",
  },
  CALLED_BACK: {
    bg: "bg-muted",
    ring: "ring-border",
    icon: "text-muted-foreground",
  },
  VERIFIED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-200 dark:ring-emerald-800/60",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  AUTHORISED_ONE: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-200 dark:ring-emerald-800/60",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  AUTHORISED_TWO: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-200 dark:ring-emerald-800/60",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    ring: "ring-red-200 dark:ring-red-800/60",
    icon: "text-red-600 dark:text-red-400",
  },
  PC_ROLE_APPROVED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-200 dark:ring-emerald-800/60",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  PC_ROLE_REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    ring: "ring-red-200 dark:ring-red-800/60",
    icon: "text-red-600 dark:text-red-400",
  },
  PC_ROLE_RESET_ON_EDIT: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    ring: "ring-amber-200 dark:ring-amber-800/60",
    icon: "text-amber-600 dark:text-amber-400",
  },
};

// Friendly labels for petty cash roles, used as a suffix on PC events.
const PC_ROLE_LABEL: Record<string, string> = {
  handledBy: "Funds Received By",
  procurementApprovedBy: "Procurement",
  budgetCheckedBy: "Budget",
  balanceHandedOverBy: "Balance Returned By",
  balanceCollectedBy: "Balance Received By",
};

export function ApprovalTimeline({ events }: ApprovalTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
        No activity yet.
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 pl-6">
      <span
        aria-hidden
        className="absolute left-[11px] top-2 bottom-2 w-px bg-border"
      />
      {events.map((event) => {
        const Icon = KIND_ICON[event.kind];
        const tone = KIND_TONE[event.kind];
        const roleSuffix = event.pettyCashRole
          ? ` · ${PC_ROLE_LABEL[event.pettyCashRole] ?? event.pettyCashRole}`
          : "";
        return (
          <li key={event.id} className="relative">
            <span
              className={`absolute -left-6 top-0 flex h-6 w-6 items-center justify-center rounded-full ring-2 ${tone.bg} ${tone.ring}`}
            >
              <Icon className={`h-3.5 w-3.5 ${tone.icon}`} />
            </span>
            <div className="ml-2 rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium">
                  {KIND_LABEL[event.kind]}
                  {roleSuffix}
                </span>
                <span className="text-xs text-muted-foreground">
                  by {event.actor.name}
                </span>
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
          </li>
        );
      })}
    </ol>
  );
}
