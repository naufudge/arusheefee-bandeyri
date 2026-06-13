import React from "react";
import type { PVStatus, GSRStatus } from "@prisma/client";

const PV_STATUS_STYLE: Record<
  PVStatus,
  { label: string; classes: string; dot: string }
> = {
  DRAFT: {
    label: "Draft",
    classes: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  PENDING_VERIFICATION: {
    label: "Awaiting verification",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  PENDING_AUTHORISATION_ONE: {
    label: "Awaiting authorisation 1",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  PENDING_AUTHORISATION_TWO: {
    label: "Awaiting authorisation 2",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  APPROVED: {
    label: "Approved",
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    dot: "bg-red-500",
  },
};

interface StatusPillProps {
  status: PVStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const style = PV_STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] ${style.classes} ${className ?? ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

const GSR_STATUS_STYLE: Record<
  GSRStatus,
  { label: string; classes: string; dot: string }
> = {
  DRAFT: {
    label: "Draft",
    classes: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  PENDING_AUTHORIZATION: {
    label: "Awaiting authorization",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  PENDING_RECEIPT: {
    label: "Awaiting receipt",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  COMPLETED: {
    label: "Completed",
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    dot: "bg-red-500",
  },
};

export function GSRStatusPill({
  status,
  className,
}: {
  status: GSRStatus;
  className?: string;
}) {
  const style = GSR_STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] ${style.classes} ${className ?? ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

interface PettyCashStatusPillProps {
  approvedCount: number;
  totalAssigned: number;
  className?: string;
}

// Petty Cash doesn't have a single status enum (5 independent approvals),
// so the pill reflects the approved/assigned ratio + a "fully approved"
// terminal label.
export function PettyCashStatusPill({
  approvedCount,
  totalAssigned,
  className,
}: PettyCashStatusPillProps) {
  const fullyApproved = totalAssigned === 5 && approvedCount === 5;
  if (fullyApproved) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 ${className ?? ""}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Approved
      </span>
    );
  }
  const pending = approvedCount === 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] ${
        pending
          ? "bg-muted text-muted-foreground"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      } ${className ?? ""}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${pending ? "bg-muted-foreground/60" : "bg-amber-500"}`}
      />
      {approvedCount} / 5 approved
    </span>
  );
}
