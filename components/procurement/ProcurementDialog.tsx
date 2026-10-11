"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";

const LABEL = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

interface ProcurementDialogProps {
  trigger: React.ReactNode;
  /** Existing procurement to edit; omit to start a new one. */
  procurement?: { id: string; title: string; notes: string | null; isAsset: boolean };
}

/** Start a procurement (then open it), or rename an existing one. */
export function ProcurementDialog({ trigger, procurement }: ProcurementDialogProps) {
  const isEdit = Boolean(procurement);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [isAsset, setIsAsset] = useState(false);

  function onOpenChange(next: boolean) {
    if (next) {
      setTitle(procurement?.title ?? "");
      setNotes(procurement?.notes ?? "");
      setIsAsset(procurement?.isAsset ?? false);
    }
    setOpen(next);
  }

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: trpc.procurement.list.queryKey() });
    if (procurement) {
      queryClient.invalidateQueries({ queryKey: trpc.procurement.getById.queryKey({ id: procurement.id }) });
    }
  };
  const onError = (err: { message: string }) =>
    toast({ title: "Could not save", description: err.message });

  const createMutation = useMutation(
    trpc.procurement.create.mutationOptions({
      onSuccess: ({ id }) => {
        refresh();
        setOpen(false);
        router.push(`/procurement/${id}`);
      },
      onError,
    }),
  );
  const updateMutation = useMutation(
    trpc.procurement.update.mutationOptions({
      onSuccess: () => {
        toast({ title: "Procurement updated" });
        refresh();
        setOpen(false);
      },
      onError,
    }),
  );
  const saving = createMutation.isPending || updateMutation.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Give the procurement a title" });
      return;
    }
    const payload = { title: title.trim(), notes: notes.trim() || null, isAsset };
    if (procurement) updateMutation.mutate({ id: procurement.id, ...payload });
    else createMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md gap-0 p-0 sm:rounded-md">
        <form onSubmit={submit}>
          <div className="border-b px-6 py-5">
            <div className={LABEL}>{isEdit ? "Edit" : "New"}</div>
            <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
              {isEdit ? "Edit procurement" : "Start a procurement"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {isEdit
                ? "Rename it, update its notes, or change whether it's an asset purchase."
                : "Name the purchase, then add its GSR, price evaluation and PVs — and, for an asset, its asset creation forms and register entries."}
            </DialogDescription>
          </div>
          <div className="grid gap-5 px-6 py-6">
            <div className="grid gap-1.5">
              <label htmlFor="proc-title" className={LABEL}>
                Title
              </label>
              <Input
                id="proc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Printer Servicing"
                maxLength={200}
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="proc-notes" className={LABEL}>
                Notes <span className="ml-1 normal-case tracking-normal">(optional)</span>
              </label>
              <textarea
                id="proc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isAsset}
              onClick={() => setIsAsset((v) => !v)}
              className={`flex items-start gap-3 rounded-md border px-3.5 py-3 text-left transition ${
                isAsset ? "border-foreground/40 bg-muted/50" : "hover:bg-muted/30"
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                  isAsset ? "bg-foreground" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`size-4 rounded-full bg-background shadow-sm transition ${
                    isAsset ? "translate-x-4" : ""
                  }`}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">This purchase is an asset</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Adds the asset creation and asset registration stages before payment.
                </span>
              </span>
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 border-t bg-muted/30 px-6 py-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
