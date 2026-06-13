"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Undo2, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import type { GSRStatus } from "@prisma/client";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "./RejectDialog";
import { SignatureRequiredModal } from "./SignatureRequiredModal";

type GSRAction = "authorize" | "receive";

const APPROVE_CLS =
  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700";
const REJECT_CLS =
  "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700";

interface GSRActionBarProps {
  gsrFormNum: string;
  status: GSRStatus;
  currentUserId: string;
  authorizedById: string | null;
  receivedById: string | null;
}

export function GSRActionBar({
  gsrFormNum,
  status,
  currentUserId,
  authorizedById,
  receivedById,
}: GSRActionBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canUpdate = useHasPermission(PERMISSIONS.GSR_UPDATE);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  // When SIGNATURE_REQUIRED fires, stash which approval to retry after
  // the user uploads their signature.
  const [pendingApproval, setPendingApproval] = useState<GSRAction | null>(
    null,
  );

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: trpc.gsr.getByNum.queryKey({ gsrFormNum }),
    });
    queryClient.invalidateQueries({ queryKey: trpc.gsr.list.queryKey() });
  }

  function handleApprovalError(
    action: GSRAction,
    err: { data?: { code?: string } | null; message?: string },
  ) {
    if (
      err.data?.code === "PRECONDITION_FAILED" &&
      err.message === "SIGNATURE_REQUIRED"
    ) {
      setPendingApproval(action);
      setSignatureOpen(true);
      return;
    }
    toast({
      title: "Action failed",
      description: err.message ?? "Unknown error",
    });
  }

  const sendMutation = useMutation(
    trpc.gsr.send.mutationOptions({
      onSuccess: () => {
        toast({ title: "Sent for authorization" });
        invalidate();
      },
      onError: (err) =>
        toast({ title: "Could not send", description: err.message }),
    }),
  );
  const callbackMutation = useMutation(
    trpc.gsr.callback.mutationOptions({
      onSuccess: () => {
        toast({ title: "Called back to draft" });
        invalidate();
      },
      onError: (err) =>
        toast({ title: "Callback failed", description: err.message }),
    }),
  );
  const authorizeMutation = useMutation(
    trpc.gsr.authorize.mutationOptions({
      onSuccess: () => {
        toast({ title: "Authorized" });
        invalidate();
      },
      onError: (err) => handleApprovalError("authorize", err),
    }),
  );
  const receiveMutation = useMutation(
    trpc.gsr.receive.mutationOptions({
      onSuccess: () => {
        toast({ title: "Receipt acknowledged — form completed" });
        invalidate();
      },
      onError: (err) => handleApprovalError("receive", err),
    }),
  );
  const rejectMutation = useMutation(
    trpc.gsr.reject.mutationOptions({
      onSuccess: () => {
        toast({ title: "Rejected — form is back in draft" });
        setRejectOpen(false);
        invalidate();
      },
      onError: (err) =>
        toast({ title: "Reject failed", description: err.message }),
    }),
  );

  // Which action is the current user allowed to take right now?
  const showSend = canUpdate && status === "DRAFT";
  const showCallback = canUpdate && status === "PENDING_AUTHORIZATION";
  const isAuthorizer = authorizedById === currentUserId;
  const isReceiver = receivedById === currentUserId;
  const showAuthorize = status === "PENDING_AUTHORIZATION" && isAuthorizer;
  const showReceive = status === "PENDING_RECEIPT" && isReceiver;
  const canReject = showAuthorize || showReceive;

  const anyPending =
    sendMutation.isPending ||
    callbackMutation.isPending ||
    authorizeMutation.isPending ||
    receiveMutation.isPending ||
    rejectMutation.isPending;

  if (!showSend && !showCallback && !showAuthorize && !showReceive) {
    return null;
  }

  function retryPendingApproval() {
    if (!pendingApproval) return;
    if (pendingApproval === "authorize")
      authorizeMutation.mutate({ gsrFormNum });
    else if (pendingApproval === "receive")
      receiveMutation.mutate({ gsrFormNum });
    setPendingApproval(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showSend && (
          <Button
            type="button"
            size="sm"
            onClick={() => sendMutation.mutate({ gsrFormNum })}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <Send className="size-3.5" />
            Send for authorization
          </Button>
        )}
        {showCallback && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => callbackMutation.mutate({ gsrFormNum })}
            disabled={anyPending}
          >
            <Undo2 className="size-3.5" />
            Callback
          </Button>
        )}
        {showAuthorize && (
          <Button
            type="button"
            size="sm"
            onClick={() => authorizeMutation.mutate({ gsrFormNum })}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <ShieldCheck className="size-3.5" />
            Authorize
          </Button>
        )}
        {showReceive && (
          <Button
            type="button"
            size="sm"
            onClick={() => receiveMutation.mutate({ gsrFormNum })}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <CheckCircle2 className="size-3.5" />
            Acknowledge receipt
          </Button>
        )}
        {canReject && (
          <Button
            type="button"
            size="sm"
            onClick={() => setRejectOpen(true)}
            disabled={anyPending}
            className={REJECT_CLS}
          >
            <XCircle className="size-3.5" />
            Reject
          </Button>
        )}
      </div>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this GSR form?"
        description="The form will return to draft. Any signatures captured by later stages will be cleared."
        onConfirm={(comment) => rejectMutation.mutate({ gsrFormNum, comment })}
        isPending={rejectMutation.isPending}
      />

      <SignatureRequiredModal
        open={signatureOpen}
        onOpenChange={(next) => {
          setSignatureOpen(next);
          if (!next) setPendingApproval(null);
        }}
        onUploaded={retryPendingApproval}
      />
    </>
  );
}
