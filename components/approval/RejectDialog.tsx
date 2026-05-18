"use client";

import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: (comment: string | undefined) => void;
  isPending?: boolean;
}

/**
 * Confirmation dialog for rejecting a PV stage or PC role approval. The
 * comment is optional (per the workflow design): users can submit with
 * or without explaining themselves.
 */
export function RejectDialog({
  open,
  onOpenChange,
  title = "Reject?",
  description = "This will send the record back to draft and clear any signatures from later stages.",
  onConfirm,
  isPending,
}: RejectDialogProps) {
  const [comment, setComment] = useState("");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setComment("");
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-1.5">
          <label
            htmlFor="reject-comment"
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
          >
            Reason <span className="ml-1 normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            id="reject-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What needs to change before resubmission?"
            rows={4}
            maxLength={1000}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => onConfirm(comment.trim() || undefined)}
            className="bg-red-700 hover:bg-red-800"
          >
            {isPending ? "Rejecting…" : "Reject"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
