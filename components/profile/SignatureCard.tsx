"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SignatureEditor } from "@/components/profile/SignatureEditor";

type Props = {
  hasSignature: boolean;
  signatureUpdatedAt: string | null;
};

export function SignatureCard({ hasSignature, signatureUpdatedAt }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [nonce, setNonce] = useState(
    () => signatureUpdatedAt ?? Date.now().toString(),
  );

  async function uploadAndRefresh(file: File) {
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
      setNonce(Date.now().toString());
      setReplaceOpen(false);
      router.refresh();
      toast({
        title: "Signature saved",
        description: "Your signature has been updated.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove your signature?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/profile/signature", { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast({
          title: "Remove failed",
          description: body.error ?? `Something went wrong (${res.status}).`,
        });
        return;
      }
      router.refresh();
      toast({ title: "Signature removed" });
    } finally {
      setBusy(false);
    }
  }

  // No signature on file — show the editor inline so the user can add one
  // immediately without an extra click.
  if (!hasSignature) {
    return <SignatureEditor onSave={uploadAndRefresh} busy={busy} />;
  }

  return (
    <div className="space-y-4">
      {/* Current signature preview */}
      <div className="relative aspect-[5/3] w-full overflow-hidden rounded-md border bg-muted/30">
        <span className="pointer-events-none absolute left-2 top-2 size-2.5 border-l border-t border-muted-foreground/40" />
        <span className="pointer-events-none absolute right-2 top-2 size-2.5 border-r border-t border-muted-foreground/40" />
        <span className="pointer-events-none absolute bottom-2 left-2 size-2.5 border-b border-l border-muted-foreground/40" />
        <span className="pointer-events-none absolute bottom-2 right-2 size-2.5 border-b border-r border-muted-foreground/40" />
        <div className="flex h-full w-full items-center justify-center p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/profile/signature?t=${encodeURIComponent(nonce)}`}
            alt="Your signature"
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => setReplaceOpen(true)}
          disabled={busy}
        >
          <RefreshCw className="size-3.5" />
          Replace
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleRemove}
          disabled={busy}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
          Remove
        </Button>
      </div>

      {/* Replace dialog */}
      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent className="max-w-md gap-0 p-0 sm:rounded-md">
          <div className="border-b px-6 py-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Replace
            </div>
            <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
              New signature
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Draw it below or upload an image. Your current signature will be
              overwritten.
            </DialogDescription>
          </div>

          <div className="px-6 py-6">
            <SignatureEditor onSave={uploadAndRefresh} busy={busy} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
