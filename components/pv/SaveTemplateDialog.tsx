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
import type {
  CreateTemplateInput,
  TemplateValues,
} from "@/server/schemas/template.schema";

interface AppliedTemplate {
  id: string;
  name: string;
}

interface SaveTemplateDialogProps {
  /** Element that opens the dialog when clicked. */
  trigger: React.ReactNode;
  /**
   * Thunk that returns the partial values to persist. Called when the
   * user clicks Save — not when the dialog mounts — so it reads the
   * latest form state.
   */
  getCurrentValues: () => TemplateValues;
  /**
   * The template currently loaded into the form (if any). When set, the
   * dialog opens with this template's name pre-filled; submitting
   * without changing the name updates the existing template. Editing
   * the name switches the action to "save as new".
   */
  appliedTemplate?: AppliedTemplate | null;
}

/**
 * Save-as-template dialog rendered from the Create PV form. Captures
 * a name + optional description, snapshots the form via
 * `getCurrentValues()`, and POSTs to `templates.create`. Doesn't mutate
 * the form itself.
 */
export function SaveTemplateDialog({
  trigger,
  getCurrentValues,
  appliedTemplate,
}: SaveTemplateDialogProps) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Reset on each re-open. When a template is applied, default the name
  // to that template's so the user submits an update by default; if
  // they edit the name, the action switches to "save as new".
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(appliedTemplate?.name ?? "");
      setDescription("");
    }
  }, [open, appliedTemplate]);

  // "Update existing" iff the dialog opened with an applied template
  // AND the user hasn't edited the name. Editing the name implies
  // intent to create a separate template under a new name.
  const willUpdate =
    appliedTemplate != null && name.trim() === appliedTemplate.name;

  // Raw-client mutationFn pattern (same as the rest of the templates
  // mutations) — keeps Prisma's recursive `JsonValue` out of the
  // useMutation type chain.
  const createMutation = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      await trpcClient.templates.create.mutate(input);
    },
    onSuccess: () => {
      toast({
        title: "Template saved",
        description: `"${name.trim()}" is now available on the Create PV form.`,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.templates.list.queryKey(),
      });
      setOpen(false);
    },
    onError: (err: Error) =>
      toast({
        title: "Could not save template",
        description: err.message,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      description: string | null;
      values: TemplateValues;
    }) => {
      await trpcClient.templates.update.mutate(input);
    },
    onSuccess: () => {
      toast({
        title: "Template updated",
        description: `Changes saved to "${name.trim()}".`,
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

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        title: "Name required",
        description: "Give the template a short, recognisable name.",
      });
      return;
    }
    const payload = {
      name: trimmedName,
      description: description.trim() || null,
      values: getCurrentValues(),
    };
    if (willUpdate && appliedTemplate) {
      updateMutation.mutate({ id: appliedTemplate.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md gap-0 p-0 sm:rounded-md">
        <div className="border-b px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Template
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            {willUpdate ? `Update "${appliedTemplate?.name}"` : "Save as template"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {appliedTemplate
              ? willUpdate
                ? "Overwrites the loaded template with the current form values. Change the name to save as new instead."
                : "You're saving as a new template — the loaded template is left as-is."
              : "Stores every non-empty field currently in the form (the PV number is always left out)."}
          </DialogDescription>
        </div>

        <div className="grid gap-5 px-6 py-6">
          <div className="grid gap-1.5">
            <label
              htmlFor="template-name"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Name
            </label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ACME monthly retainer"
              className="h-9 text-sm"
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="template-description"
              className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Description{" "}
              <span className="ml-1 normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this template is for…"
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
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? willUpdate
                ? "Updating…"
                : "Saving…"
              : willUpdate
                ? "Update template"
                : "Save as new"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
