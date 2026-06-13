"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Undo2, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import type { PcReconStatus } from "@prisma/client";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { RejectDialog } from "./RejectDialog";
import { SignatureRequiredModal } from "./SignatureRequiredModal";
import ReconciliationGateDialog from "@/components/treasury/ReconciliationGateDialog";
import type { GateIssue } from "@/server/schemas/pcrecon.schema";

type PcReconAction = "check" | "authorize";

const APPROVE_CLS =
  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700";
const REJECT_CLS =
  "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700";

interface PcReconActionBarProps {
  reportNum: string;
  status: PcReconStatus;
  currentUserId: string;
  checkedById: string | null;
  authorizedById: string | null;
}

export function PcReconActionBar({
  reportNum,
  status,
  currentUserId,
  checkedById,
  authorizedById,
}: PcReconActionBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canUpdate = useHasPermission(PERMISSIONS.PCRECON_UPDATE);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PcReconAction | null>(
    null,
  );
  const [gateOpen, setGateOpen] = useState(false);
  const [gateIssues, setGateIssues] = useState<GateIssue[]>([]);
  const [rechecking, setRechecking] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({
      queryKey: trpc.pcRecon.getByNum.queryKey({ reportNum }),
    });
    queryClient.invalidateQueries({ queryKey: trpc.pcRecon.list.queryKey() });
  }

  function handleApprovalError(
    action: PcReconAction,
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
    trpc.pcRecon.send.mutationOptions({
      onSuccess: () => {
        toast({ title: "Sent for check" });
        setGateOpen(false);
        invalidate();
      },
      onError: (err) => {
        if (
          err.data?.code === "PRECONDITION_FAILED" &&
          err.message === "DHIVEHI_REQUIRED"
        ) {
          // Backstop fired — refresh the gate list.
          void runPreflight(true);
          return;
        }
        toast({ title: "Could not send", description: err.message });
      },
    }),
  );
  const callbackMutation = useMutation(
    trpc.pcRecon.callback.mutationOptions({
      onSuccess: () => {
        toast({ title: "Called back to draft" });
        invalidate();
      },
      onError: (err) =>
        toast({ title: "Callback failed", description: err.message }),
    }),
  );
  const checkMutation = useMutation(
    trpc.pcRecon.check.mutationOptions({
      onSuccess: () => {
        toast({ title: "Checked" });
        invalidate();
      },
      onError: (err) => handleApprovalError("check", err),
    }),
  );
  const authorizeMutation = useMutation(
    trpc.pcRecon.authorize.mutationOptions({
      onSuccess: () => {
        toast({ title: "Authorized — report completed" });
        invalidate();
      },
      onError: (err) => handleApprovalError("authorize", err),
    }),
  );
  const rejectMutation = useMutation(
    trpc.pcRecon.reject.mutationOptions({
      onSuccess: () => {
        toast({ title: "Rejected — report is back in draft" });
        setRejectOpen(false);
        invalidate();
      },
      onError: (err) =>
        toast({ title: "Reject failed", description: err.message }),
    }),
  );

  // Run the Dhivehi preflight; send if clean, otherwise open the gate dialog.
  async function runPreflight(fromRecheck = false) {
    if (fromRecheck) setRechecking(true);
    try {
      const issues = await queryClient.fetchQuery(
        trpc.pcRecon.sendPreflight.queryOptions({ reportNum }),
      );
      if (issues.length === 0) {
        setGateOpen(false);
        sendMutation.mutate({ reportNum });
      } else {
        setGateIssues(issues);
        setGateOpen(true);
      }
    } catch (err) {
      toast({
        title: "Could not check the report",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      if (fromRecheck) setRechecking(false);
    }
  }

  const showSend = canUpdate && status === "DRAFT";
  const showCallback = canUpdate && status === "PENDING_CHECK";
  const isChecker = checkedById === currentUserId;
  const isAuthorizer = authorizedById === currentUserId;
  const showCheck = status === "PENDING_CHECK" && isChecker;
  const showAuthorize = status === "PENDING_AUTHORIZATION" && isAuthorizer;
  const canReject = showCheck || showAuthorize;

  const anyPending =
    sendMutation.isPending ||
    callbackMutation.isPending ||
    checkMutation.isPending ||
    authorizeMutation.isPending ||
    rejectMutation.isPending;

  if (!showSend && !showCallback && !showCheck && !showAuthorize) {
    return null;
  }

  function retryPendingApproval() {
    if (!pendingApproval) return;
    if (pendingApproval === "check") checkMutation.mutate({ reportNum });
    else if (pendingApproval === "authorize")
      authorizeMutation.mutate({ reportNum });
    setPendingApproval(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showSend && (
          <Button
            type="button"
            size="sm"
            onClick={() => runPreflight()}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <Send className="size-3.5" />
            Send for check
          </Button>
        )}
        {showCallback && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => callbackMutation.mutate({ reportNum })}
            disabled={anyPending}
          >
            <Undo2 className="size-3.5" />
            Callback
          </Button>
        )}
        {showCheck && (
          <Button
            type="button"
            size="sm"
            onClick={() => checkMutation.mutate({ reportNum })}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <CheckCircle2 className="size-3.5" />
            Check
          </Button>
        )}
        {showAuthorize && (
          <Button
            type="button"
            size="sm"
            onClick={() => authorizeMutation.mutate({ reportNum })}
            disabled={anyPending}
            className={APPROVE_CLS}
          >
            <ShieldCheck className="size-3.5" />
            Authorize
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
        title="Reject this report?"
        description="The report will return to draft. Any signatures captured by later stages will be cleared."
        onConfirm={(comment) => rejectMutation.mutate({ reportNum, comment })}
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

      <ReconciliationGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        issues={gateIssues}
        onRecheck={() => runPreflight(true)}
        rechecking={rechecking}
      />
    </>
  );
}
