"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";

const GeneralSettingsPage = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hasAccess = useHasPermission(PERMISSIONS.SETTINGS_MANAGE);

  const { data: gstRate, isLoading } = useQuery({
    ...trpc.settings.gstRate.queryOptions(),
    enabled: hasAccess,
  });
  // Typed value; null until the user edits, so the loaded rate shows first.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? (gstRate != null ? String(gstRate) : "");
  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const changed = valid && parsed !== gstRate;

  const saveMutation = useMutation(
    trpc.settings.setGstRate.mutationOptions({
      onSuccess: (rate) => {
        toast({ title: "GST rate updated", description: `${rate}% is now the GST rate.` });
        setDraft(null);
        queryClient.invalidateQueries({ queryKey: trpc.settings.gstRate.queryKey() });
      },
      onError: (err) => toast({ title: "Could not save", description: err.message }),
    }),
  );

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      <header className="border-b pb-6">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Settings &middot; General
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">General Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">App-wide values used across forms.</p>
      </header>

      <section className="mt-6 max-w-2xl rounded-md border bg-card">
        <header className="flex items-center gap-2 border-b px-5 py-3">
          <Percent className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">GST rate</h2>
        </header>
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-muted-foreground">
            Added to vendor quotes on price evaluations for vendors that charge GST. Draft
            evaluations pick up a new rate when next saved; evaluations already sent keep the rate
            they were sent with.
          </p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (changed) saveMutation.mutate({ rate: parsed });
            }}
          >
            <div className="grid gap-1.5">
              <label
                htmlFor="gst-rate"
                className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                Rate
              </label>
              {isLoading ? (
                <Skeleton className="h-10 w-36" />
              ) : (
                <div className="relative w-36">
                  <Input
                    id="gst-rate"
                    value={value}
                    onChange={(e) => setDraft(e.target.value)}
                    inputMode="decimal"
                    className="h-10 pr-8 text-right font-mono text-base tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={!changed || saveMutation.isPending}
              className="inline-flex h-10 items-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
            {!valid && value.trim() !== "" && (
              <span className="w-full text-xs text-red-600">Enter a percentage between 0 and 100.</span>
            )}
          </form>
        </div>
      </section>
    </div>
  );
};

export default GeneralSettingsPage;
