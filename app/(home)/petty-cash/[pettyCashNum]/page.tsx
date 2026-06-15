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
  ShieldCheck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { PettyCashStatusPill } from "@/components/approval/StatusPill";
import { SignatoryCard } from "@/components/approval/SignatoryCard";
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
import { PCActionBar } from "@/components/approval/PCActionBar";
import { AttachmentSection } from "@/components/attachments/AttachmentSection";
import PettyCashDownloadPdf from "@/components/petty-cash/DownloadPdf";

type PCRole =
  | "handledBy"
  | "procurementApprovedBy"
  | "budgetCheckedBy"
  | "balanceHandedOverBy"
  | "balanceCollectedBy";

const PC_ROLES: { key: PCRole; label: string; showAmount: boolean }[] = [
  { key: "handledBy", label: "Funds Received By", showAmount: true },
  { key: "procurementApprovedBy", label: "Procurement Approval", showAmount: false },
  { key: "budgetCheckedBy", label: "Budget Verification", showAmount: false },
  { key: "balanceHandedOverBy", label: "Balance Returned By", showAmount: true },
  { key: "balanceCollectedBy", label: "Balance Received By", showAmount: true },
];

function formatMVR(amount: number | null | undefined) {
  if (amount == null) return null;
  return `MVR ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const PettyCashDetailPage = ({
  params,
}: {
  params: Promise<{ pettyCashNum: string }>;
}) => {
  const { pettyCashNum } = use(params);
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();
  const hasAccess = useHasPermission(PERMISSIONS.PETTYCASH_READ);
  const canUpdate = useHasPermission(PERMISSIONS.PETTYCASH_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.PETTYCASH_EDIT_LOCKED);
  // Attachment gates are independent of the petty cash's approval state.
  const canUploadAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_UPLOAD);
  const canDeleteAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_DELETE);

  const {
    data: pc,
    isLoading,
    error,
  } = useQuery({
    ...trpc.pettycash.getByNum.queryOptions({ pettyCashNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  // Approval rollup — used for the status pill and edit-lock decision.
  const assignedRoles = pc
    ? PC_ROLES.map(({ key }) => pc[key]).filter((r) => r !== null)
    : [];
  const approvedCount = assignedRoles.filter((r) => r!.isApproved).length;
  const totalAssigned = assignedRoles.length;
  const systemApproved = !!pc?.systemApproved;
  const allApproved =
    systemApproved || (totalAssigned === 5 && approvedCount === 5);
  // `allApproved` is the visual lock; `editAllowed` is the actual
  // enable bit (override holders can still edit a fully-approved record).
  const editAllowed = canUpdate && (!allApproved || canEditLocked);

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/petty-cash-register"
              className="transition hover:text-foreground"
            >
              Register
            </Link>
            <span>/</span>
            <span>Detail</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">
              {pettyCashNum}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              Petty Cash
            </h1>
            {pc && (
              <PettyCashStatusPill
                approvedCount={approvedCount}
                totalAssigned={totalAssigned}
                systemApproved={systemApproved}
              />
            )}
          </div>
          {pc && (
            <p className="mt-1 text-sm text-muted-foreground">
              {pc.sectionUnit} ·{" "}
              <span className="font-mono tabular-nums">
                {formatMVR(pc.totalRequiredAmount)}
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
                href={`/petty-cash/edit/${pettyCashNum}`}
                title={allApproved ? "Override edit (fully approved)" : undefined}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted ${
                  allApproved
                    ? "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300"
                    : ""
                }`}
              >
                <Pencil className="size-4" />
                {allApproved ? "Override edit" : "Edit"}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="Locked: fully approved"
                className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium text-muted-foreground"
              >
                <Lock className="size-4" />
                Edit
              </button>
            ))}
          {pc && <PettyCashDownloadPdf pettyCashNum={pettyCashNum} />}
        </div>
      </header>

      <div className="mx-auto mt-8 grid max-w-5xl gap-6 pb-16 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-[220px] w-full rounded-md lg:col-span-3" />
            <Skeleton className="h-[420px] w-full rounded-md lg:col-span-3" />
          </>
        ) : !pc ? (
          <div className="rounded-md border bg-card p-12 text-center lg:col-span-3">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              Could not load petty cash {pettyCashNum}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message ?? "The record may have been deleted or moved."}
            </p>
            <Link
              href="/petty-cash-register"
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back to register
            </Link>
          </div>
        ) : (
          <>
            {/* Petty cash details */}
            <section className="rounded-md border bg-card lg:col-span-3">
              <header className="flex items-center gap-2 border-b px-4 py-3">
                <FileText className="size-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Request</h2>
              </header>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Field label="PC #" value={pc.pettyCashNum} mono />
                <Field label="Form #" value={pc.formNum} mono />
                <Field
                  label="Date"
                  value={format(new Date(pc.date), "d MMM yyyy")}
                />
                <Field label="Section / Unit" value={pc.sectionUnit} />
                <Field label="GL code" value={pc.glCode.toString()} mono />
                <Field
                  label="Total required"
                  value={formatMVR(pc.totalRequiredAmount)!}
                  mono
                />
                <Field
                  label="Parked"
                  value={
                    pc.parkedDate
                      ? format(new Date(pc.parkedDate), "d MMM yyyy")
                      : "—"
                  }
                />
                <Field
                  label="Posting"
                  value={
                    pc.postingDate
                      ? format(new Date(pc.postingDate), "d MMM yyyy")
                      : "—"
                  }
                />
              </dl>
            </section>

            {/* Items */}
            <section className="rounded-md border bg-card lg:col-span-3">
              <header className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Items</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                  {pc.items.length}
                </span>
              </header>
              <ul className="divide-y">
                {pc.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="w-12 font-mono text-xs tabular-nums text-muted-foreground">
                      ×{item.qty}
                    </span>
                    <span className="flex-1">{item.name}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Signatories — 5 roles, with per-role action bars. System-
                approved imports have no signatories, so they show a single
                "System Approved" panel instead. */}
            <section className="space-y-3 lg:col-span-3">
              <h2 className="px-1 text-sm font-semibold">Approvals</h2>
              {systemApproved ? (
                <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/60 dark:bg-emerald-900/20">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      System Approved
                    </div>
                    <p className="mt-0.5 text-xs text-emerald-700/90 dark:text-emerald-300/80">
                      Approved by the system on import — no individual
                      signatories.
                    </p>
                  </div>
                </div>
              ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {PC_ROLES.map(({ key, label, showAmount }) => {
                  const row = pc[key];
                  const isAssignee =
                    row != null && row.staffId === session?.user?.id;
                  const canAct = isAssignee && !row.isApproved;
                  const amountText =
                    showAmount && row?.amount != null
                      ? ` · ${formatMVR(row.amount)}`
                      : "";
                  return (
                    <SignatoryCard
                      key={key}
                      label={`${label}${amountText}`}
                      staff={row?.staff ?? null}
                      signedAt={row?.isApproved ? row.approvedAt : null}
                      rejectedAt={
                        !row?.isApproved && row?.rejectedAt ? row.rejectedAt : null
                      }
                      comment={
                        !row?.isApproved && row?.rejectionComment
                          ? row.rejectionComment
                          : null
                      }
                      actions={
                        <PCActionBar
                          pettyCashNum={pc.pettyCashNum}
                          role={key}
                          visible={!!canAct}
                        />
                      }
                    />
                  );
                })}
              </div>
              )}
            </section>

            {/* Reference docs */}
            <div className="lg:col-span-3">
              <AttachmentSection
                referenceType="petty_cash"
                referenceId={pc.id}
                canAdd={canUploadAttachments}
                canDelete={canDeleteAttachments}
              />
            </div>

            {/* Timeline */}
            <section className="lg:col-span-3">
              <h2 className="mb-3 px-1 text-sm font-semibold">Approval timeline</h2>
              <ApprovalTimeline events={pc.approvalEvents} />
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

export default PettyCashDetailPage;
