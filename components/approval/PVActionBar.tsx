"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Undo2,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  BookCheck,
} from "lucide-react";
import type { PVStatus } from "@prisma/client";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "./RejectDialog";
import { SignatureRequiredModal } from "./SignatureRequiredModal";

type PVAction = "verify" | "authoriseOne" | "authoriseTwo" | "post";

const APPROVE_CLS =
  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700";
const REJECT_CLS =
  "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700";
const POST_CLS =
  "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700";

interface PVActionBarProps {
  pvNum: string;
  status: PVStatus;
  currentUserId: string;
  verifiedById: string | null;
  authorisedByOneId: string | null;
  authorisedByTwoId: string | null;
}

export function PVActionBar({
  pvNum,
  status,
  currentUserId,
  verifiedById,
  authorisedByOneId,
  authorisedByTwoId,
}: PVActionBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canUpdate = useHasPermission(PERMISSIONS.PV_UPDATE);
  const canPost = useHasPermission(PERMISSIONS.PV_POST);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  // When SIGNATURE_REQUIRED fires, stash which approval to retry after
  // the user uploads their signature.
  const [pendingApproval, setPendingApproval] = useState<PVAction | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.pv.getByNum.queryKey({ pvNum }) });
    queryClient.invalidateQueries({ queryKey: trpc.pv.list.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.pv.byYear.pathKey() });
    // Keep the sidebar badge + pending-approvals page in sync with
    // every state change this action bar triggers.
    queryClient.invalidateQueries({ queryKey: trpc.approvals.pendingCount.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.approvals.pending.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.approvals.history.pathKey() });
  }

  function handleApprovalError(
    action: PVAction,
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
    toast({ title: "Action failed", description: err.message ?? "Unknown error" });
  }

  const sendMutation = useMutation(
    trpc.pv.send.mutationOptions({
      onSuccess: () => {
        toast({ title: "Sent for verification" });
        invalidate();
      },
      onError: (err) =>
        toast({ title: "Could not send", description: err.message }),
    }),
  );
  const callbackMutation = useMutation(
    trpc.pv.callback.mutationOptions({
      onSuccess: () => {
        toast({ title: "Called back to draft" });
        invalidate();
      },
      onError: (err) =>
        toast({ title: "Callback failed", description: err.message }),
    }),
  );
  const verifyMutation = useMutation(
    trpc.pv.verify.mutationOptions({
      onSuccess: () => {
        toast({ title: "Verified" });
        invalidate();
      },
      onError: (err) => handleApprovalError("verify", err),
    }),
  );
  const authOneMutation = useMutation(
    trpc.pv.authoriseOne.mutationOptions({
      onSuccess: () => {
        toast({ title: "Authorised (stage 1)" });
        invalidate();
      },
      onError: (err) => handleApprovalError("authoriseOne", err),
    }),
  );
  const authTwoMutation = useMutation(
    trpc.pv.authoriseTwo.mutationOptions({
      onSuccess: () => {
        toast({ title: "Authorised (stage 2) — approved" });
        invalidate();
      },
      onError: (err) => handleApprovalError("authoriseTwo", err),
    }),
  );
  const postMutation = useMutation(
    trpc.pv.post.mutationOptions({
      onSuccess: () => {
        toast({ title: "Posted" });
        invalidate();
      },
      onError: (err) => handleApprovalError("post", err),
    }),
  );
  const rejectMutation = useMutation(
    trpc.pv.reject.mutationOptions({
      onSuccess: () => {
        toast({ title: "Rejected — PV is back in draft" });
        setRejectOpen(false);
        invalidate();
      },
      onError: (err) =>
        toast({ title: "Reject failed", description: err.message }),
    }),
  );

  // Which action is the current user allowed to take right now?
  const showSend = canUpdate && status === "DRAFT";
  const showCallback = canUpdate && status === "PENDING_VERIFICATION";
  const isVerifier = verifiedById === currentUserId;
  const isAuthOne = authorisedByOneId === currentUserId;
  const isAuthTwo = authorisedByTwoId === currentUserId;
  const showVerify = status === "PENDING_VERIFICATION" && isVerifier;
  const showAuthOne = status === "PENDING_AUTHORISATION_ONE" && isAuthOne;
  const showAuthTwo = status === "PENDING_AUTHORISATION_TWO" && isAuthTwo;
  const showPost = canPost && status === "APPROVED";
  const canReject = showVerify || showAuthOne || showAuthTwo;

  const anyPending =
    sendMutation.isPending ||
    callbackMutation.isPending ||
    verifyMutation.isPending ||
    authOneMutation.isPending ||
    authTwoMutation.isPending ||
    postMutation.isPending ||
    rejectMutation.isPending;

  // Nothing to render if the user can't take any action.
  if (
    !showSend &&
    !showCallback &&
    !showVerify &&
    !showAuthOne &&
    !showAuthTwo &&
    !showPost
  ) {
    return null;
  }

  function retryPendingApproval() {
    if (!pendingApproval) return;
    if (pendingApproval === "verify") verifyMutation.mutate({ pvNum });
    else if (pendingApproval === "authoriseOne") authOneMutation.mutate({ pvNum });
    else if (pendingApproval === "authoriseTwo") authTwoMutation.mutate({ pvNum });
    else if (pendingApproval === "post") postMutation.mutate({ pvNum });
    setPendingApproval(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showSend && (
          <Button
            type="button"
            size="sm"
            onClick={() => sendMutation.mutate({ pvNum })}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <Send className="size-3.5" />
            Send for verification
          </Button>
        )}
        {showCallback && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => callbackMutation.mutate({ pvNum })}
            disabled={anyPending}
          >
            <Undo2 className="size-3.5" />
            Callback
          </Button>
        )}
        {showVerify && (
          <Button
            type="button"
            size="sm"
            onClick={() => verifyMutation.mutate({ pvNum })}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <CheckCircle2 className="size-3.5" />
            Verify
          </Button>
        )}
        {showAuthOne && (
          <Button
            type="button"
            size="sm"
            onClick={() => authOneMutation.mutate({ pvNum })}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <ShieldCheck className="size-3.5" />
            Authorise
          </Button>
        )}
        {showAuthTwo && (
          <Button
            type="button"
            size="sm"
            onClick={() => authTwoMutation.mutate({ pvNum })}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <ShieldCheck className="size-3.5" />
            Authorise (final)
          </Button>
        )}
        {showPost && (
          <Button
            type="button"
            size="sm"
            onClick={() => postMutation.mutate({ pvNum })}
            disabled={anyPending}
            className={POST_CLS}
          >
            <BookCheck className="size-3.5" />
            Post
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
        title="Reject this PV?"
        description="The PV will return to draft. Any signatures captured by later stages will be cleared."
        onConfirm={(comment) => rejectMutation.mutate({ pvNum, comment })}
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
