"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileStack, Landmark, Percent, Stamp, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { ASSET_CODING_FIELDS, type AssetCoding } from "@/lib/asset-creation";
import type { CeaFeDefaults } from "@/components/cea/CeaForm";

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

      <AssetCodingCard />
      <CeaSettingsCard />
    </div>
  );
};

// The SAP coding printed in the asset creation form's header. New forms
// start with these values; each form keeps its own copy.
function AssetCodingCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: saved, isLoading } = useQuery(trpc.settings.assetCoding.queryOptions());
  // Edited values; null until the user types, so the saved ones show first.
  const [draft, setDraft] = useState<AssetCoding | null>(null);
  const values = draft ?? saved ?? null;
  const complete = values != null && ASSET_CODING_FIELDS.every((f) => values[f.key].trim() !== "");
  const changed =
    values != null && saved != null && ASSET_CODING_FIELDS.some((f) => values[f.key].trim() !== saved[f.key]);

  const saveMutation = useMutation(
    trpc.settings.setAssetCoding.mutationOptions({
      onSuccess: () => {
        toast({ title: "Asset creation defaults updated" });
        setDraft(null);
        queryClient.invalidateQueries({ queryKey: trpc.settings.assetCoding.queryKey() });
      },
      onError: (err) => toast({ title: "Could not save", description: err.message }),
    }),
  );

  return (
    <section className="mt-6 max-w-2xl rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-5 py-3">
        <FileStack className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Asset creation defaults</h2>
      </header>
      <div className="space-y-4 px-5 py-5">
        <p className="text-sm text-muted-foreground">
          The SAP coding printed at the top of asset creation forms. New forms start with these
          values; forms already made keep their own. The functional area can also be changed on
          each form.
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (values && complete && changed) {
              saveMutation.mutate({
                agencyName: values.agencyName.trim(),
                businessArea: values.businessArea.trim(),
                costCentre: values.costCentre.trim(),
                fund: values.fund.trim(),
                functionalArea: values.functionalArea.trim(),
              });
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {ASSET_CODING_FIELDS.map((f) => (
              <div key={f.key} className="grid gap-1.5">
                <label
                  htmlFor={`coding-${f.key}`}
                  className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {f.label}
                </label>
                {isLoading || !values ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Input
                    id={`coding-${f.key}`}
                    value={values[f.key]}
                    onChange={(e) => setDraft({ ...values, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="h-10 font-mono text-sm"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!changed || !complete || saveMutation.isPending}
              className="inline-flex h-10 items-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
            {values && !complete && (
              <span className="text-xs text-red-600">Every field needs a value.</span>
            )}
          </div>
        </form>
      </div>
    </section>
  );
}

const FE_FIELDS = [
  { key: "nameEn", label: "Name", dv: false },
  { key: "nameDv", label: "Name (Dhivehi)", dv: true },
  { key: "designationEn", label: "Designation", dv: false },
  { key: "designationDv", label: "Designation (Dhivehi)", dv: true },
] as const;

const MAX_STAMP_BYTES = 1024 * 1024;

// The Financial Executive printed on new CEA forms (each form can change its
// own copy), and the office stamp printed on signed ones.
function CeaSettingsCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: saved, isLoading } = useQuery(trpc.settings.ceaFe.queryOptions());
  const { data: stamp, isLoading: stampLoading } = useQuery(trpc.settings.officeStamp.queryOptions());
  const [draft, setDraft] = useState<CeaFeDefaults | null>(null);
  const values = draft ?? saved ?? null;
  const changed = values != null && saved != null && FE_FIELDS.some((f) => values[f.key].trim() !== saved[f.key]);

  const saveMutation = useMutation(
    trpc.settings.setCeaFe.mutationOptions({
      onSuccess: () => {
        toast({ title: "Financial Executive updated", description: "New CEA forms will use these details." });
        setDraft(null);
        queryClient.invalidateQueries({ queryKey: trpc.settings.ceaFe.queryKey() });
      },
      onError: (err) => toast({ title: "Could not save", description: err.message }),
    }),
  );
  const stampDone = (title: string) => () => {
    toast({ title });
    queryClient.invalidateQueries({ queryKey: trpc.settings.officeStamp.queryKey() });
  };
  const onStampError = (err: { message: string }) => toast({ title: "Could not update the stamp", description: err.message });
  const uploadStamp = useMutation(
    trpc.settings.setOfficeStamp.mutationOptions({ onSuccess: stampDone("Office stamp saved"), onError: onStampError }),
  );
  const removeStamp = useMutation(
    trpc.settings.clearOfficeStamp.mutationOptions({ onSuccess: stampDone("Office stamp removed"), onError: onStampError }),
  );

  // The server checks the type and size too; this just fails fast.
  const pickStamp = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast({ title: "Use a PNG or JPEG image" });
      return;
    }
    if (file.size > MAX_STAMP_BYTES) {
      toast({ title: "The stamp image must be under 1 MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") uploadStamp.mutate({ dataUrl: reader.result });
    };
    reader.onerror = () => toast({ title: "Could not read that file" });
    reader.readAsDataURL(file);
  };

  const stampBusy = uploadStamp.isPending || removeStamp.isPending;

  return (
    <section className="mt-6 max-w-2xl rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-5 py-3">
        <Landmark className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Capital expenditure authorization</h2>
      </header>
      <div className="space-y-6 px-5 py-5">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The Financial Executive who signs CEA printouts. New forms start with these details;
            each form can change its own.
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (values && changed) {
                saveMutation.mutate({
                  nameEn: values.nameEn.trim(),
                  nameDv: values.nameDv.trim(),
                  designationEn: values.designationEn.trim(),
                  designationDv: values.designationDv.trim(),
                });
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {FE_FIELDS.map((f) => (
                <div key={f.key} className="grid gap-1.5">
                  <label
                    htmlFor={`fe-${f.key}`}
                    className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {f.label}
                  </label>
                  {isLoading || !values ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      id={`fe-${f.key}`}
                      value={values[f.key]}
                      onChange={(e) => setDraft({ ...values, [f.key]: e.target.value })}
                      dir={f.dv ? "rtl" : undefined}
                      lang={f.dv ? "dv" : undefined}
                      maxLength={200}
                      className={f.dv ? "h-10 font-faruma text-[15px]" : "h-10 text-sm"}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={!changed || saveMutation.isPending}
              className="inline-flex h-10 items-center rounded-md bg-foreground px-5 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
          </form>
        </div>

        <div className="space-y-3 border-t pt-5">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Office stamp
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Printed in the middle of the sign-off once a CEA form is signed. A PNG with a
              transparent background looks best; up to 1 MB.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-28 items-center justify-center rounded-md border border-dashed bg-muted/30 p-2">
              {stampLoading ? (
                <Skeleton className="size-full" />
              ) : stamp?.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stamp.dataUrl} alt="Office stamp" className="max-h-full max-w-full object-contain" />
              ) : (
                <Stamp className="size-8 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted",
                  stampBusy && "pointer-events-none opacity-50",
                )}
              >
                <Upload className="size-4" />
                {uploadStamp.isPending ? "Uploading…" : stamp?.dataUrl ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  disabled={stampBusy}
                  onChange={(e) => {
                    pickStamp(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {stamp?.dataUrl && (
                <button
                  type="button"
                  onClick={() => removeStamp.mutate()}
                  disabled={stampBusy}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GeneralSettingsPage;
