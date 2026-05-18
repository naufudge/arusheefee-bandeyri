"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Download, Paperclip, Trash2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Attachment = {
  id: number;
  description: string;
  originalName: string | null;
  mimeType: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string | null } | null;
};

interface AttachmentSectionProps {
  referenceType: "pv" | "petty_cash";
  referenceId: string;
  /** If false, the upload widget is hidden (e.g. no read permission). */
  canAdd?: boolean;
  /**
   * If false, delete buttons are hidden / disabled (e.g. parent is locked).
   * Server-side delete is also gated; this just avoids confusing UI.
   */
  canDelete?: boolean;
}

/**
 * Reference-document attachments for a PV or Petty Cash record.
 * Mounts on the detail page and on edit forms. Uploads go to the existing
 * polymorphic `/api/attachment` route (reference_type = "pv" |
 * "petty_cash"). Server enforces permission + edit-lock; this component
 * just gives a clean UI and disables actions it knows the server will
 * reject anyway.
 */
export function AttachmentSection({
  referenceType,
  referenceId,
  canAdd = true,
  canDelete = true,
}: AttachmentSectionProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({
      referenceType,
      referenceId,
    });
    setLoading(true);
    try {
      const res = await fetch(`/api/attachment?${qs.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast({
          title: "Failed to load attachments",
          description: body.error ?? `Status ${res.status}`,
        });
        return;
      }
      const data = (await res.json()) as { attachments: Attachment[] };
      setItems(data.attachments);
    } finally {
      setLoading(false);
    }
  }, [referenceType, referenceId, toast]);

  useEffect(() => {
    // Fetch on mount + whenever the referenced record changes. `load`
    // itself flips setLoading internally; the lint warning is the
    // canonical false-positive for fetch-on-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleFile(file: File) {
    const desc = description.trim() || file.name;
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        referenceType,
        referenceId,
        description: desc,
        filename: file.name,
      });
      const res = await fetch(`/api/attachment?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
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
            `Status ${res.status}`,
        });
        return;
      }
      setDescription("");
      toast({ title: "Attached", description: desc });
      await load();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Remove "${name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/attachment/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast({
          title: "Delete failed",
          description: body.error ?? `Status ${res.status}`,
        });
        return;
      }
      toast({ title: "Attachment removed" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Paperclip className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Reference documents</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
            {items.length}
          </span>
        </div>
      </header>

      {canAdd && (
        <div className="grid gap-2 border-b px-4 py-3 sm:grid-cols-[1fr_auto]">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. PO #1234)"
            className="h-9 text-sm"
            disabled={busy}
          />
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="h-9"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Attach
          </Button>
        </div>
      )}

      <div className="divide-y">
        {loading ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            No documents attached yet.
          </div>
        ) : (
          items.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.description}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {a.originalName ?? "—"} ·{" "}
                  {format(new Date(a.createdAt), "d MMM yyyy")}
                  {a.createdBy?.name ? ` · by ${a.createdBy.name}` : ""}
                </div>
              </div>
              <a
                href={`/api/attachment/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted"
                title="Download"
              >
                <Download className="size-3.5" />
                Open
              </a>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() =>
                    handleDelete(a.id, a.description || a.originalName || "this file")
                  }
                  disabled={busy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
                  title="Remove"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
