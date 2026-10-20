"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, ListOrdered, Send, ShieldCheck, Undo2, XCircle } from "lucide-react";
import type { AssetCreationStatus } from "@prisma/client";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { assetClassOptions, lvaProblem } from "@/lib/asset-classes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { RejectDialog } from "./RejectDialog";
import { SignatureRequiredModal } from "./SignatureRequiredModal";

const APPROVE_CLS =
  "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700";
const REJECT_CLS =
  "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700";
const LABEL = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

interface SapUpdateInfo {
  forms: { id: string; formNum: string; sapAssetNum: string | null }[];
  /** Prefilled class: the confirmed one, else the requested one. */
  assetClass: string;
  /** Register entries completing will add (0 unless it's a Create set). */
  registerEntries: number;
  /** MVR, per form — LVA classes only fit under the limit. */
  originalValue: number | null;
}

interface AssetCreationActionBarProps {
  /** Any of the set's form numbers. */
  formNum: string;
  status: AssetCreationStatus;
  currentUserId: string;
  requestedById: string | null;
  authorizedById: string | null;
  sapUpdatedById: string | null;
  sap: SapUpdateInfo;
}

export function AssetCreationActionBar({
  formNum,
  status,
  currentUserId,
  requestedById,
  authorizedById,
  sapUpdatedById,
  sap,
}: AssetCreationActionBarProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canUpdate = useHasPermission(PERMISSIONS.ASSETCREATION_UPDATE);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [sapOpen, setSapOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: trpc.assetCreation.getByNum.pathKey() });
    queryClient.invalidateQueries({ queryKey: trpc.assetCreation.list.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.procurement.pathKey() });
    queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
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
    trpc.assetCreation.send.mutationOptions({
      onSuccess: () => {
        toast({ title: "Sent for authorisation" });
        invalidate();
      },
      onError: onSignError(() => sendMutation.mutate({ formNum })),
    }),
  );
  const callbackMutation = useMutation(
    trpc.assetCreation.callback.mutationOptions({
      onSuccess: () => {
        toast({ title: "Called back to draft" });
        invalidate();
      },
      onError: (err) => toast({ title: "Callback failed", description: err.message }),
    }),
  );
  const authorizeMutation = useMutation(
    trpc.assetCreation.authorize.mutationOptions({
      onSuccess: () => {
        toast({ title: "Authorised — over to the SAP update" });
        invalidate();
      },
      onError: onSignError(() => authorizeMutation.mutate({ formNum })),
    }),
  );
  const sapMutation = useMutation(
    trpc.assetCreation.sapUpdate.mutationOptions({
      onSuccess: ({ registered }) => {
        toast({
          title: "SAP update signed",
          description:
            registered > 0
              ? `${registered} register ${registered === 1 ? "entry" : "entries"} added.`
              : undefined,
        });
        setSapOpen(false);
        invalidate();
      },
      onError: (err) => {
        // The dialog keeps its inputs, so a retry resubmits the same numbers.
        if (err.data?.code === "PRECONDITION_FAILED" && err.message === "SIGNATURE_REQUIRED") {
          setRetry(() => () => setSapOpen(true));
          setSignatureOpen(true);
          return;
        }
        toast({ title: "SAP update failed", description: err.message });
      },
    }),
  );
  const rejectMutation = useMutation(
    trpc.assetCreation.reject.mutationOptions({
      onSuccess: () => {
        toast({ title: "Rejected — back in draft" });
        setRejectOpen(false);
        invalidate();
      },
      onError: (err) => toast({ title: "Reject failed", description: err.message }),
    }),
  );

  const isPending = status.startsWith("PENDING_");
  const showSend = status === "DRAFT" && requestedById === currentUserId;
  const showCallback = isPending && (requestedById === currentUserId || canUpdate);
  const showAuthorize = status === "PENDING_AUTHORIZATION" && authorizedById === currentUserId;
  const showSap = status === "PENDING_SAP_UPDATE" && sapUpdatedById === currentUserId;
  const canReject = showAuthorize || showSap;

  const busy =
    sendMutation.isPending ||
    callbackMutation.isPending ||
    authorizeMutation.isPending ||
    sapMutation.isPending ||
    rejectMutation.isPending;

  if (!showSend && !showCallback && !showAuthorize && !showSap) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showSend && (
          <Button type="button" size="sm" onClick={() => sendMutation.mutate({ formNum })} disabled={busy} className={APPROVE_CLS}>
            <Send className="size-3.5" />
            Sign &amp; send for authorisation
          </Button>
        )}
        {showAuthorize && (
          <Button type="button" size="sm" onClick={() => authorizeMutation.mutate({ formNum })} disabled={busy} className={APPROVE_CLS}>
            <ShieldCheck className="size-3.5" />
            Authorise
          </Button>
        )}
        {showSap && (
          <Button type="button" size="sm" onClick={() => setSapOpen(true)} disabled={busy} className={APPROVE_CLS}>
            <DatabaseZap className="size-3.5" />
            SAP update
          </Button>
        )}
        {canReject && (
          <Button type="button" size="sm" onClick={() => setRejectOpen(true)} disabled={busy} className={REJECT_CLS}>
            <XCircle className="size-3.5" />
            Reject
          </Button>
        )}
        {showCallback && (
          <Button type="button" size="sm" variant="outline" onClick={() => callbackMutation.mutate({ formNum })} disabled={busy}>
            <Undo2 className="size-3.5" />
            Call back
          </Button>
        )}
      </div>

      <SapUpdateDialog
        // Remount on open so the inputs prefill from the latest data.
        key={sapOpen ? "open" : "closed"}
        open={sapOpen}
        onOpenChange={setSapOpen}
        sap={sap}
        isPending={sapMutation.isPending}
        onConfirm={(assetClass, sapAssetNums) =>
          sapMutation.mutate({ formNum, assetClass, sapAssetNums })
        }
      />

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject these asset creation forms?"
        description="They return to draft for the requester, and every signature so far is cleared."
        onConfirm={(comment) => rejectMutation.mutate({ formNum, comment })}
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

