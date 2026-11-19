"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, ShieldCheck, Undo2, XCircle } from "lucide-react";
import type { FiyesStatus } from "@prisma/client";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "./RejectDialog";
import { SignatureRequiredModal } from "./SignatureRequiredModal";

const APPROVE_CLS =
  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700";
const REJECT_CLS = "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700";

interface FiyesActionBarProps {
  period: string;
  status: FiyesStatus;
  currentUserId: string;
  enteredById: string | null;
  approvedById: string | null;
}

export function FiyesActionBar({ period, status, currentUserId, enteredById, approvedById }: FiyesActionBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canUpdate = useHasPermission(PERMISSIONS.FIYES_UPDATE);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.fiyes.getByPeriod.queryKey({ period }) });
    queryClient.invalidateQueries({ queryKey: trpc.fiyes.list.pathKey() });
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
    trpc.fiyes.send.mutationOptions({
      onSuccess: () => {
        toast({ title: "Sent for approval" });
        invalidate();
      },
      onError: onSignError(() => sendMutation.mutate({ period })),
    }),
  );
  const callbackMutation = useMutation(
    trpc.fiyes.callback.mutationOptions({
      onSuccess: () => {
        toast({ title: "Called back to draft" });
        invalidate();
      },
      onError: (err) => toast({ title: "Call back failed", description: err.message }),
    }),
  );
  const approveMutation = useMutation(
    trpc.fiyes.approve.mutationOptions({
      onSuccess: () => {
        toast({ title: "Approved — the forms are ready to upload to Fiyes" });
        invalidate();
      },
      onError: onSignError(() => approveMutation.mutate({ period })),
    }),
  );
  const rejectMutation = useMutation(
    trpc.fiyes.reject.mutationOptions({
      onSuccess: () => {
        toast({ title: "Rejected — back in draft" });
        setRejectOpen(false);
        invalidate();
      },
      onError: (err) => toast({ title: "Reject failed", description: err.message }),
    }),
  );

  const showSend = status === "DRAFT" && enteredById === currentUserId;
  const showCallback = status === "PENDING_APPROVAL" && (enteredById === currentUserId || canUpdate);
  const showApprove = status === "PENDING_APPROVAL" && approvedById === currentUserId;
  const busy =
    sendMutation.isPending || callbackMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

  if (!showSend && !showCallback && !showApprove) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showSend && (
          <Button type="button" size="sm" onClick={() => sendMutation.mutate({ period })} disabled={busy} className={APPROVE_CLS}>
            <Send className="size-3.5" />
            Sign &amp; send for approval
          </Button>
        )}
        {showApprove && (
          <Button type="button" size="sm" onClick={() => approveMutation.mutate({ period })} disabled={busy} className={APPROVE_CLS}>
            <ShieldCheck className="size-3.5" />
            Approve
          </Button>
        )}
        {showApprove && (
          <Button type="button" size="sm" onClick={() => setRejectOpen(true)} disabled={busy} className={REJECT_CLS}>
            <XCircle className="size-3.5" />
            Reject
          </Button>
        )}
        {showCallback && (
          <Button type="button" size="sm" variant="outline" onClick={() => callbackMutation.mutate({ period })} disabled={busy}>
            <Undo2 className="size-3.5" />
            Call back
          </Button>
        )}
      </div>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this return?"
        description="It returns to draft for the person who entered it, and the signatures so far are cleared."
        onConfirm={(comment) => rejectMutation.mutate({ period, comment })}
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
