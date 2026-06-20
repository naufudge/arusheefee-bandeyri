"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const dhivehiInputStyle: React.CSSProperties = {
  fontFamily: "var(--font-faruma), sans-serif",
  direction: "rtl",
  textAlign: "right",
};

interface EditPcDetailDialogProps {
  pettyCashNum: string;
  /** Present in the edit view; lets the server sync the report's snapshot row. */
  reportNum?: string;
  /** Called after a successful save so the caller can refetch the preview. */
  onSaved: () => void;
}

// Edits the Dhivehi name of each item on a petty cash record. The reconciliation
// "Details" column joins these names, so this is how the user writes the Dhivehi
// detail for a record (and clears the send-gate's missing-Dhivehi check).
const EditPcDetailDialog: React.FC<EditPcDetailDialogProps> = ({
  pettyCashNum,
  reportNum,
  onSaved,
}) => {
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items, isLoading } = useQuery({
    ...trpc.pcRecon.recordItems.queryOptions({ pettyCashNum }),
    enabled: open,
  });

  const mutation = useMutation(
    trpc.pcRecon.setRecordItemDhivehi.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Details saved",
          description: `Updated the Dhivehi details for ${pettyCashNum}.`,
        });
        // Refresh the editor's own items and the form's preview.
        queryClient.invalidateQueries({
          queryKey: trpc.pcRecon.recordItems.queryKey({ pettyCashNum }),
        });
        onSaved();
        setOpen(false);
      },
      onError: (error) =>
        toast({
          title: "Could not save details",
          description: error.message || "An unknown error occurred.",
        }),
    }),
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // This dialog is portaled but still a React descendant of the reconciliation
    // <form>; without this the submit bubbles up the React tree and triggers the
    // outer form (saving the whole report + navigating away).
    e.stopPropagation();
    const fd = new FormData(e.currentTarget);
    const payload = (items ?? []).map((it) => ({
      id: it.id,
      nameDhivehi: String(fd.get(it.id) ?? ""),
    }));
    if (payload.length === 0) return;
    mutation.mutate({ pettyCashNum, items: payload, reportNum });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={`Edit Dhivehi details for ${pettyCashNum}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Dhivehi details</DialogTitle>
          <DialogDescription>
            Petty cash {pettyCashNum}. Give each item a Dhivehi name — these are
            joined to form the record&apos;s details on the report and PDF, and
            are required to send the report for approval.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading items…
          </p>
        ) : !items || items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This record has no items.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="grid gap-1.5">
                  <label
                    htmlFor={`dv-${it.id}`}
                    className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    <span>{it.name || "(no English name)"}</span>
                    <span className="tabular-nums">×{it.qty}</span>
                  </label>
                  <input
                    id={`dv-${it.id}`}
                    name={it.id}
                    defaultValue={it.nameDhivehi ?? ""}
                    placeholder="ދިވެހި ނަން"
                    maxLength={500}
                    lang="dv"
                    dir="rtl"
                    style={dhivehiInputStyle}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditPcDetailDialog;
