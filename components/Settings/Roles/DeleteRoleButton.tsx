"use client";

import React from "react";
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
import { useMutation } from "@tanstack/react-query";

interface DeleteRoleButtonProps {
  role: {
    id: string;
    name: string;
    isSystem: boolean;
    _count: { staff: number };
  };
  onDeleted?: () => void;
}

const DeleteRoleButton: React.FC<DeleteRoleButtonProps> = ({
  role,
  onDeleted,
}) => {
  const trpc = useTRPC();
  const { toast } = useToast();

  const mutation = useMutation(
    trpc.role.delete.mutationOptions({
      onSuccess: () => {
        toast({ title: "Role deleted", description: `Removed "${role.name}".` });
        onDeleted?.();
      },
      onError: (err) =>
        toast({
          title: "Could not delete role",
          description: err.message,
        }),
    }),
  );

  // Locally compute whether deletion is even attemptable. Even if disabled
  // here, the server-side check in the role router is authoritative.
  const disabled = role.isSystem || role._count.staff > 0;
  const disabledReason = role.isSystem
    ? "System role"
    : role._count.staff > 0
      ? `Assigned to ${role._count.staff} staff`
      : null;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Delete role"
          title={disabledReason ?? "Delete role"}
          disabled={disabled}
          className="transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-muted-foreground"
        >
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this role?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{role.name}</span>{" "}
            will be removed permanently. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => mutation.mutate({ id: role.id })}
            className="bg-red-700 hover:bg-red-800"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteRoleButton;
