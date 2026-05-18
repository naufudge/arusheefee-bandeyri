"use client";

import React, { useEffect, useState } from "react";
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
import { useTRPC, useTRPCClient } from "@/lib/trpc";
import type { UpdateTemplateInput } from "@/server/schemas/template.schema";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
}

interface TemplateDialogProps {
  /** Element that opens the dialog. */
  trigger: React.ReactNode;
  /** Existing template — values are not editable here, only name + description. */
  template: TemplateRow;
}

/**
 * Edit a template's name + description. The `values` payload is
 * intentionally read-only on this dialog — to change the stored fields,
 * the user loads the template into Create PV, modifies, and saves a new
 * template (overwriting works via re-save with the same name once the
 * old one is deleted, or via a new name).
 */
export function TemplateDialog({ trigger, template }: TemplateDialogProps) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(template.name);
      setDescription(template.description ?? "");
    }
  }, [open, template]);

  // Raw-client mutationFn pattern — same workaround as
  // SaveTemplateDialog: avoids the deep Prisma `JsonValue` inference
  // exploding TS's type instantiation budget.
  const updateMutation = useMutation({
    mutationFn: async (
      input: Pick<UpdateTemplateInput, "id" | "name" | "description">,
    ) => {
      await trpcClient.templates.update.mutate(input);
    },
    onSuccess: () => {
      toast({
        title: "Template updated",
        description: `Saved "${name.trim()}".`,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.templates.list.queryKey(),
      });
      setOpen(false);
    },
    onError: (err: Error) =>
      toast({
        title: "Could not update template",
        description: err.message,
      }),
  });

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Name required" });
      return;
    }
    updateMutation.mutate({
      id: template.id,
      name: trimmed,
      description: description.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md gap-0 p-0 sm:rounded-md">
        <div className="border-b px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Edit
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            Edit template
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Name and description only. To change the stored fields, load
            the template into the Create PV form and save again.
          </DialogDescription>
        </div>

        <div className="grid gap-5 px-6 py-6">
          <div className="grid gap-1.5">
            <label
              htmlFor="template-edit-name"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Name
            </label>
            <Input
              id="template-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              maxLength={80}
            />
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="template-edit-description"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Description{" "}
              <span className="ml-1 normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="template-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
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
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
