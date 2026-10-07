"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
import { useTRPC } from "@/lib/trpc";

interface DeleteGlAccountButtonProps {
  account: { id: number; code: number; longTextEn: string };
  /** PV GL lines + petty cash records using the account. */
  usage: number;
}

export function DeleteGlAccountButton({ account, usage }: DeleteGlAccountButtonProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation(
    trpc.glAccounts.delete.mutationOptions({
      onSuccess: () => {
        toast({
          title: "GL account deleted",
          description: `Removed ${account.code} · ${account.longTextEn}.`,
        });
        queryClient.invalidateQueries({ queryKey: trpc.glAccounts.listWithUsage.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.glAccounts.list.queryKey() });
      },
      onError: (err) =>
        toast({ title: "Could not delete GL account", description: err.message }),
    }),
  );

  // Accounts in use can't be deleted (the server refuses too). The wrapper
  // carries the tooltip, since disabled buttons don't get hover events.
  if (usage > 0) {
    return (
      <span
        title={`In use by ${usage} record${usage === 1 ? "" : "s"} — can't be deleted`}
        className="inline-flex cursor-not-allowed"
      >
        <button
          type="button"
          aria-label="Delete GL account"
          disabled
          className="pointer-events-none opacity-30"
        >
          <Trash2 className="size-4" />
        </button>
      </span>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Delete GL account"
          className="transition hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete GL account {account.code}?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{account.longTextEn}&quot; will be removed from the chart of
            accounts and can no longer be picked on PVs or petty cash. Nothing
            uses it yet.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ id: account.id })}
            className="bg-red-700 hover:bg-red-800"
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
