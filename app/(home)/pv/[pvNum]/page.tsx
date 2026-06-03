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
  Receipt,
  Users,
  History,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { StatusPill } from "@/components/approval/StatusPill";
import { SignatoryCard } from "@/components/approval/SignatoryCard";
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
import { PVActionBar } from "@/components/approval/PVActionBar";
import { AttachmentSection } from "@/components/attachments/AttachmentSection";
import DownloadPdf from "@/components/pv/DownloadPdf";
import VoucherCard from "@/components/pv/VoucherCard";

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const PvDetailPage = ({ params }: { params: Promise<{ pvNum: string }> }) => {
  const { pvNum } = use(params);
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();
  const hasAccess = useHasPermission(PERMISSIONS.PV_READ);
  const canUpdate = useHasPermission(PERMISSIONS.PV_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.PV_EDIT_LOCKED);
  // Attachment gates are independent of the PV's status now.
  const canUploadAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_UPLOAD);
  const canDeleteAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_DELETE);

  const {
    data: pv,
    isLoading,
    error,
  } = useQuery({
    ...trpc.pv.getByNum.queryOptions({ pvNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  const totalAmount = pv?.invoices.reduce((sum, inv) => sum + inv.invoiceTotal, 0) ?? 0;
  // `locked` controls the visual; `editAllowed` controls whether the
  // Edit button is actually enabled (override holders see a different
  // button label so it's clear they're bypassing the workflow).
  const locked = pv ? pv.status !== "DRAFT" : false;
  const editAllowed = canUpdate && (!locked || canEditLocked);

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="border-b pb-6">
        {/* Top row: breadcrumb + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/pv-register"
              className="transition hover:text-foreground"
            >
              Register
            </Link>
            <span>/</span>
            <span>Detail</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">
              {pvNum}
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
            {/* Edit / Override edit — only shown when editing is actually
                allowed. Users without the override permission see no button
                at all on a locked PV (rather than a disabled lock icon). */}
            {editAllowed && (
              <Link
                href={`/edit/${pvNum}`}
                title={locked ? "Override edit (locked PV)" : undefined}
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
            {pv && <DownloadPdf pvNum={pvNum} />}
          </div>
        </div>

        {/* Hero: vendor (h1) + total */}
        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Payment to
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:mt-1 sm:text-3xl">
              {pv ? pv.vendor : <Skeleton className="inline-block h-8 w-64" />}
            </h1>
          </div>
          {pv && (
            <div className="md:text-right">
              <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Total
              </div>
              <div className="flex items-baseline gap-1.5 sm:mt-1 md:justify-end">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground sm:text-sm">
                  {pv.currency}
                </span>
                <span className="font-mono text-3xl font-semibold tabular-nums leading-none sm:text-4xl">
                  {totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Meta row */}
        {pv && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-4 sm:gap-x-5">
            <StatusPill status={pv.status} />
            <span className="italic tabular-nums text-foreground">
              {format(new Date(pv.date), "d MMM yyyy")}
            </span>
            {pv.exchangeRate !== 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                  FX
                </span>
                <span className="font-mono tabular-nums text-foreground">
                  1 {pv.currency} ≈ {pv.exchangeRate} MVR
                </span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Body */}
      <div className="mx-auto mt-6 grid max-w-5xl gap-4 pb-16 sm:mt-8 sm:gap-6 lg:grid-cols-3 lg:items-start">
        {isLoading ? (
          <>
            <Skeleton className="h-[260px] w-full rounded-md lg:col-span-2" />
            <Skeleton className="h-[260px] w-full rounded-md" />
            <Skeleton className="h-[420px] w-full rounded-md lg:col-span-3" />
          </>
        ) : !pv ? (
          <div className="rounded-md border bg-card p-12 text-center lg:col-span-3">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              Could not load PV {pvNum}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message || "The voucher may have been deleted or moved."}
            </p>
            <Link
              href="/pv-register"
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back to register
            </Link>
          </div>
        ) : (
          <>
            {/* Action bar — only renders something when the current user has
                actions available. Framed as a "next action" strip with a
                left accent stripe so it reads as a call-to-action. */}
            {session?.user?.id && (
              <div className="lg:col-span-3">
                <div className="overflow-hidden rounded-md border border-primary/20 bg-primary/5 [&:not(:has(button))]:hidden">
                  <div className="flex flex-wrap items-center gap-3 border-l-2 border-primary px-4 py-3 sm:flex-nowrap">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                      Next action
                    </div>
                    <PVActionBar
                      pvNum={pv.pvNum}
                      status={pv.status}
                      currentUserId={session.user.id}
                      verifiedById={pv.verifiedById}
                      authorisedByOneId={pv.authorisedByOneId}
                      authorisedByTwoId={pv.authorisedByTwoId}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Left column — primary content */}
            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              <VoucherCard pv={pv} />

              {/* Invoices */}
              <section className="rounded-md border bg-card">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Invoices</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                      {pv.invoices.length}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Total
                    </span>
                    <span className="font-mono text-sm tabular-nums">
                      {formatCurrency(totalAmount, pv.currency)}
                    </span>
                  </div>
                </header>
                <div className="divide-y">
                  {pv.invoices.map((inv, i) => (
                    <div key={inv.id} className="px-4 py-4 text-sm sm:px-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-semibold">Invoice {i + 1}</span>
                          {inv.invoiceNumber && (
                            <span className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {inv.invoiceNumber}
                            </span>
                          )}
                          {inv.invoiceDate && (
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {format(new Date(inv.invoiceDate), "d MMM yyyy")}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-sm font-semibold tabular-nums">
                          {formatCurrency(inv.invoiceTotal, pv.currency)}
                        </div>
                      </div>
                      {inv.comments && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {inv.comments}
                        </p>
                      )}
                      {inv.glDetails.length > 0 && (
                        <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2">
                          <ul className="space-y-1 text-[11px]">
                            {inv.glDetails.map((gl) => (
                              <li
                                key={gl.id}
                                className="flex items-baseline justify-between gap-3"
                              >
                                <span className="flex items-baseline gap-2 truncate">
                                  <span className="font-mono text-foreground/80">
                                    {gl.code}
                                  </span>
                                  <span className="truncate text-muted-foreground">
                                    {gl.fund}
                                  </span>
                                </span>
                                <span className="font-mono tabular-nums text-foreground/80">
                                  {formatCurrency(gl.amount, pv.currency)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right column — workflow / signatories */}
            <aside className="lg:col-span-1">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Users className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Signatories</h2>
                </header>
                <div className="space-y-2 p-3">
                  <SignatoryCard
                    label="Prepared by"
                    staff={pv.preparedBy}
                    signedAt={pv.status !== "DRAFT" ? pv.createdAt : null}
                  />
                  <SignatoryCard
                    label="Verified by"
                    staff={pv.verifiedBy}
                    signedAt={pv.verifiedAt}
                  />
                  <SignatoryCard
                    label="Authorised by (1)"
                    staff={pv.authorisedByOne}
                    signedAt={pv.authorisedByOneAt}
                  />
                  <SignatoryCard
                    label="Authorised by (2)"
                    staff={pv.authorisedByTwo}
                    signedAt={pv.authorisedByTwoAt}
                  />
                </div>
              </section>
            </aside>

            {/* Reference docs — clip the embedded viewer so it doesn't
                dominate the page. The inner iframe defaults to 75vh; the
                outer wrapper caps that at ~55vh while still scrolling
                cleanly. */}
            <div className="lg:col-span-3">
              <div className="[&_div:has(>iframe)]:!h-[55vh] sm:[&_div:has(>iframe)]:!h-[70vh]">
                <AttachmentSection
                  referenceType="pv"
                  referenceId={pv.id}
                  canAdd={editAllowed && canUploadAttachments}
                  canDelete={editAllowed && canDeleteAttachments}
                  embedViewer
                />
              </div>
            </div>

            {/* Timeline */}
            <section className="lg:col-span-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <History className="size-4 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Approval Timeline
                </h2>
              </div>
              <ApprovalTimeline events={pv.approvalEvents} />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default PvDetailPage;
