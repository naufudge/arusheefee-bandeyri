import React from "react";
import { format } from "date-fns";
import { Check, Clock, UserCircle2, XCircle } from "lucide-react";

interface SignatoryCardProps {
  label: string;
  staff: { name: string; designation: string } | null | undefined;
  /**
   * When set, treat this signatory as approved/signed and show the
   * timestamp. When null, render the awaiting state.
   */
  signedAt: Date | string | null | undefined;
  /** Set when this role was just rejected. Overrides the awaiting visual. */
  rejectedAt?: Date | string | null;
  /** Optional comment shown below the row (used by PC role cards). */
  comment?: string | null;
  /**
   * Slot for action buttons (Approve / Reject / Verify). Rendered below
   * the row when present.
   */
  actions?: React.ReactNode;
}

export function SignatoryCard({
  label,
  staff,
  signedAt,
  rejectedAt,
  comment,
  actions,
}: SignatoryCardProps) {
  const state: "signed" | "rejected" | "awaiting" | "unassigned" = !staff
    ? "unassigned"
    : signedAt
      ? "signed"
      : rejectedAt
        ? "rejected"
        : "awaiting";

  const stateStyles: Record<typeof state, { ring: string; badge: React.ReactNode }> = {
    signed: {
      ring: "ring-emerald-200 dark:ring-emerald-800/60",
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <Check className="h-3 w-3" />
          Signed
        </span>
      ),
    },
    rejected: {
      ring: "ring-red-200 dark:ring-red-800/60",
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-800 dark:bg-red-900/30 dark:text-red-300">
          <XCircle className="h-3 w-3" />
          Rejected
        </span>
      ),
    },
    awaiting: {
      ring: "ring-amber-200 dark:ring-amber-800/60",
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <Clock className="h-3 w-3" />
          Awaiting
        </span>
      ),
    },
    unassigned: {
      ring: "ring-border",
      badge: (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <UserCircle2 className="h-3 w-3" />
          Unassigned
        </span>
      ),
    },
  };

  const { ring, badge } = stateStyles[state];

  return (
    <div className={`rounded-md border bg-card p-4 ring-1 ${ring}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        {badge}
      </div>
      <div className="mt-2">
        {staff ? (
          <>
            <div className="text-sm font-semibold leading-tight">{staff.name}</div>
            <div className="text-xs text-muted-foreground">{staff.designation}</div>
          </>
        ) : (
          <div className="text-sm italic text-muted-foreground/70">—</div>
        )}
      </div>
      {(signedAt || rejectedAt) && (
        <div className="mt-2 text-[11px] tabular-nums text-muted-foreground">
          {signedAt
            ? `Signed on ${format(new Date(signedAt), "d MMM yyyy")}`
            : `Rejected on ${format(new Date(rejectedAt!), "d MMM yyyy")}`}
        </div>
      )}
      {comment && (
        <p className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
          {comment}
        </p>
      )}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
