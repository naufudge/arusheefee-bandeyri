"use client";

import React, { useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PvSignatoryRole } from "@/server/schemas/pv.schema";

// Sentinel for the "leave unassigned" row — Radix Select treats "" as
// "no value" and refuses to render an item with an empty value.
const UNASSIGNED = "__unassigned__";

// What a reassignment costs once the role has already signed, phrased for
// the warning panel. Mirrors SIGNATORY_STAGES in server/routers/pv.ts.
const ROLLBACK_NOTE: Record<PvSignatoryRole, string | null> = {
  preparedBy: null,
  verifiedBy:
    "the verification, both authorisations and the posting will be cleared, and the PV returns to pending verification",
  authorisedByOne:
    "both authorisations and the posting will be cleared, and the PV returns to pending authorisation (1)",
  authorisedByTwo:
    "the second authorisation and the posting will be cleared, and the PV returns to pending authorisation (2)",
};

interface EditSignatoryDialogProps {
  pvNum: string;
  role: PvSignatoryRole;
  label: string;
  currentStaffId: string | null | undefined;
  /** Whether this role has already signed — drives the rollback warning. */
  hasSigned: boolean;
}

/**
 * Pencil + modal for reassigning one signatory on the PV detail page.
 *
 * This exists because `pv.update` can't do the job: it demands the whole
 * voucher, rewrites every invoice row, and silently drops signatory FKs
 * once the PV leaves DRAFT. `pv.setSignatory` is the narrow path.
 */
export function EditSignatoryDialog({
  pvNum,
  role,
  label,
  currentStaffId,
  hasSigned,
}: EditSignatoryDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(currentStaffId ?? UNASSIGNED);

  // Seed the picker on open rather than in an effect, so a cancelled edit
  // never lingers into the next open.
  function handleOpenChange(next: boolean) {
    if (next) setSelected(currentStaffId ?? UNASSIGNED);
    setOpen(next);
  }

  // Lazy: `staff:read` is a separate permission from `pv:update`, so a user
  // who never opens the dialog never triggers that request.
  const {
    data: staffList,
    isLoading,
    error: staffError,
  } = useQuery({
    ...trpc.staff.list.queryOptions(),
    enabled: open,
  });

  // Staff synced from Azure without a designation are half-populated rows;
  // the PV form's picker hides them too.
  const selectableStaff = (staffList ?? []).filter(
    (s) => s.designation && s.designation.trim() !== "",
  );

  const mutation = useMutation(
    trpc.pv.setSignatory.mutationOptions({
      onSuccess: () => {
        toast({ title: `${label} updated` });
        queryClient.invalidateQueries({
          queryKey: trpc.pv.getByNum.queryKey({ pvNum }),
        });
        queryClient.invalidateQueries({ queryKey: trpc.pv.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.pv.byYear.pathKey() });
        // Reassigning an approver re-routes the pending item to a
        // different person's queue, so the sidebar badge and the
        // pending-approvals page have to be refreshed too.
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.pendingCount.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.pending.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.approvals.history.pathKey(),
        });
        setOpen(false);
      },
      onError: (error) =>
        toast({
          title: `Could not update ${label.toLowerCase()}`,
          description: error.message,
        }),
    }),
  );

  const canUnassign = role === "authorisedByTwo";
  const nextStaffId = selected === UNASSIGNED ? null : selected;
  const unchanged = nextStaffId === (currentStaffId ?? null);
  const rollbackNote = hasSigned ? ROLLBACK_NOTE[role] : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          aria-label={`Change ${label.toLowerCase()}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change {label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Reassign this role on PV {pvNum}.
          </DialogDescription>
        </DialogHeader>

        {rollbackNote && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              This role has already signed. If you change it, {rollbackNote}.
              The new signatory will have to sign again.
            </p>
          </div>
        )}

        <div className="grid gap-1.5">
          <label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Staff
          </label>
          {staffError ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              Could not load the staff list: {staffError.message}
            </p>
          ) : (
            <Select
              value={selected}
              onValueChange={setSelected}
              disabled={isLoading || mutation.isPending}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={isLoading ? "Loading staff…" : "Select a staff"}
                />
              </SelectTrigger>
              <SelectContent>
                {canUnassign && (
                  <SelectItem value={UNASSIGNED}>
                    — Leave unassigned —
                  </SelectItem>
                )}
                {selectableStaff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || unchanged || !!staffError}
            onClick={() =>
              mutation.mutate({ pvNum, role, staffId: nextStaffId })
            }
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
