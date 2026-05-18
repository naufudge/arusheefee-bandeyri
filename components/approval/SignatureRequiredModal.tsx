"use client";

import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Not an image", description: "Pick a PNG or JPG." });
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      toast({ title: "Image too large", description: "Keep it under 2 MB." });
      return;
    }

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
      if (inputRef.current) inputRef.current.value = "";
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
            Upload your signature
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            You need a signature on file before you can approve this. We&apos;ll
            retry once it&apos;s uploaded.
          </DialogDescription>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="relative aspect-[5/3] w-full overflow-hidden rounded-md border bg-muted/30">
            <span className="absolute left-2 top-2 size-2.5 border-l border-t border-muted-foreground/40" />
            <span className="absolute right-2 top-2 size-2.5 border-r border-t border-muted-foreground/40" />
            <span className="absolute bottom-2 left-2 size-2.5 border-b border-l border-muted-foreground/40" />
            <span className="absolute bottom-2 right-2 size-2.5 border-b border-r border-muted-foreground/40" />
            <div className="flex h-full w-full flex-col items-center justify-end pb-8">
              <div className="flex w-3/4 items-end gap-2 text-muted-foreground/70">
                <span className="text-lg leading-none">×</span>
                <div className="mb-1 h-px flex-1 bg-muted-foreground/40" />
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Sign here
              </div>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              <Upload className="size-3.5" />
              {busy ? "Uploading…" : "Upload signature"}
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">
              PNG or JPG, up to 2 MB
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
