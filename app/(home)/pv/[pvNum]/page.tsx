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
  Lock,
  FileText,
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
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
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
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              Payment Voucher
            </h1>
            {pv && <StatusPill status={pv.status} />}
          </div>
          {pv && (
            <p className="mt-1 text-sm text-muted-foreground">
              {pv.vendor} ·{" "}
              <span className="font-mono tabular-nums">
                {formatCurrency(totalAmount, pv.currency)}
              </span>
            </p>
          )}
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
          {canUpdate &&
            (editAllowed ? (
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
            ) : (
              <button
                type="button"
                disabled
                title="PV is locked: not in DRAFT"
                className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium text-muted-foreground"
              >
                <Lock className="size-4" />
                Edit
              </button>
            ))}
          {pv && <DownloadPdf pvNum={pvNum} />}
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto mt-8 grid max-w-5xl gap-6 pb-16 lg:grid-cols-3">
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
            {/* Action bar (gated by status + assignee) — appears above the rest. */}
            <div className="lg:col-span-3">
              {session?.user?.id && (
                <PVActionBar
                  pvNum={pv.pvNum}
                  status={pv.status}
                  currentUserId={session.user.id}
                  verifiedById={pv.verifiedById}
                  authorisedByOneId={pv.authorisedByOneId}
                  authorisedByTwoId={pv.authorisedByTwoId}
                />
              )}
            </div>

            {/* Voucher details */}
            <section className="rounded-md border bg-card lg:col-span-2">
              <header className="flex items-center gap-2 border-b px-4 py-3">
                <FileText className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Voucher</h2>
              </header>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-3">
                <Field label="PV #" value={pv.pvNum} mono />
                <Field label="Date" value={format(new Date(pv.date), "d MMM yyyy")} />
                <Field label="Vendor" value={pv.vendor} />
                <Field label="Currency" value={pv.currency} />
                <Field
                  label="Exchange rate"
                  value={pv.exchangeRate.toString()}
                  mono
                />
                <Field
                  label="Total"
                  value={formatCurrency(totalAmount, pv.currency)}
                  mono
                />
                <Field label="Payment method" value={pv.paymentMethod} />
                <Field label="PO #" value={pv.poNum ?? "—"} mono />
                <Field
                  label="Transfer #"
                  value={pv.transferNum ?? "—"}
                  mono
                />
                <Field
                  label="Parked date"
                  value={
                    pv.parkedDate
                      ? format(new Date(pv.parkedDate), "d MMM yyyy")
                      : "—"
                  }
                />
                <Field
                  label="Posting date"
                  value={
                    pv.postingDate
                      ? format(new Date(pv.postingDate), "d MMM yyyy")
                      : "—"
                  }
                />
                <Field
                  label="Clearing doc"
                  value={pv.clearingDocNum ?? "—"}
                  mono
                />
                <div className="col-span-2 sm:col-span-3">
                  <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Notes
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm">{pv.notes}</dd>
                </div>
              </dl>
            </section>

            {/* Signatories */}
            <section className="space-y-3 lg:col-span-1">
              <h2 className="px-1 text-sm font-semibold">Signatories</h2>
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
            </section>

            {/* Invoices */}
            <section className="rounded-md border bg-card lg:col-span-3">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Invoices</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                  {pv.invoices.length}
                </span>
              </header>
              <div className="divide-y">
                {pv.invoices.map((inv, i) => (
                  <div key={inv.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-medium">
                        Invoice #{i + 1}
                        {inv.invoiceNumber ? (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {inv.invoiceNumber}
                          </span>
                        ) : null}
                      </div>
                      <div className="font-mono text-sm tabular-nums">
                        {formatCurrency(inv.invoiceTotal, pv.currency)}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {inv.comments}
                      {inv.invoiceDate ? (
                        <> · {format(new Date(inv.invoiceDate), "d MMM yyyy")}</>
                      ) : null}
                    </p>
                    {inv.glDetails.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                        {inv.glDetails.map((gl) => (
                          <li key={gl.id} className="flex justify-between">
                            <span>
                              <span className="font-mono">{gl.code}</span> · {gl.fund}
                            </span>
                            <span className="font-mono tabular-nums">
                              {formatCurrency(gl.amount, pv.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Reference docs */}
            <div className="lg:col-span-3">
              <AttachmentSection
                referenceType="pv"
                referenceId={pv.id}
                canAdd={canUploadAttachments}
                canDelete={canDeleteAttachments}
              />
            </div>

            {/* Timeline */}
            <section className="lg:col-span-3">
              <h2 className="mb-3 px-1 text-sm font-semibold">Approval timeline</h2>
              <ApprovalTimeline events={pv.approvalEvents} />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm ${mono ? "font-mono tabular-nums" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

export default PvDetailPage;
