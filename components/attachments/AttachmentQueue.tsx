"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type QueuedAttachment = {
  id: string;
  file: File;
  description: string;
};

export interface AttachmentQueueHandle {
  /**
   * Upload everything currently queued against the given parent record.
   * Returns true if every upload succeeded; false if any failed (caller
   * keeps the parent created but should toast the partial failure).
   */
  flush: (
    referenceType: "pv" | "petty_cash",
    referenceId: string,
  ) => Promise<boolean>;
  /** True when there's nothing to upload. */
  isEmpty: () => boolean;
}

/**
 * Holding pen for attachments selected on a create form, before the
 * parent record exists. Submit-time the parent form creates the record,
 * gets an id back, then calls `flush(referenceType, parentId)` on the
 * ref to drain the queue against the polymorphic `/api/attachment` POST.
 */
export const AttachmentQueue = forwardRef<AttachmentQueueHandle>(
  function AttachmentQueue(_props, ref) {
    const { toast } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [queue, setQueue] = useState<QueuedAttachment[]>([]);
    const [description, setDescription] = useState("");

    useImperativeHandle(ref, () => ({
      isEmpty: () => queue.length === 0,
      flush: async (referenceType, referenceId) => {
        if (queue.length === 0) return true;
        let allOk = true;
        for (const item of queue) {
          const qs = new URLSearchParams({
            referenceType,
            referenceId,
            description: item.description,
            filename: item.file.name,
          });
          const res = await fetch(`/api/attachment?${qs.toString()}`, {
            method: "POST",
            headers: {
              "Content-Type": item.file.type || "application/octet-stream",
            },
            body: item.file,
          });
          if (!res.ok) {
            allOk = false;
            const body = (await res.json().catch(() => ({}))) as {
              error?: string;
              detail?: string;
            };
            toast({
              title: `Failed to attach ${item.file.name}`,
              description:
                [body.error, body.detail].filter(Boolean).join(" — ") ||
                `Status ${res.status}`,
            });
          }
        }
        setQueue([]);
        return allOk;
      },
    }));

    function handleFile(file: File) {
      const desc = description.trim() || file.name;
      setQueue((q) => [
        ...q,
        { id: `${Date.now()}-${Math.random()}`, file, description: desc },
      ]);
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
    }

    function remove(id: string) {
      setQueue((q) => q.filter((x) => x.id !== id));
    }

    return (
      <section className="rounded-md border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Paperclip className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Reference documents</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
              {queue.length}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Uploaded after save
          </span>
        </header>

        <div className="grid gap-2 border-b px-4 py-3 sm:grid-cols-[1fr_auto]">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. PO #1234)"
            className="h-9 text-sm"
          />
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="h-9"
          >
            <Upload className="size-3.5" />
            Queue
          </Button>
        </div>

        <div className="divide-y">
          {queue.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No documents queued yet.
            </div>
          ) : (
            queue.map((q) => (
              <div
                key={q.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{q.description}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {q.file.name} · {(q.file.size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(q.id)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition hover:text-destructive"
                  title="Remove from queue"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    );
  },
);
