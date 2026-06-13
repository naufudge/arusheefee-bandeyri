"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, FileText, UserCircle2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GateIssue } from "@/server/schemas/pcrecon.schema";

const ROLE_LABEL: Record<string, string> = {
  preparedBy: "Prepared / In charge",
  checkedBy: "Checked by",
  authorizedBy: "Authorized by",
};

interface ReconciliationGateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: GateIssue[];
  onRecheck: () => void;
  rechecking?: boolean;
}

// Shown when "Send for check" is blocked because required Dhivehi text is
// missing. Lists exactly what to fix with deep links to the right screen.
const ReconciliationGateDialog: React.FC<ReconciliationGateDialogProps> = ({
  open,
  onOpenChange,
  issues,
  onRecheck,
  rechecking,
}) => {
  const pettyCashIssues = issues.filter(
    (i) => i.type === "petty_cash_missing_dhivehi",
  );
  const staffIssues = issues.filter((i) => i.type === "staff_missing_dhivehi");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:rounded-md">
        <div className="border-b px-6 py-5">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-4" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
              Dhivehi required
            </span>
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            Add the missing Dhivehi text
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            This report is in Dhivehi. Fill in the items below, then re-check to
            send it for approval.
          </DialogDescription>
        </div>

        <div className="max-h-[55vh] space-y-5 overflow-y-auto px-6 py-5">
          {pettyCashIssues.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Petty cash items missing a Dhivehi name
              </div>
              <ul className="space-y-2">
                {pettyCashIssues.map((issue, i) =>
                  issue.type === "petty_cash_missing_dhivehi" ? (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 rounded-md border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-medium">
                          {issue.pettyCashNum}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {issue.itemNames.join(", ")}
                        </div>
                      </div>
                      <Link
                        href={`/petty-cash/edit/${encodeURIComponent(issue.pettyCashNum)}`}
                        className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted"
                      >
                        <FileText className="size-3.5" />
                        Edit
                      </Link>
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          )}

          {staffIssues.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Staff missing a Dhivehi name / designation
              </div>
              <ul className="space-y-2">
                {staffIssues.map((issue, i) =>
                  issue.type === "staff_missing_dhivehi" ? (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 rounded-md border bg-card p-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{issue.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {ROLE_LABEL[issue.role] ?? issue.role}
                        </div>
                      </div>
                      <Link
                        href="/settings/staff"
                        className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted"
                      >
                        <UserCircle2 className="size-3.5" />
                        Edit staff
                      </Link>
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onRecheck}
            disabled={rechecking}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${rechecking ? "animate-spin" : ""}`}
            />
            Re-check &amp; send
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReconciliationGateDialog;
