"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

type Props = {
  hasSignature: boolean;
  signatureUpdatedAt: string | null;
};

export function SignatureCard({ hasSignature, signatureUpdatedAt }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(
    () => signatureUpdatedAt ?? Date.now().toString(),
  );

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Not an image",
        description: "Pick a PNG or JPG.",
      });
      return;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      toast({
        title: "Image too large",
        description: "Keep it under 2 MB.",
      });
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
      setNonce(Date.now().toString());
      router.refresh();
      toast({
        title: "Signature saved",
        description: "Your signature has been updated.",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
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

  return (
    <div className="space-y-4">
      {/* Signature panel — themed, with form-like corner ticks */}
      <div className="relative aspect-[5/3] w-full overflow-hidden rounded-md border bg-muted/30">
        {/* Corner ticks */}
        <span className="absolute left-2 top-2 size-2.5 border-l border-t border-muted-foreground/40" />
        <span className="absolute right-2 top-2 size-2.5 border-r border-t border-muted-foreground/40" />
        <span className="absolute bottom-2 left-2 size-2.5 border-b border-l border-muted-foreground/40" />
        <span className="absolute bottom-2 right-2 size-2.5 border-b border-r border-muted-foreground/40" />

        {hasSignature ? (
          <div className="flex h-full w-full items-center justify-center p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/profile/signature?t=${encodeURIComponent(nonce)}`}
              alt="Your signature"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-end pb-8">
            {/* Classic signature line */}
            <div className="flex w-3/4 items-end gap-2 text-muted-foreground/70">
              <span className="text-lg leading-none">×</span>
              <div className="mb-1 h-px flex-1 bg-muted-foreground/40" />
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Sign here
            </div>
          </div>
        )}
      </div>

      {/* Hidden picker */}
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

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {hasSignature ? (
            <>
              <RefreshCw className="size-3.5" />
              Replace
            </>
          ) : (
            <>
              <Upload className="size-3.5" />
              Upload signature
            </>
          )}
        </Button>
        {hasSignature && (
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
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          PNG or JPG, up to 2 MB
        </span>
      </div>
    </div>
  );
}
