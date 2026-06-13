"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronLeft,
  AlertCircle,
  Pencil,
  Wallet,
  Users,
  History,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { PcReconStatusPill } from "@/components/approval/StatusPill";
import { SignatoryCard } from "@/components/approval/SignatoryCard";
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
import { PcReconActionBar } from "@/components/approval/PcReconActionBar";
import DownloadReconciliationPdf from "@/components/treasury/DownloadReconciliationPdf";
import { formatNumberWithCommas } from "@/utils/helpers";

const dhivehiStyle: React.CSSProperties = {
  fontFamily: "var(--font-faruma), sans-serif",
  direction: "rtl",
  textAlign: "right",
};

const ReconciliationDetailPage = ({
  params,
}: {
  params: Promise<{ reportNum: string }>;
}) => {
  const { reportNum } = use(params);
  const decodedNum = decodeURIComponent(reportNum);
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();
  const hasAccess = useHasPermission(PERMISSIONS.PCRECON_READ);
  const canUpdate = useHasPermission(PERMISSIONS.PCRECON_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.PCRECON_EDIT_LOCKED);

  const {
    data: recon,
    isLoading,
    error,
  } = useQuery({
    ...trpc.pcRecon.getByNum.queryOptions({ reportNum: decodedNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  const locked = recon ? recon.status !== "DRAFT" : false;
  const editAllowed = canUpdate && (!locked || canEditLocked);

  const breakdown = recon
    ? [
        ["Opening balance", recon.openingBalance],
        ["Cash in hand", recon.cashInHand],
        ["Re-deposit A/C 1155", recon.redepositAcc1155],
        ["Staff wages", recon.staffWages],
        ["Food & allowance", recon.foodAllowance],
        ["Held in cheque", recon.heldInCheque],
        ["Total payable", recon.totalPayable],
        ["Total", recon.total],
        ["Cash held", recon.cashHeld],
        ["Held in cheques", recon.chequeHeld],
      ]
    : [];

  return (
    <div className="font-poppins h-full">
      <header className="border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/pc-reconciliation-register"
              className="transition hover:text-foreground"
            >
              Register
            </Link>
            <span>/</span>
            <span>Detail</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">
              {decodedNum}
            </span>
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
            {editAllowed && (
              <Link
                href={`/pc-reconciliation/edit/${encodeURIComponent(decodedNum)}`}
                title={locked ? "Override edit (locked report)" : undefined}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted ${
                  locked
                    ? "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300"
                    : ""
                }`}
              >
                <Pencil className="size-4" />
                {locked ? "Override edit" : "Edit"}
              </Link>
            )}
            {recon && (
              <DownloadReconciliationPdf reportNum={decodedNum} withLabel />
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Reconciliation report
            </div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:mt-1 sm:text-3xl">
              {recon ? recon.reportNum : <Skeleton className="inline-block h-8 w-48" />}
            </h1>
          </div>
          {recon && (
            <div className="md:text-right">
              <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Period
              </div>
              <div className="mt-1 max-w-xs text-sm" style={dhivehiStyle}>
                {recon.periodText}
              </div>
            </div>
          )}
        </div>

        {recon && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-4 sm:gap-x-5">
            <PcReconStatusPill status={recon.status} />
            <span className="italic tabular-nums text-foreground">
              {format(new Date(recon.weekStart), "d MMM")} –{" "}
              {format(new Date(recon.weekEnd), "d MMM yyyy")}
            </span>
            <span className="tabular-nums">
              {recon.items.length} {recon.items.length === 1 ? "item" : "items"}
            </span>
          </div>
        )}
      </header>

      <div className="mx-auto mt-6 grid max-w-5xl gap-4 pb-16 sm:mt-8 sm:gap-6 lg:grid-cols-3 lg:items-start">
        {isLoading ? (
          <>
            <Skeleton className="h-[260px] w-full rounded-md lg:col-span-2" />
            <Skeleton className="h-[260px] w-full rounded-md" />
          </>
        ) : !recon ? (
          <div className="rounded-md border bg-card p-12 text-center lg:col-span-3">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              Could not load report {decodedNum}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message || "The report may have been deleted or moved."}
            </p>
            <Link
              href="/pc-reconciliation-register"
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back to register
            </Link>
          </div>
        ) : (
          <>
            {session?.user?.id && (
              <div className="lg:col-span-3">
                <div className="overflow-hidden rounded-md border border-primary/20 bg-primary/5 [&:not(:has(button))]:hidden">
                  <div className="flex flex-wrap items-center gap-3 border-l-2 border-primary px-4 py-3 sm:flex-nowrap">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                      Next action
                    </div>
                    <PcReconActionBar
                      reportNum={recon.reportNum}
                      status={recon.status}
                      currentUserId={session.user.id}
                      checkedById={recon.checkedById}
                      authorizedById={recon.authorizedById}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Left: transactions + breakdown */}
            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Wallet className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Transactions</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                    {recon.items.length}
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-right font-medium">
                          Details
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          Withdrawn
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {recon.items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-6 text-center text-xs text-muted-foreground"
                          >
                            No items snapshotted yet.
                          </td>
                        </tr>
                      ) : (
                        recon.items.map((it) => (
                          <tr key={it.id}>
                            <td className="px-4 py-2 tabular-nums">
                              {format(new Date(it.date), "dd.MM.yyyy")}
                            </td>
                            <td
                              className="px-4 py-2 text-right"
                              style={dhivehiStyle}
                            >
                              {it.details || it.detailsEn || "—"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono tabular-nums">
                              {formatNumberWithCommas(it.withdrawn)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-md border bg-card">
                <header className="border-b px-4 py-3 sm:px-5">
                  <h2 className="text-sm font-semibold">Cash Composition</h2>
                </header>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 p-4 sm:grid-cols-2 sm:px-5">
                  {breakdown.map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono tabular-nums">
                        {formatNumberWithCommas(value as number)}
                      </span>
                    </div>
                  ))}
                  <div className="col-span-1 mt-1 flex items-baseline justify-between gap-3 border-t pt-2 text-sm font-semibold sm:col-span-2">
                    <span>Grand total</span>
                    <span className="font-mono tabular-nums">
                      {formatNumberWithCommas(recon.cashHeld + recon.chequeHeld)}
                    </span>
                  </div>
                </div>
              </section>
            </div>

            {/* Right: signatories */}
            <aside className="lg:col-span-1">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Users className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Approvers</h2>
                </header>
                <div className="space-y-2 p-3">
                  <SignatoryCard
                    label="Prepared / In charge"
                    staff={recon.preparedBy}
                    signedAt={recon.status !== "DRAFT" ? recon.createdAt : null}
                  />
                  <SignatoryCard
                    label="Checked by"
                    staff={recon.checkedBy}
                    signedAt={recon.checkedAt}
                  />
                  <SignatoryCard
                    label="Authorized by"
                    staff={recon.authorizedBy}
                    signedAt={recon.authorizedAt}
                  />
                </div>
              </section>
            </aside>

            <section className="lg:col-span-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <History className="size-4 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Approval Timeline
                </h2>
              </div>
              <ApprovalTimeline events={recon.approvalEvents} />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default ReconciliationDetailPage;
