"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ClipboardList,
  FileStack,
  Link2,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  Scale,
  Trash2,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
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
import { NoAccessCard } from "@/components/shared/PermissionGate";
import {
  AssetCreationStatusPill,
  GSRStatusPill,
  PriceEvalStatusPill,
  StatusPill,
} from "@/components/approval/StatusPill";
import { StageTracker, ProcurementStatusPill } from "@/components/procurement/StageTracker";
import { ProcurementDialog } from "@/components/procurement/ProcurementDialog";
import { LinkDocumentDialog } from "@/components/procurement/LinkDocumentDialog";
import type { ProcurementSummary } from "@/components/procurement/types";
import { useHasPermission } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { visibleStages, type ProcurementStageKey } from "@/lib/procurement";
import { formatNumberWithCommas } from "@/utils/helpers";

const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";

const GSR_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_AUTHORIZATION: "Awaiting authorization",
  PENDING_RECEIPT: "Authorised",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};
const PE_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_BUDGET_CHECK: "Awaiting budget check",
  PENDING_CHECK: "Awaiting check",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const AC_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_AUTHORIZATION: "Awaiting authorisation",
  PENDING_SAP_UPDATE: "Awaiting SAP update",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

// Per stage: icon, where "Create" goes, the permission it needs, and an
// optional note under the heading.
const STAGE_UI: Record<
  ProcurementStageKey,
  {
    icon: React.ComponentType<{ className?: string }>;
    createHref: (id: string) => string;
    createPerm: Permission;
    createLabel: string;
    note?: string;
  }
> = {
  gsr: { icon: ClipboardList, createHref: (id) => `/gsr/create?procurementId=${id}`, createPerm: PERMISSIONS.GSR_CREATE, createLabel: "Create GSR" },
  priceEvaluation: { icon: Scale, createHref: (id) => `/price-evaluation/create?procurementId=${id}`, createPerm: PERMISSIONS.PRICEEVAL_CREATE, createLabel: "Create price evaluation" },
  assetCreation: {
    icon: FileStack,
    createHref: (id) => `/asset-creation/create?procurementId=${id}`,
    createPerm: PERMISSIONS.ASSETCREATION_CREATE,
    createLabel: "Create asset creation form",
  },
  asset: {
    icon: Package,
    createHref: (id) => `/asset/create?procurementId=${id}`,
    createPerm: PERMISSIONS.ASSET_CREATE,
    createLabel: "Register asset",
    note: "Added automatically when an asset creation form is completed",
  },
  pv: { icon: ReceiptText, createHref: (id) => `/create?procurementId=${id}`, createPerm: PERMISSIONS.PV_CREATE, createLabel: "Create PV" },
};

const ProcurementDetailPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = use(params);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hasAccess = useHasPermission(PERMISSIONS.PROCUREMENT_READ);
  const canUpdate = useHasPermission(PERMISSIONS.PROCUREMENT_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.PROCUREMENT_DELETE);
  const perms = {
    [PERMISSIONS.GSR_CREATE]: useHasPermission(PERMISSIONS.GSR_CREATE),
    [PERMISSIONS.PRICEEVAL_CREATE]: useHasPermission(PERMISSIONS.PRICEEVAL_CREATE),
    [PERMISSIONS.ASSETCREATION_CREATE]: useHasPermission(PERMISSIONS.ASSETCREATION_CREATE),
    [PERMISSIONS.PV_CREATE]: useHasPermission(PERMISSIONS.PV_CREATE),
    [PERMISSIONS.ASSET_CREATE]: useHasPermission(PERMISSIONS.ASSET_CREATE),
  } as Partial<Record<Permission, boolean>>;

  const { data: p, isLoading, error } = useQuery({
    ...trpc.procurement.getById.queryOptions({ id }),
    enabled: hasAccess,
  });

  const deleteMutation = useMutation(
    trpc.procurement.delete.mutationOptions({
      onSuccess: () => {
        toast({ title: "Procurement deleted", description: "Its documents are kept." });
        queryClient.invalidateQueries({ queryKey: trpc.procurement.list.queryKey() });
        router.push("/procurement-register");
      },
      onError: (err) => toast({ title: "Could not delete", description: err.message }),
    }),
  );

  if (!hasAccess) return <NoAccessCard />;

  const paid = p ? p.pvs.filter((pv) => pv.status === "POSTED").reduce((s, pv) => s + pv.totalMvr, 0) : 0;

  return (
    <div className="font-poppins h-full">
      <header className="border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/procurement-register" className="transition hover:text-foreground">
              Procurements
            </Link>
            <span>/</span>
            <span className="truncate normal-case tracking-normal text-foreground">{p?.title ?? "…"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={router.back}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back
            </button>
            {p && canUpdate && (
              <ProcurementDialog
                procurement={p}
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
                  >
                    <Pencil className="size-4" />
                    Edit
                  </button>
                }
              />
            )}
            {p && canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Delete procurement"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{p.title}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The procurement is removed. Its documents — GSR, price evaluation, asset
                      creation forms, assets and PVs — are kept; they just won&apos;t be grouped any
                      more.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ id: p.id })}
                      className="bg-red-700 hover:bg-red-800"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:mt-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Procurement
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {p ? p.title : <Skeleton className="inline-block h-8 w-64" />}
            </h1>
            {p?.notes && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{p.notes}</p>}
          </div>
          {p && (
            <div className="flex flex-wrap items-end gap-6 md:justify-end md:text-right">
              {p.priceEvaluation?.total != null && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Evaluated
                  </div>
                  <div className="mt-1 font-mono text-lg tabular-nums">MVR {money(p.priceEvaluation.total)}</div>
                </div>
              )}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Paid
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  <span className="mr-1.5 text-sm font-normal text-muted-foreground">MVR</span>
                  {money(paid)}
                </div>
              </div>
            </div>
          )}
        </div>

        {p && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-4">
            <ProcurementStatusPill progress={p.progress} />
            <span>
              Started {format(new Date(p.createdAt), "d MMM yyyy")}
              {p.createdBy ? ` by ${p.createdBy.name}` : ""}
            </span>
          </div>
        )}
      </header>

      <div className="mx-auto mt-6 max-w-5xl space-y-6 pb-16 sm:mt-8">
        {isLoading ? (
          <>
            <Skeleton className="h-[140px] w-full rounded-md" />
            <Skeleton className="h-[320px] w-full rounded-md" />
          </>
        ) : !p ? (
          <div className="rounded-md border bg-card p-12 text-center">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">Could not load this procurement</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error?.message || "It may have been deleted."}</p>
            <Link
              href="/procurement-register"
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back to procurements
            </Link>
          </div>
        ) : (
          <>
            <section className="rounded-md border bg-card px-5 py-6 sm:px-8">
              <StageTracker progress={p.progress} detail={trackerDetail(p)} />
            </section>

            {visibleStages(p.isAsset).map((stage, i) => {
              const ui = STAGE_UI[stage.key];
              const rows = stageRows(p, stage.key);
              const canAddMore = stage.multiple || rows.length === 0;
              const Icon = ui.icon;
              return (
                <section key={stage.key} className="rounded-md border bg-card">
                  <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
                    <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                    <Icon className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">{stage.label}</h2>
                    {stage.multiple && rows.length > 0 && (
                      <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                        {rows.length}
                      </span>
                    )}
                    {ui.note && (
                      <span className="text-[11px] text-muted-foreground">{ui.note}</span>
                    )}
                    {canUpdate && canAddMore && (
                      <div className="ml-auto flex items-center gap-2">
                        {perms[ui.createPerm] && (
                          <Link
                            href={ui.createHref(p.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted"
                          >
                            <Plus className="size-3.5" />
                            {ui.createLabel}
                          </Link>
                        )}
                        <LinkDocumentDialog
                          procurementId={p.id}
                          type={stage.key}
                          docLabel={stage.doc}
                          trigger={
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted"
                            >
                              <Link2 className="size-3.5" />
                              Link existing
                            </button>
                          }
                        />
                      </div>
                    )}
                  </header>
                  {rows.length === 0 ? (
                    <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5">
                      No {stage.doc.toLowerCase()} yet.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {rows.map((row) => (
                        <li key={row.id} className="flex min-w-0 items-center gap-3 px-4 py-3 sm:gap-5 sm:px-5">
                          <Link href={row.href} className="flex min-w-0 flex-1 items-center gap-3 sm:gap-5">
                            <span className="w-[110px] shrink-0 truncate font-mono text-sm font-medium sm:w-[150px]" title={row.num}>
                              {row.num}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm" dir="auto" title={row.text}>
                                {row.text || "—"}
                              </span>
                              {row.pill && <span className="mt-1 block">{row.pill}</span>}
                            </span>
                            {row.amount && (
                              <span className="hidden shrink-0 text-right font-mono text-sm tabular-nums sm:block">
                                {row.amount}
                              </span>
                            )}
                          </Link>
                          {canUpdate && (
                            <UnlinkButton procurementId={p.id} type={stage.key} docId={row.id} label={`${stage.doc} ${row.num}`} />
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}

            {!p.isAsset && canUpdate && (
              <p className="rounded-md border border-dashed px-4 py-3 text-xs text-muted-foreground sm:px-5">
                Buying an asset? Use <span className="font-medium text-foreground">Edit</span> to mark
                this as an asset purchase — that adds the asset creation and asset registration
                stages before payment.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// One line under each tracker step.
function trackerDetail(p: ProcurementSummary): Partial<Record<ProcurementStageKey, React.ReactNode>> {
  const posted = p.pvs.filter((pv) => pv.status === "POSTED").length;
  return {
    gsr: p.gsrForm ? `${p.gsrForm.gsrFormNum} · ${GSR_LABEL[p.gsrForm.status] ?? p.gsrForm.status}` : undefined,
    priceEvaluation: p.priceEvaluation
      ? `${p.priceEvaluation.evalNum} · ${PE_LABEL[p.priceEvaluation.status] ?? p.priceEvaluation.status}`
      : undefined,
    pv: p.pvs.length
      ? `${p.pvs.length} PV${p.pvs.length === 1 ? "" : "s"}${posted ? ` · ${posted} posted` : " · not posted yet"}`
      : undefined,
    assetCreation: p.assetCreations.length ? assetCreationDetail(p.assetCreations) : undefined,
    asset: p.assets.length ? `${p.assets.length} asset${p.assets.length === 1 ? "" : "s"}` : undefined,
  };
}

// "1506/2026/009–013 · Awaiting SAP update", or "2 sets · 1 completed".
function assetCreationDetail(sets: ProcurementSummary["assetCreations"]): string {
  if (sets.length === 1) {
    return `${sets[0].formRange} · ${AC_LABEL[sets[0].status] ?? sets[0].status}`;
  }
  const done = sets.filter((s) => s.status === "COMPLETED").length;
  return `${sets.length} sets · ${done} completed`;
}

type Row = { id: string; num: string; href: string; text: string; pill?: React.ReactNode; amount?: string };

function stageRows(p: ProcurementSummary, key: ProcurementStageKey): Row[] {
  switch (key) {
    case "gsr":
      return p.gsrForm
        ? [{
            id: p.gsrForm.id,
            num: p.gsrForm.gsrFormNum,
            href: `/gsr/${encodeURIComponent(p.gsrForm.gsrFormNum)}`,
            text: p.gsrForm.itemsSummary,
            pill: <GSRStatusPill status={p.gsrForm.status} />,
          }]
        : [];
    case "priceEvaluation":
      return p.priceEvaluation
        ? [{
            id: p.priceEvaluation.id,
            num: p.priceEvaluation.evalNum,
            href: `/price-evaluation/${encodeURIComponent(p.priceEvaluation.evalNum)}`,
            text: [p.priceEvaluation.itemsSummary, p.priceEvaluation.vendorName && `from ${p.priceEvaluation.vendorName}`]
              .filter(Boolean)
              .join(" · "),
            pill: <PriceEvalStatusPill status={p.priceEvaluation.status} />,
            amount: p.priceEvaluation.total != null ? `MVR ${money(p.priceEvaluation.total)}` : undefined,
          }]
        : [];
    case "pv":
      return p.pvs.map((pv) => ({
        id: pv.id,
        num: pv.pvNum,
        href: `/pv/${encodeURIComponent(pv.pvNum)}`,
        text: `${pv.vendor} · ${format(new Date(pv.date), "d MMM yyyy")}`,
        pill: <StatusPill status={pv.status} />,
        amount: pv.currency === "MVR" ? `MVR ${money(pv.total)}` : `${pv.currency} ${money(pv.total)}`,
      }));
    case "assetCreation":
      return p.assetCreations.map((ac) => ({
        id: ac.id,
        num: ac.formRange,
        href: `/asset-creation/${encodeURIComponent(ac.formNum)}`,
        text: [ac.description, ac.formCount > 1 && `${ac.formCount} forms`].filter(Boolean).join(" · "),
        pill: <AssetCreationStatusPill status={ac.status} />,
        amount: ac.totalValue != null ? `MVR ${money(ac.totalValue)}` : undefined,
      }));
    case "asset":
      return p.assets.map((a) => ({
        id: a.id,
        num: a.assetNum,
        href: `/asset/${encodeURIComponent(a.assetNum)}`,
        text: [a.assetName, a.presentLocation].filter(Boolean).join(" · "),
        amount: a.price != null ? `MVR ${money(a.price)}` : undefined,
      }));
  }
}

function UnlinkButton({
  procurementId,
  type,
  docId,
  label,
}: {
  procurementId: string;
  type: ProcurementStageKey;
  docId: string;
  label: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const unlinkMutation = useMutation(
    trpc.procurement.unlink.mutationOptions({
      onSuccess: () => {
        toast({ title: `${label} unlinked` });
        queryClient.invalidateQueries({ queryKey: trpc.procurement.getById.queryKey({ id: procurementId }) });
        queryClient.invalidateQueries({ queryKey: trpc.procurement.list.queryKey() });
      },
      onError: (err) => toast({ title: "Could not unlink", description: err.message }),
    }),
  );
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={`Unlink ${label}`}
          title="Unlink from this procurement"
          className={cn("shrink-0 rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-red-600")}
        >
          <Unlink className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Unlink {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            It&apos;s removed from this procurement only — the document itself isn&apos;t changed, and
            it can be linked again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => unlinkMutation.mutate({ type, docId })}>Unlink</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ProcurementDetailPage;
