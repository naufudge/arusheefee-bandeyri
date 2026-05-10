"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useMutation } from "@tanstack/react-query";
import {
  PERMISSION_GROUPS,
  type Permission,
} from "@/lib/permissions";

interface RoleDialogProps {
  trigger: React.ReactNode;
  /**
   * Pass an existing role to edit it. Omit (or pass null) to create a new
   * role.
   */
  role?: {
    id: string;
    name: string;
    description: string | null;
    permissions: string[];
    isSystem: boolean;
  } | null;
  onSaved?: () => void;
}

const RoleDialog: React.FC<RoleDialogProps> = ({
  trigger,
  role,
  onSaved,
}) => {
  const trpc = useTRPC();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const isEdit = Boolean(role);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset form whenever the dialog opens (or the underlying role changes).
  // Synchronous setState here is intentional — we sync local form state to
  // incoming props on the open event; not a re-render cascade.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(role?.name ?? "");
      setDescription(role?.description ?? "");
      setSelected(new Set(role?.permissions ?? []));
    }
  }, [open, role]);

  const createMutation = useMutation(
    trpc.role.create.mutationOptions({
      onSuccess: () => {
        toast({ title: "Role created", description: `Created "${name}".` });
        onSaved?.();
        setOpen(false);
      },
      onError: (err) =>
        toast({
          title: "Could not create role",
          description: err.message,
        }),
    }),
  );

  const updateMutation = useMutation(
    trpc.role.update.mutationOptions({
      onSuccess: () => {
        toast({ title: "Role updated", description: `Saved "${name}".` });
        onSaved?.();
        setOpen(false);
      },
      onError: (err) =>
        toast({
          title: "Could not save role",
          description: err.message,
        }),
    }),
  );

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending;

  const togglePermission = (key: Permission) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    for (const group of PERMISSION_GROUPS) {
      for (const p of group.permissions) all.add(p.key);
    }
    setSelected(all);
  };

  const clearAll = () => setSelected(new Set());

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please give the role a name.",
      });
      return;
    }
    const permissions = Array.from(selected) as Permission[];
    if (isEdit && role) {
      updateMutation.mutate({
        id: role.id,
        name: name.trim(),
        description: description.trim() || null,
        permissions,
      });
    } else {
      createMutation.mutate({
        name: name.trim(),
        description: description.trim() || null,
        permissions,
      });
    }
  };

  const allCount = PERMISSION_GROUPS.reduce(
    (n, g) => n + g.permissions.length,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && setOpen(o)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:rounded-md">
        {/* Header */}
        <div className="border-b px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {isEdit ? "Edit role" : "New role"}
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            {isEdit ? `Edit "${role?.name}"` : "Create a role"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Bundle permissions into a role. Assign the role to staff from
            the Staff settings page.
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-auto px-6 py-6">
          <div className="grid gap-5">
            <div className="grid gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Accounts Officer"
                className="h-9 text-sm"
                autoFocus
                maxLength={60}
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Description{" "}
                <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                  (optional)
                </span>
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this role is for"
                className="h-9 text-sm"
                maxLength={280}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Permissions{" "}
                  <span className="ml-1 font-mono normal-case tracking-normal">
                    ({selected.size}/{allCount})
                  </span>
                </label>
                <div className="flex items-center gap-3 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Select all
                  </button>
                  <span className="text-muted-foreground/40">·</span>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-4">
                {PERMISSION_GROUPS.map((group) => (
                  <div
                    key={group.label}
                    className="rounded-md border bg-background"
                  >
                    <div className="border-b px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {group.label}
                    </div>
                    <ul className="divide-y">
                      {group.permissions.map((perm) => {
                        const checked = selected.has(perm.key);
                        return (
                          <li key={perm.key}>
                            <label className="flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-muted/40">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(perm.key)}
                                className="mt-0.5 size-3.5 rounded border-input accent-foreground"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium leading-tight">
                                  {perm.label}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {perm.description}
                                </div>
                              </div>
                              <code className="font-mono text-[10px] text-muted-foreground/60">
                                {perm.key}
                              </code>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create role"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoleDialog;
