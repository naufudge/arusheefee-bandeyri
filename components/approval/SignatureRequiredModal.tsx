"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SignatureEditor } from "@/components/profile/SignatureEditor";

interface SignatureRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Fired once the upload succeeds. The caller should re-run whatever
   * mutation produced the `PRECONDITION_FAILED` / `SIGNATURE_REQUIRED`
   * error that triggered the modal.
   */
  onUploaded: () => void;
}

/**
 * Blocks an approval action when the actor has no signature on file.
 * Uploads to the same endpoint the profile page uses so users have a
 * single canonical signature regardless of where they upload from.
 */
export function SignatureRequiredModal({
  open,
  onOpenChange,
  onUploaded,
}: SignatureRequiredModalProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function uploadAndRetry(file: File) {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ filename: file.name });
      const res = await fetch(`/api/profile/signature?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        toast({
          title: "Upload failed",
          description:
            [body.error, body.detail].filter(Boolean).join(" — ") ||
            `Something went wrong (${res.status}).`,
        });
        return;
      }
      toast({
        title: "Signature saved",
        description: "Retrying approval…",
      });
      onOpenChange(false);
      onUploaded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 sm:rounded-md">
        <div className="border-b px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Required
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            Add your signature
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            You need a signature on file before you can approve this. Draw it
            below or upload an image — we&apos;ll retry once it&apos;s saved.
          </DialogDescription>
        </div>

        <div className="px-6 py-6">
          <SignatureEditor onSave={uploadAndRetry} busy={busy} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
