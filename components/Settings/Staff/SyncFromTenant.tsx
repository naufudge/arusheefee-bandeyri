"use client";

import React, { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface SyncFromTenantProps {
  onSynced?: () => void;
}

type SyncResult = {
  inserted: number;
  updated: number;
  total: number;
  failed: { name: string; error: string }[];
};

const SyncFromTenant: React.FC<SyncFromTenantProps> = ({ onSynced }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSync = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/staff/sync", { method: "POST" });
      const json = (await res.json().catch(() => null)) as
        | SyncResult
        | { error: string }
        | null;

      if (!res.ok) {
        toast({
          title: "Sync failed",
          description:
            (json && "error" in json && json.error) ||
            `Microsoft Graph returned ${res.status}.`,
        });
        return;
      }

      const r = json as SyncResult;
      const parts: string[] = [];
      if (r.inserted) parts.push(`${r.inserted} new`);
      if (r.updated) parts.push(`${r.updated} updated`);
      parts.push(`${r.total} from tenant`);
      if (r.failed.length > 0) parts.push(`${r.failed.length} failed`);

      toast({
        title: "Sync complete",
        description: parts.join(" · "),
      });
      onSynced?.();
      setOpen(false);
    } catch (err) {
      toast({
        title: "Sync failed",
        description:
          err instanceof Error ? err.message : "Network error during sync.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
        >
          <RefreshCw className="size-4" />
          Sync from tenant
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Microsoft Tenant
          </div>
          <AlertDialogTitle>Sync staff from your tenant?</AlertDialogTitle>
          <AlertDialogDescription>
            Fetches every licensed Member from your Microsoft tenant and adds
            or updates them in this register. Existing staff matched by email
            or name will be linked. Manually-set designations are{" "}
            <span className="font-medium text-foreground">never overwritten</span>.
            No-one is removed by this action.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleSync();
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Run sync
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SyncFromTenant;
