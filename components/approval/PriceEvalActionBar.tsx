"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Send, ShieldCheck, Undo2, Wallet, XCircle } from "lucide-react";
import type { PriceEvalStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatNumberWithCommas } from "@/utils/helpers";
import { toNumber } from "@/schemas/PriceEvalSchema";
import { RejectDialog } from "./RejectDialog";
import { SignatureRequiredModal } from "./SignatureRequiredModal";

const APPROVE_CLS =
  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700";
const REJECT_CLS =
  "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700";

interface PriceEvalActionBarProps {
  evalNum: string;
  status: PriceEvalStatus;
  currentUserId: string;
  preparedById: string | null;
  budgetCheckedById: string | null;
  checkedById: string | null;
  approvedById: string | null;
  /** Shown in the budget-check dialog. */
  budget: {
    glLabel: string;
    /** The last balance entered at a budget check, to prefill the field. */
    balance: number | null;
    /** The chosen vendor's total, MVR. */
    needed: number | null;
  };
}

export function PriceEvalActionBar({
  evalNum,
  status,
  currentUserId,
  preparedById,
  budgetCheckedById,
  checkedById,
  approvedById,
  budget,
}: PriceEvalActionBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canUpdate = useHasPermission(PERMISSIONS.PRICEEVAL_UPDATE);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.priceEval.getByNum.queryKey({ evalNum }) });
    queryClient.invalidateQueries({ queryKey: trpc.priceEval.list.queryKey() });
    // Keep the sidebar badge and the approvals inbox in step.
    queryClient.invalidateQueries({ queryKey: trpc.approvals.pendingCount.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.approvals.pending.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.approvals.history.pathKey() });
  }

  // A missing signature opens the signature pad, then retries the action.
  function onSignError(again: () => void) {
    return (err: { data?: { code?: string } | null; message?: string }) => {
      if (err.data?.code === "PRECONDITION_FAILED" && err.message === "SIGNATURE_REQUIRED") {
        setRetry(() => again);
        setSignatureOpen(true);
        return;
      }
      toast({ title: "Action failed", description: err.message ?? "Unknown error" });
    };
  }

  const sendMutation = useMutation(
    trpc.priceEval.send.mutationOptions({
      onSuccess: () => {
        toast({ title: "Sent for budget check" });
        invalidate();
      },
      onError: onSignError(() => sendMutation.mutate({ evalNum })),
    }),
  );
  const callbackMutation = useMutation(
    trpc.priceEval.callback.mutationOptions({
      onSuccess: () => {
        toast({ title: "Called back to draft" });
        invalidate();
      },
      onError: (err) => toast({ title: "Callback failed", description: err.message }),
    }),
  );
  const budgetMutation = useMutation(
    trpc.priceEval.budgetCheck.mutationOptions({
      onSuccess: () => {
        toast({ title: "Budget check signed" });
        setBudgetOpen(false);
        invalidate();
      },
      onError: (err) => {
        // The dialog's inputs are kept, so a retry resubmits the same answer.
        if (err.data?.code === "PRECONDITION_FAILED" && err.message === "SIGNATURE_REQUIRED") {
          setRetry(() => () => setBudgetOpen(true));
          setSignatureOpen(true);
          return;
        }
        toast({ title: "Budget check failed", description: err.message });
      },
    }),
  );
  const checkMutation = useMutation(
    trpc.priceEval.check.mutationOptions({
      onSuccess: () => {
        toast({ title: "Checked" });
        invalidate();
      },
      onError: onSignError(() => checkMutation.mutate({ evalNum })),
    }),
  );
  const approveMutation = useMutation(
    trpc.priceEval.approve.mutationOptions({
      onSuccess: () => {
        toast({ title: "Approved — the purchase can go ahead" });
        invalidate();
      },
      onError: onSignError(() => approveMutation.mutate({ evalNum })),
    }),
  );
  const rejectMutation = useMutation(
    trpc.priceEval.reject.mutationOptions({
      onSuccess: () => {
        toast({ title: "Rejected — back in draft" });
        setRejectOpen(false);
        invalidate();
      },
      onError: (err) => toast({ title: "Reject failed", description: err.message }),
    }),
  );

  const isPending = status.startsWith("PENDING_");
  const showSend = status === "DRAFT" && preparedById === currentUserId;
  const showCallback = isPending && (preparedById === currentUserId || canUpdate);
  const showBudget = status === "PENDING_BUDGET_CHECK" && budgetCheckedById === currentUserId;
  const showCheck = status === "PENDING_CHECK" && checkedById === currentUserId;
  const showApprove = status === "PENDING_APPROVAL" && approvedById === currentUserId;
  const canReject = showBudget || showCheck || showApprove;

  const busy =
    sendMutation.isPending ||
    callbackMutation.isPending ||
    budgetMutation.isPending ||
    checkMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending;

  if (!showSend && !showCallback && !showBudget && !showCheck && !showApprove) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showSend && (
          <Button type="button" size="sm" onClick={() => sendMutation.mutate({ evalNum })} disabled={busy} className={APPROVE_CLS}>
            <Send className="size-3.5" />
            Sign &amp; send for budget check
          </Button>
        )}
        {showBudget && (
          <Button type="button" size="sm" onClick={() => setBudgetOpen(true)} disabled={busy} className={APPROVE_CLS}>
            <Wallet className="size-3.5" />
            Budget check
          </Button>
        )}
        {showCheck && (
          <Button type="button" size="sm" onClick={() => checkMutation.mutate({ evalNum })} disabled={busy} className={APPROVE_CLS}>
            <CheckCircle2 className="size-3.5" />
            Check
          </Button>
        )}
        {showApprove && (
          <Button type="button" size="sm" onClick={() => approveMutation.mutate({ evalNum })} disabled={busy} className={APPROVE_CLS}>
            <ShieldCheck className="size-3.5" />
            Approve
          </Button>
        )}
        {canReject && (
          <Button type="button" size="sm" onClick={() => setRejectOpen(true)} disabled={busy} className={REJECT_CLS}>
            <XCircle className="size-3.5" />
            Reject
          </Button>
        )}
        {showCallback && (
          <Button type="button" size="sm" variant="outline" onClick={() => callbackMutation.mutate({ evalNum })} disabled={busy}>
            <Undo2 className="size-3.5" />
            Call back
          </Button>
        )}
      </div>

      <BudgetCheckDialog
        // Remount on open so the balance prefills from the latest data.
        key={budgetOpen ? "open" : "closed"}
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        budget={budget}
        isPending={budgetMutation.isPending}
        onConfirm={(budgetBalance, budgetAvailable) =>
          budgetMutation.mutate({ evalNum, budgetBalance, budgetAvailable })
        }
      />

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this price evaluation?"
        description="It returns to draft for the preparer, and every signature so far is cleared."
        onConfirm={(comment) => rejectMutation.mutate({ evalNum, comment })}
        isPending={rejectMutation.isPending}
      />

      <SignatureRequiredModal
        open={signatureOpen}
        onOpenChange={(next) => {
          setSignatureOpen(next);
          if (!next) setRetry(null);
        }}
        onUploaded={() => {
          retry?.();
          setRetry(null);
        }}
      />
    </>
  );
}

