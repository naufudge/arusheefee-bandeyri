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
import { useTRPC, useTRPCClient } from "@/lib/trpc";

interface DeleteTemplateButtonProps {
  template: { id: string; name: string };
}

export function DeleteTemplateButton({ template }: DeleteTemplateButtonProps) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Same raw-client mutationFn pattern as the other template mutations
  // — keeps the deep Prisma JsonValue inference out of TS's hair.
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await trpcClient.templates.delete.mutate({ id: template.id });
    },
    onSuccess: () => {
      toast({
        title: "Template deleted",
        description: `Removed "${template.name}".`,
      });
      queryClient.invalidateQueries({
        queryKey: trpc.templates.list.queryKey(),
      });
    },
    onError: (err: Error) =>
      toast({
        title: "Could not delete template",
        description: err.message,
      }),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Delete template"
          className="transition hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this template?</AlertDialogTitle>
          <AlertDialogDescription>
            &quot;{template.name}&quot; will be permanently removed and can
            no longer be applied on the Create PV page. PVs already
            created using it are unaffected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
            className="bg-red-700 hover:bg-red-800"
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
