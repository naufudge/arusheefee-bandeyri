"use client";

import React, { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { formatNumberWithCommas } from "@/utils/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OpeningBalanceControlProps {
  year: number;
  /** When false the card is read-only (no edit dialog). */
  canEdit?: boolean;
}

const OpeningBalanceControl: React.FC<OpeningBalanceControlProps> = ({
  year,
  canEdit = true,
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const { data: opening, isLoading } = useQuery(
    trpc.pettycash.openingBalance.queryOptions({ year: String(year) }),
  );

  // Previous year's closing — only fetched while the dialog is open.
  const { data: prevClosing, isFetching: prevFetching } = useQuery({
    ...trpc.pettycash.previousYearClosing.queryOptions({ year: String(year) }),
    enabled: open,
  });

  const openDialog = () => {
    setValue(String(opening?.amount ?? 0));
    setOpen(true);
  };

  const setMutation = useMutation(
    trpc.pettycash.setOpeningBalance.mutationOptions({
      onSuccess: () => {
        toast({ title: "Opening balance saved" });
        queryClient.invalidateQueries({
          queryKey: trpc.pettycash.openingBalance.queryKey({
            year: String(year),
          }),
        });
        setOpen(false);
      },
      onError: (err) =>
        toast({ title: "Could not save", description: err.message }),
    }),
  );

  const handleSave = () => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      toast({ title: "Enter a valid number" });
      return;
    }
    setMutation.mutate({ year, amount });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {canEdit ? (
        <button
          type="button"
          onClick={openDialog}
          title="Set the opening balance for this fiscal year"
          className="group relative w-full overflow-hidden rounded-md border bg-card p-5 text-left transition-shadow hover:shadow-sm"
        >
          <CardInner
            isLoading={isLoading}
            amount={opening?.amount ?? 0}
            year={year}
            canEdit
          />
        </button>
      ) : (
        <div className="group relative overflow-hidden rounded-md border bg-card p-5">
          <CardInner
            isLoading={isLoading}
            amount={opening?.amount ?? 0}
            year={year}
          />
        </div>
      )}
      <DialogContent className="bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Opening balance · FY {year}</DialogTitle>
          <DialogDescription>
            The starting petty cash float for {year}. Drives the running balance
            in the register export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Opening balance (MVR)
            </label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono tabular-nums"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              prevClosing && setValue(String(prevClosing.closing))
            }
            disabled={prevFetching || !prevClosing}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-solid hover:bg-muted disabled:opacity-50"
          >
            {prevFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Use FY {year - 1} closing
            {prevClosing
              ? ` (MVR ${formatNumberWithCommas(prevClosing.closing)})`
              : ""}
          </button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={setMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={setMutation.isPending}
          >
            {setMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function CardInner({
  isLoading,
  amount,
  year,
  canEdit,
}: {
  isLoading: boolean;
  amount: number;
  year: number;
  canEdit?: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Opening Balance
        </span>
        <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Wallet className="size-4" />
        </span>
      </div>
      <div className="mt-4 font-mono text-2xl font-medium tracking-tight tabular-nums">
        <span className="mr-1.5 text-base font-medium text-muted-foreground">
          MVR
        </span>
        {isLoading ? "…" : formatNumberWithCommas(amount)}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        FY {year}
        {canEdit ? " · click to set" : ""}
      </div>
    </>
  );
}

export default OpeningBalanceControl;
