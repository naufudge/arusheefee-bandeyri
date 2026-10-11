"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";
import type { ProcurementStageKey } from "@/lib/procurement";

const LABEL = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

interface LinkDocumentDialogProps {
  procurementId: string;
  type: ProcurementStageKey;
  /** e.g. "GSR form" — used in the copy. */
  docLabel: string;
  trigger: React.ReactNode;
}

/** Pick an existing document that isn't in any procurement yet and link it. */
export function LinkDocumentDialog({ procurementId, type, docLabel, trigger }: LinkDocumentDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [docId, setDocId] = useState("");

  const { data: candidates, isLoading } = useQuery({
    ...trpc.procurement.linkCandidates.queryOptions({ type }),
    enabled: open,
  });

  const linkMutation = useMutation(
    trpc.procurement.link.mutationOptions({
      onSuccess: () => {
        toast({ title: `${docLabel} linked` });
        queryClient.invalidateQueries({ queryKey: trpc.procurement.getById.queryKey({ id: procurementId }) });
        queryClient.invalidateQueries({ queryKey: trpc.procurement.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.procurement.linkCandidates.queryKey({ type }) });
        setOpen(false);
      },
      onError: (err) => toast({ title: "Could not link", description: err.message }),
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDocId("");
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md gap-0 p-0 sm:rounded-md">
        <div className="border-b px-6 py-5">
          <div className={LABEL}>Link existing</div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            Add a {docLabel.toLowerCase()}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Only {docLabel.toLowerCase()}s that aren&apos;t part of another procurement are listed.
          </DialogDescription>
        </div>
        <div className="px-6 py-6">
          <SearchableSelect
            value={docId}
            onValueChange={setDocId}
            options={(candidates ?? []).map((c) => ({ value: c.id, label: c.label, hint: c.hint || undefined }))}
            loading={isLoading}
            placeholder={isLoading ? "Loading…" : `Choose a ${docLabel.toLowerCase()}`}
            searchPlaceholder="Search number or details…"
            emptyMessage={`No unlinked ${docLabel.toLowerCase()}s`}
            contentClassName="w-[min(28rem,90vw)]"
            modal
          />
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
            type="button"
            disabled={!docId || linkMutation.isPending}
            onClick={() => linkMutation.mutate({ procurementId, type, docId })}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Link2 className="size-4" />
            {linkMutation.isPending ? "Linking…" : "Link"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
