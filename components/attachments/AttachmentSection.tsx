"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AttachmentViewerModal } from "@/components/attachments/AttachmentViewerModal";

// PDF detection — covers both the canonical MIME type and a filename
// fallback for older rows where `mimeType` may be empty/missing.
function isPdfAttachment(a: { mimeType: string | null; originalName: string | null }) {
  return (
    a.mimeType === "application/pdf" ||
    (a.originalName ?? "").toLowerCase().endsWith(".pdf")
  );
}

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
  /**
   * If true, render an embedded tabbed PDF viewer (document switcher tabs on
   * top, scrollable viewer below) instead of the list + click-to-open modal.
   * Used on the PV detail page; other call sites keep the default list UI.
   */
  embedViewer?: boolean;
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
  embedViewer = false,
}: AttachmentSectionProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Which attachment (if any) is currently open in the inline viewer.
  // Only PDF attachments can be viewed; non-PDFs keep the
  // "Open in new tab" behaviour.
  const [viewing, setViewing] = useState<Attachment | null>(null);

  // Embedded-viewer mode: which document is shown in the iframe. Defaults
  // to the first (most recent) attachment and repairs itself when the
  // current selection is removed (e.g. after a delete).
  const [selectedId, setSelectedId] = useState<number | null>(null);

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

  useEffect(() => {
    // Keep the embedded viewer's selection valid: pick the first
    // attachment when nothing is selected or the selected one is gone.
    if (!embedViewer) return;
    if (selectedId !== null && items.some((i) => i.id === selectedId)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(items[0]?.id ?? null);
  }, [embedViewer, items, selectedId]);

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

  // Embedded viewer: the document currently shown in the iframe.
  const selected = items.find((i) => i.id === selectedId) ?? null;

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

      {embedViewer ? (
        <>
          {/* Document switcher — only when there's more than one. */}
          {items.length > 1 && (
            <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
              {items.map((a) => {
                const active = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    title={a.description}
                    className={`inline-flex max-w-[220px] items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? "border-foreground/30 bg-muted text-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <FileText className="size-3.5 shrink-0" />
                    <span className="truncate">{a.description}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Toolbar for the selected document. */}
          {selected && (
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {selected.description}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {selected.originalName ?? "—"} ·{" "}
                  {format(new Date(selected.createdAt), "d MMM yyyy")}
                  {selected.createdBy?.name ? ` · by ${selected.createdBy.name}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <a
                  href={`/api/attachment/${selected.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted"
                  title="Open in new tab"
                >
                  <Download className="size-3.5" />
                  Open
                </a>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleDelete(
                        selected.id,
                        selected.description || selected.originalName || "this file",
                      )
                    }
                    disabled={busy}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
                    title="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {/* Viewer body — the tall frame only renders once there's a
              document to show; loading / empty stay compact. */}
          {loading ? (
            <div className="px-4 py-12 text-center text-xs text-muted-foreground">
              Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-12 text-center text-xs text-muted-foreground">
              No documents attached yet.
            </div>
          ) : !selected ? null : (
            <div className="h-[75vh] w-full bg-muted/30">
              {isPdfAttachment(selected) ? (
                <iframe
                  key={selected.id}
                  src={`/api/attachment/${selected.id}`}
                  title={selected.description}
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <FileText className="size-10 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">
                    Preview isn&apos;t available for this file type.
                  </p>
                  <a
                    href={`/api/attachment/${selected.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
                  >
                    <Download className="size-4" />
                    Open in new tab
                  </a>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
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
                  {isPdfAttachment(a) ? (
                    <button
                      type="button"
                      onClick={() => setViewing(a)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted"
                      title="View in app"
                    >
                      <Eye className="size-3.5" />
                      View
                    </button>
                  ) : (
                    <a
                      href={`/api/attachment/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted"
                      title="Open in new tab"
                    >
                      <Download className="size-3.5" />
                      Open
                    </a>
                  )}
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

          <AttachmentViewerModal
            open={viewing !== null}
            onOpenChange={(next) => {
              if (!next) setViewing(null);
            }}
            attachment={viewing}
          />
        </>
      )}
    </section>
  );
}