// The budget checker confirms the code's balance and whether funds are
// available, then signs.
function BudgetCheckDialog({
  open,
  onOpenChange,
  budget,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: PriceEvalActionBarProps["budget"];
  isPending: boolean;
  onConfirm: (balance: number, available: boolean) => void;
}) {
  const [balanceText, setBalanceText] = useState(
    budget.balance == null ? "" : String(budget.balance),
  );
  const [available, setAvailable] = useState<boolean | null>(null);
  const balance = toNumber(balanceText);
  const covers =
    balance !== null && budget.needed !== null ? balance >= budget.needed : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 sm:rounded-md">
        <div className="border-b px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Budget check
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            Is there budget for this?
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {budget.glLabel}
            {budget.needed !== null && (
              <>
                {" "}· needs{" "}
                <span className="font-mono tabular-nums text-foreground">
                  MVR {formatNumberWithCommas(budget.needed)}
                </span>
              </>
            )}
          </DialogDescription>
        </div>

        <div className="grid gap-5 px-6 py-6">
          <div className="grid gap-1.5">
            <label
              htmlFor="pe-budget-balance"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Code balance (MVR)
            </label>
            <Input
              id="pe-budget-balance"
              value={balanceText}
              onChange={(e) => setBalanceText(e.target.value)}
              inputMode="decimal"
              placeholder="Remaining balance on this code"
              className="h-10 text-right font-mono text-base tabular-nums"
            />
            {covers !== null && (
              <span
                className={cn(
                  "text-xs",
                  covers ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
                )}
              >
                {covers
                  ? "The balance covers the chosen quote."
                  : "The balance is less than the chosen quote."}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Budget available">
            {(
              [
                [true, "Available", "އެބަހުރި"],
                [false, "Not available", "ނެތް"],
              ] as const
            ).map(([value, en, dv]) => (
              <button
                key={en}
                type="button"
                role="radio"
                aria-checked={available === value}
                onClick={() => setAvailable(value)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border px-3 py-2.5 text-left transition",
                  available === value
                    ? value
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-red-600 bg-red-50 dark:bg-red-900/20"
                    : "hover:bg-muted",
                )}
              >
                <span className="text-sm font-medium">{en}</span>
                <span dir="rtl" className="font-faruma text-[13px] text-muted-foreground">
                  {dv}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t bg-muted/30 px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending || balance === null || available === null}
            onClick={() => balance !== null && available !== null && onConfirm(balance, available)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Signing…" : "Sign budget check"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
