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
import { useTRPC } from "@/lib/trpc";

export interface GlAccountRow {
  id: number;
  code: number;
  shortTextEn: string;
  longTextEn: string;
  shortTextDv: string | null;
  longTextDv: string | null;
  pettyCashAllowed: boolean;
}

interface GlAccountDialogProps {
  /** Element that opens the dialog. */
  trigger: React.ReactNode;
  /** Existing account to edit. Omit to add a new one. */
  account?: GlAccountRow;
  /** PV GL lines + petty cash records using the account (when editing). */
  usage?: number;
}

const LABEL =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

/**
 * Add or edit a GL account. Records point at the account rather than
 * copying its code, so the code can be corrected — but only while nothing
 * uses the account, so codes on existing PVs and petty cash never change.
 */
export function GlAccountDialog({ trigger, account, usage = 0 }: GlAccountDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEdit = Boolean(account);
  const codeLocked = isEdit && usage > 0;

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [shortTextEn, setShortTextEn] = useState("");
  const [longTextEn, setLongTextEn] = useState("");
  const [shortTextDv, setShortTextDv] = useState("");
  const [longTextDv, setLongTextDv] = useState("");
  const [pettyCashAllowed, setPettyCashAllowed] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCode(account ? String(account.code) : "");
      setShortTextEn(account?.shortTextEn ?? "");
      setLongTextEn(account?.longTextEn ?? "");
      setShortTextDv(account?.shortTextDv ?? "");
      setLongTextDv(account?.longTextDv ?? "");
      setPettyCashAllowed(account?.pettyCashAllowed ?? false);
    }
  }, [open, account]);

  // Both the settings table and the form pickers read the accounts.
  const onSaved = (title: string) => {
    toast({ title, description: `${code} · ${longTextEn.trim()}` });
    queryClient.invalidateQueries({ queryKey: trpc.glAccounts.listWithUsage.queryKey() });
    queryClient.invalidateQueries({ queryKey: trpc.glAccounts.list.queryKey() });
    setOpen(false);
  };

  const createMutation = useMutation(
    trpc.glAccounts.create.mutationOptions({
      onSuccess: () => onSaved("GL account added"),
      onError: (err) =>
        toast({ title: "Could not add GL account", description: err.message }),
    }),
  );

  const updateMutation = useMutation(
    trpc.glAccounts.update.mutationOptions({
      onSuccess: () => onSaved("GL account updated"),
      onError: (err) =>
        toast({ title: "Could not update GL account", description: err.message }),
    }),
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    if (!/^\d{6}$/.test(code.trim())) {
      toast({ title: "GL code must be 6 digits" });
      return;
    }
    if (!shortTextEn.trim() || !longTextEn.trim()) {
      toast({ title: "Short and long text (English) are required" });
      return;
    }

    const input = {
      code: Number(code.trim()),
      shortTextEn: shortTextEn.trim(),
      longTextEn: longTextEn.trim(),
      // Blank Dhivehi is stored as null by the server.
      shortTextDv: shortTextDv.trim() || null,
      longTextDv: longTextDv.trim() || null,
      pettyCashAllowed,
    };
    if (account) updateMutation.mutate({ ...input, id: account.id });
    else createMutation.mutate(input);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg gap-0 p-0 sm:rounded-md">
        <div className="border-b px-6 py-5">
          <div className={LABEL}>{isEdit ? "Edit" : "Add"}</div>
          <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
            {isEdit ? `GL account ${account?.code}` : "New GL account"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {codeLocked
              ? `The code can't be changed — ${usage} record${usage === 1 ? " uses" : "s use"} this account.`
              : "Use the 6-digit code from the government Chart of Accounts."}
          </DialogDescription>
        </div>

        <div className="grid max-h-[65vh] gap-5 overflow-y-auto px-6 py-6">
          <div className="grid gap-1.5">
            <label htmlFor="gl-code" className={LABEL}>
              GL code
            </label>
            <Input
              id="gl-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              readOnly={codeLocked}
              inputMode="numeric"
              maxLength={6}
              placeholder="e.g. 223004"
              className="h-9 font-mono text-sm tabular-nums read-only:bg-muted/50 read-only:text-muted-foreground"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="gl-short-en" className={LABEL}>
                Short text (English)
              </label>
              <Input
                id="gl-short-en"
                value={shortTextEn}
                onChange={(e) => setShortTextEn(e.target.value)}
                maxLength={100}
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="gl-long-en" className={LABEL}>
                Long text (English)
              </label>
              <Input
                id="gl-long-en"
                value={longTextEn}
                onChange={(e) => setLongTextEn(e.target.value)}
                maxLength={255}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="gl-short-dv" className={LABEL}>
                Short text (Dhivehi){" "}
                <span className="ml-1 normal-case tracking-normal">(optional)</span>
              </label>
              <Input
                id="gl-short-dv"
                dir="rtl"
                value={shortTextDv}
                onChange={(e) => setShortTextDv(e.target.value)}
                maxLength={255}
                className="h-9 font-faruma text-[15px]"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="gl-long-dv" className={LABEL}>
                Long text (Dhivehi){" "}
                <span className="ml-1 normal-case tracking-normal">(optional)</span>
              </label>
              <Input
                id="gl-long-dv"
                dir="rtl"
                value={longTextDv}
                onChange={(e) => setLongTextDv(e.target.value)}
                maxLength={255}
                className="h-9 font-faruma text-[15px]"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition hover:bg-muted/40">
            <input
              type="checkbox"
              checked={pettyCashAllowed}
              onChange={(e) => setPettyCashAllowed(e.target.checked)}
              className="mt-0.5 size-3.5 rounded border-input accent-foreground"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium leading-tight">
                Allowed for petty cash
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Shows this account in the petty cash GL code picker.
              </div>
            </div>
          </label>
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
            {isPending ? "Saving…" : isEdit ? "Save changes" : "Add account"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
