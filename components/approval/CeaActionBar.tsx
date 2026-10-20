"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PenLine, Undo2 } from "lucide-react";
import type { CeaStatus } from "@prisma/client";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { SignatureRequiredModal } from "./SignatureRequiredModal";

const APPROVE_CLS =
  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700";

interface CeaActionBarProps {
  ceaNum: string;
  status: CeaStatus;
  currentUserId: string;
  requestedById: string | null;
  /** Why it can't be signed yet (from `ceaSignProblem`), or null. */
  signProblem: string | null;
}

export function CeaActionBar({ ceaNum, status, currentUserId, requestedById, signProblem }: CeaActionBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canEditLocked = useHasPermission(PERMISSIONS.CEA_EDIT_LOCKED);
  const [signatureOpen, setSignatureOpen] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.cea.getByNum.pathKey() });
    queryClient.invalidateQueries({ queryKey: trpc.cea.list.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.procurement.pathKey() });
  }

  const signMutation = useMutation(
    trpc.cea.sign.mutationOptions({
      onSuccess: () => {
        toast({ title: "Signed", description: "The PDF now carries your signature and the office stamp." });
        invalidate();
      },
      onError: (err) => {
        // No signature on file: open the pad, then sign again.
        if (err.data?.code === "PRECONDITION_FAILED" && err.message === "SIGNATURE_REQUIRED") {
          setSignatureOpen(true);
          return;
        }
        toast({ title: "Could not sign", description: err.message });
      },
    }),
  );
  const reopenMutation = useMutation(
    trpc.cea.reopen.mutationOptions({
      onSuccess: () => {
        toast({ title: "Reopened to draft" });
        invalidate();
      },
      onError: (err) => toast({ title: "Could not reopen", description: err.message }),
    }),
  );

  const isRequester = requestedById === currentUserId;
  const showSign = status === "DRAFT" && isRequester;
  const showReopen = status === "SIGNED" && (isRequester || canEditLocked);
  const busy = signMutation.isPending || reopenMutation.isPending;

  if (!showSign && !showReopen) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {showSign && (
          <Button
            type="button"
            size="sm"
            onClick={() => signMutation.mutate({ ceaNum })}
            disabled={busy || signProblem != null}
            className={APPROVE_CLS}
          >
            <PenLine className="size-3.5" />
            Sign
          </Button>
        )}
        {showSign && signProblem && <span className="text-xs text-muted-foreground">{signProblem}</span>}
        {showReopen && (
          <Button type="button" size="sm" variant="outline" onClick={() => reopenMutation.mutate({ ceaNum })} disabled={busy}>
            <Undo2 className="size-3.5" />
            Reopen to draft
          </Button>
        )}
      </div>

      <SignatureRequiredModal
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        onUploaded={() => signMutation.mutate({ ceaNum })}
      />
    </>
  );
}