/** "80041650" → "80041651", keeping any prefix and zero-padding; null if it doesn't end in digits. */
function nextInSequence(num: string, step: number): string | null {
  const m = /^(.*?)(\d+)$/.exec(num.trim());
  if (!m) return null;
  const next = String(Number(m[2]) + step).padStart(m[2].length, "0");
  return m[1] + next;
}

// The SAP updater records each form's SAP asset number and confirms the
// asset class, then signs — completing the set.
function SapUpdateDialog({
  open,
  onOpenChange,
  sap,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sap: SapUpdateInfo;
  isPending: boolean;
  onConfirm: (assetClass: string, sapAssetNums: { formId: string; sapAssetNum: string }[]) => void;
}) {
  const [assetClass, setAssetClass] = useState(sap.assetClass);
  const [nums, setNums] = useState<string[]>(sap.forms.map((f) => f.sapAssetNum ?? ""));
  const filled = nums.every((n) => n.trim() !== "");
  const classProblem = lvaProblem(assetClass, sap.originalValue);
  const canSequence = sap.forms.length > 1 && nextInSequence(nums[0] ?? "", 1) !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:rounded-md">
        <div className="border-b px-6 py-5">
          <div className={LABEL}>SAP asset master update</div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            Record the SAP asset numbers
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Enter the number SAP gave each asset, confirm the class, then sign.
            {sap.registerEntries > 0 &&
              ` Completing adds ${sap.registerEntries} asset register ${sap.registerEntries === 1 ? "entry" : "entries"}.`}
          </DialogDescription>
        </div>

        <div className="grid gap-5 px-6 py-6">
          <div className="grid gap-1.5">
            <span className={LABEL}>Asset class</span>
            <SearchableSelect
              value={assetClass}
              onValueChange={setAssetClass}
              options={assetClassOptions()}
              placeholder="Select an asset class"
              searchPlaceholder="Search class, code or GL…"
              modal
              contentClassName="w-[min(30rem,85vw)]"
            />
            {classProblem && <p className="text-xs text-red-600 dark:text-red-400">{classProblem}</p>}
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className={LABEL}>SAP asset numbers</span>
              {canSequence && (
                <button
                  type="button"
                  onClick={() =>
                    setNums((prev) => prev.map((n, i) => (i === 0 ? n : (nextInSequence(prev[0], i) ?? n))))
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <ListOrdered className="size-3.5" />
                  Fill the rest in sequence
                </button>
              )}
            </div>
            <ol className="max-h-[300px] divide-y overflow-y-auto rounded-md border">
              {sap.forms.map((f, i) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-[120px] shrink-0 font-mono text-xs text-muted-foreground">{f.formNum}</span>
                  <Input
                    value={nums[i] ?? ""}
                    onChange={(e) =>
                      setNums((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))
                    }
                    autoFocus={i === 0}
                    placeholder="e.g. 68247604"
                    className="h-9 font-mono text-sm"
                  />
                </li>
              ))}
            </ol>
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
            disabled={isPending || !filled || !assetClass || classProblem != null}
            onClick={() =>
              onConfirm(
                assetClass,
                sap.forms.map((f, i) => ({ formId: f.id, sapAssetNum: nums[i].trim() })),
              )
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Signing…" : "Sign & complete"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
