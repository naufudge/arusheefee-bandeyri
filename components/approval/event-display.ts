import React from "react";
import {
  Send,
  Undo2,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  RotateCcw,
} from "lucide-react";
import type { ApprovalEventKind } from "@prisma/client";

// Shared lookup tables for rendering ApprovalEvent rows. Used by the
// timeline component on the detail pages and the history list on the
// pending-approvals page. Keep these in one place so a tone or label
// change propagates everywhere.

export const KIND_LABEL: Record<ApprovalEventKind, string> = {
  SENT_FOR_VERIFICATION: "Sent for verification",
  CALLED_BACK: "Called back to draft",
  VERIFIED: "Verified",
  AUTHORISED_ONE: "Authorised (stage 1)",
  AUTHORISED_TWO: "Authorised (stage 2)",
  REJECTED: "Rejected",
  PC_ROLE_APPROVED: "Approved",
  PC_ROLE_REJECTED: "Rejected",
  PC_ROLE_RESET_ON_EDIT: "Reset on edit",
  GSR_SENT_FOR_AUTHORIZATION: "Sent for authorization",
  GSR_AUTHORIZED: "Authorized",
  GSR_RECEIVED: "Received",
  GSR_CALLED_BACK: "Called back to draft",
  GSR_REJECTED: "Rejected",
  PCRECON_SENT_FOR_CHECK: "Sent for check",
  PCRECON_CHECKED: "Checked",
  PCRECON_AUTHORIZED: "Authorized",
  PCRECON_CALLED_BACK: "Called back to draft",
  PCRECON_REJECTED: "Rejected",
};

export const KIND_ICON: Record<
  ApprovalEventKind,
  React.ComponentType<{ className?: string }>
> = {
  SENT_FOR_VERIFICATION: Send,
  CALLED_BACK: Undo2,
  VERIFIED: CheckCircle2,
  AUTHORISED_ONE: ShieldCheck,
  AUTHORISED_TWO: ShieldCheck,
  REJECTED: XCircle,
  PC_ROLE_APPROVED: CheckCircle2,
  PC_ROLE_REJECTED: XCircle,
  PC_ROLE_RESET_ON_EDIT: RotateCcw,
  GSR_SENT_FOR_AUTHORIZATION: Send,
  GSR_AUTHORIZED: ShieldCheck,
  GSR_RECEIVED: CheckCircle2,
  GSR_CALLED_BACK: Undo2,
  GSR_REJECTED: XCircle,
  PCRECON_SENT_FOR_CHECK: Send,
  PCRECON_CHECKED: CheckCircle2,
  PCRECON_AUTHORIZED: ShieldCheck,
  PCRECON_CALLED_BACK: Undo2,
  PCRECON_REJECTED: XCircle,
};

export const KIND_TONE: Record<
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
  GSR_SENT_FOR_AUTHORIZATION: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    ring: "ring-blue-200 dark:ring-blue-800/60",
    icon: "text-blue-600 dark:text-blue-400",
  },
  GSR_AUTHORIZED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-200 dark:ring-emerald-800/60",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  GSR_RECEIVED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-200 dark:ring-emerald-800/60",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  GSR_CALLED_BACK: {
    bg: "bg-muted",
    ring: "ring-border",
    icon: "text-muted-foreground",
  },
  GSR_REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    ring: "ring-red-200 dark:ring-red-800/60",
    icon: "text-red-600 dark:text-red-400",
  },
  PCRECON_SENT_FOR_CHECK: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    ring: "ring-blue-200 dark:ring-blue-800/60",
    icon: "text-blue-600 dark:text-blue-400",
  },
  PCRECON_CHECKED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-200 dark:ring-emerald-800/60",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  PCRECON_AUTHORIZED: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    ring: "ring-emerald-200 dark:ring-emerald-800/60",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  PCRECON_CALLED_BACK: {
    bg: "bg-muted",
    ring: "ring-border",
    icon: "text-muted-foreground",
  },
  PCRECON_REJECTED: {
    bg: "bg-red-50 dark:bg-red-900/20",
    ring: "ring-red-200 dark:ring-red-800/60",
    icon: "text-red-600 dark:text-red-400",
  },
};

// Friendly labels for petty cash roles, used as a suffix on PC events
// and as the per-row label on the pending approvals page.
export const PC_ROLE_LABEL: Record<string, string> = {
  handledBy: "Funds Received By",
  procurementApprovedBy: "Procurement",
  budgetCheckedBy: "Budget",
  balanceHandedOverBy: "Balance Returned By",
  balanceCollectedBy: "Balance Received By",
};
