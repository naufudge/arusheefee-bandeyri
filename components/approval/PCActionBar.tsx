"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "./RejectDialog";
import { SignatureRequiredModal } from "./SignatureRequiredModal";

type PCRole =
  | "handledBy"
  | "procurementApprovedBy"
  | "budgetCheckedBy"
  | "balanceHandedOverBy"
  | "balanceCollectedBy";

interface PCActionBarProps {
  pettyCashNum: string;
  role: PCRole;
  /** Set only when this role is currently assigned to the logged-in user
   *  and not yet approved. Otherwise the action bar renders nothing. */
  visible: boolean;
}

/**
 * Per-role Approve/Reject buttons for a Petty Cash. Renders inside each
 * SignatoryCard on the PC detail page. Self-contained: owns its own
 * RejectDialog and SignatureRequiredModal instances. (Each PC has 5 roles
 * but only one row at most matches the current user, so the cost of
 * duplicate dialogs is negligible.)
 */
export function PCActionBar({ pettyCashNum, role, visible }: PCActionBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [retryApprove, setRetryApprove] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: trpc.pettycash.getByNum.queryKey({ pettyCashNum }),
    });
    queryClient.invalidateQueries({ queryKey: trpc.pettycash.list.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.pettycash.byYear.pathKey() });
  }

  const approveMutation = useMutation(
    trpc.pettycash.approveRole.mutationOptions({
      onSuccess: () => {
        toast({ title: "Approved" });
        invalidate();
      },
      onError: (err: { data?: { code?: string } | null; message?: string }) => {
        if (
          err.data?.code === "PRECONDITION_FAILED" &&
          err.message === "SIGNATURE_REQUIRED"
        ) {
          setRetryApprove(true);
          setSignatureOpen(true);
          return;
        }
        toast({ title: "Approve failed", description: err.message ?? "Unknown error" });
      },
    }),
  );

  const rejectMutation = useMutation(
    trpc.pettycash.rejectRole.mutationOptions({
      onSuccess: () => {
        toast({ title: "Rejected" });
        setRejectOpen(false);
        invalidate();
      },
      onError: (err) =>
        toast({ title: "Reject failed", description: err.message }),
    }),
  );

  if (!visible) return null;

  const anyPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => approveMutation.mutate({ pettyCashNum, role })}
        disabled={anyPending}
      >
        <CheckCircle2 className="size-3.5" />
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setRejectOpen(true)}
        disabled={anyPending}
        className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-900/20"
      >
        <XCircle className="size-3.5" />
        Reject
      </Button>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this role approval?"
        description="The role will be marked as rejected. It can be re-approved later if the issue is resolved."
        onConfirm={(comment) =>
          rejectMutation.mutate({ pettyCashNum, role, comment })
        }
        isPending={rejectMutation.isPending}
      />

      <SignatureRequiredModal
        open={signatureOpen}
        onOpenChange={(next) => {
          setSignatureOpen(next);
          if (!next) setRetryApprove(false);
        }}
        onUploaded={() => {
          if (retryApprove) {
            approveMutation.mutate({ pettyCashNum, role });
            setRetryApprove(false);
          }
        }}
      />
    </>
  );
}
