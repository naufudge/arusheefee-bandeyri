"use client";

import React, { use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  ChevronLeft,
  History,
  Layers,
  MessageSquareQuote,
  Pencil,
  Scale,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { PriceEvalStatusPill } from "@/components/approval/StatusPill";
import { ProcurementChip } from "@/components/procurement/ProcurementChip";
import { SignatoryCard } from "@/components/approval/SignatoryCard";
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
import { PriceEvalActionBar } from "@/components/approval/PriceEvalActionBar";
import { AttachmentSection } from "@/components/attachments/AttachmentSection";
import { ComparisonView } from "@/components/price-evaluation/ComparisonView";
import { DownloadPriceEvalPdf } from "@/components/price-evaluation/DownloadPriceEvalPdf";
import { formatNumberWithCommas } from "@/utils/helpers";
import { PE_ROLES, computeComparison } from "@/lib/price-eval";

const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";

const PriceEvaluationDetailPage = ({ params }: { params: Promise<{ evalNum: string }> }) => {
  const { evalNum } = use(params);
  const decodedNum = decodeURIComponent(evalNum);
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();
  const hasAccess = useHasPermission(PERMISSIONS.PRICEEVAL_READ);
  const canUpdate = useHasPermission(PERMISSIONS.PRICEEVAL_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.PRICEEVAL_EDIT_LOCKED);
  const canUploadAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_UPLOAD);
  const canDeleteAttachments = useHasPermission(PERMISSIONS.ATTACHMENT_DELETE);

  const { data: pe, isLoading, error } = useQuery({
    ...trpc.priceEval.getByNum.queryOptions({ evalNum: decodedNum }),
    enabled: hasAccess,
  });

  const comparison = useMemo(
    () => (pe ? computeComparison(pe.items, pe.vendors, pe.gstRate) : null),
    [pe],
  );

  if (!hasAccess) return <NoAccessCard />;

  const locked = pe ? pe.status !== "DRAFT" : false;
  const editAllowed = canUpdate && (!locked || canEditLocked);
  const chosen = pe?.selectedVendor ?? null;
  const chosenVendor = pe && chosen !== null ? pe.vendors[chosen] : null;
  const chosenTotal = comparison && chosen !== null ? comparison.vendors[chosen]?.total ?? null : null;
  const wasRejected = pe?.status === "DRAFT" && pe.rejectedAt;

  // Who signs, and when they did.
  const signers = pe
    ? ([
        [pe.preparedBy, pe.sentAt],
        [pe.budgetCheckedBy, pe.budgetCheckedAt],
        [pe.checkedBy, pe.checkedAt],
        [pe.approvedBy, pe.approvedAt],
      ] as const)
    : [];

  return (
    <div className="font-poppins h-full">
      <header className="border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/price-evaluation-register" className="transition hover:text-foreground">
              Register
            </Link>
            <span>/</span>
            <span>Detail</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">{decodedNum}</span>
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
            {editAllowed && pe && (
              <Link
                href={`/price-evaluation/edit/${encodeURIComponent(decodedNum)}`}
                title={locked ? "Override edit (sent evaluation)" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted",
                  locked && "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300",
                )}
              >
                <Pencil className="size-4" />
                {locked ? "Override edit" : "Edit"}
              </Link>
            )}
            {pe && <DownloadPriceEvalPdf evalNum={decodedNum} withLabel />}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Price evaluation
            </div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:mt-1 sm:text-3xl">
              {pe ? pe.evalNum : <Skeleton className="inline-block h-8 w-40" />}
            </h1>
          </div>
          {pe && (
            <div className="md:text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {chosenVendor ? `Buying from ${chosenVendor.name}` : "No vendor chosen yet"}
              </div>
              {chosenTotal !== null && (
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  <span className="mr-1.5 text-sm font-normal text-muted-foreground">MVR</span>
                  {money(chosenTotal)}
                </div>
              )}
            </div>
          )}
        </div>

        {pe && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-4 sm:gap-x-5">
            <PriceEvalStatusPill status={pe.status} />
            <ProcurementChip procurement={pe.procurement} />
            <span className="tabular-nums text-foreground">{format(new Date(pe.date), "d MMM yyyy")}</span>
            <span dir="rtl" className="font-faruma text-[13px] text-foreground">{pe.section}</span>
            <span className="tabular-nums">
              {pe.items.length} {pe.items.length === 1 ? "item" : "items"}
            </span>
          </div>
        )}
      </header>

      <div className="mx-auto mt-6 grid max-w-6xl gap-4 pb-16 sm:mt-8 sm:gap-6 lg:grid-cols-3 lg:items-start">
        {isLoading ? (
          <>
            <Skeleton className="h-[320px] w-full rounded-md lg:col-span-2" />
            <Skeleton className="h-[320px] w-full rounded-md" />
          </>
        ) : !pe || !comparison ? (
          <div className="rounded-md border bg-card p-12 text-center lg:col-span-3">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">Could not load evaluation {decodedNum}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message || "It may have been deleted or renumbered."}
            </p>
            <Link
              href="/price-evaluation-register"
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back to register
            </Link>
          </div>
        ) : (
          <>
            {wasRejected && (
              <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 lg:col-span-3 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <span className="font-medium">Rejected by {pe.rejectedBy?.name ?? "a signatory"}</span>{" "}
                  on {format(new Date(pe.rejectedAt!), "d MMM yyyy")}
                  {pe.rejectionComment ? <> — “{pe.rejectionComment}”</> : null}. Make any changes,
                  then sign and send it again.
                </div>
              </div>
            )}

            {session?.user?.id && (
              <div className="lg:col-span-3">
                <div className="overflow-hidden rounded-md border border-primary/20 bg-primary/5 [&:not(:has(button))]:hidden">
                  <div className="flex flex-wrap items-center gap-3 border-l-2 border-primary px-4 py-3 sm:flex-nowrap">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                      Next action
                    </div>
                    <PriceEvalActionBar
                      evalNum={pe.evalNum}
                      status={pe.status}
                      currentUserId={session.user.id}
                      preparedById={pe.preparedById}
                      budgetCheckedById={pe.budgetCheckedById}
                      checkedById={pe.checkedById}
                      approvedById={pe.approvedById}
                      budget={{
                        glLabel: `${pe.glAccount.code} · ${pe.glAccount.longTextEn}`,
                        balance: pe.budgetBalance,
                        needed: chosenTotal,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Left: comparison, budget, reason */}
            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Scale className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Quotes compared</h2>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    MVR · GST {pe.gstRate}% where charged
                  </span>
                </header>
                <ComparisonView
                  vendors={pe.vendors}
                  items={pe.items}
                  gstRate={pe.gstRate}
                  selectedVendor={pe.selectedVendor}
                />
              </section>

              <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
                <section className="rounded-md border bg-card">
                  <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                    <Wallet className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Budget</h2>
                    {pe.budgetCheckedAt && pe.budgetAvailable !== null && (
                      <span
                        className={cn(
                          "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          pe.budgetAvailable
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                        )}
                      >
                        {pe.budgetAvailable ? "Available" : "Not available"}
                      </span>
                    )}
                  </header>
                  <div className="space-y-3 px-4 py-4 sm:px-5">
                    <div className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
                      <Layers className="size-3 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 font-mono tabular-nums">{pe.glAccount.code}</span>
                      <span className="min-w-0 text-muted-foreground">{pe.glAccount.longTextEn}</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Code balance</span>
                      <span className="font-mono tabular-nums">
                        {pe.budgetBalance == null ? "—" : `MVR ${money(pe.budgetBalance)}`}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-md border bg-card">
                  <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                    <MessageSquareQuote className="size-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold">Reason for choosing</h2>
                  </header>
                  <div className="space-y-2 px-4 py-4 sm:px-5">
                    {pe.selectionReason ? (
                      <p dir="rtl" className="font-faruma text-[15px] leading-8">
                        {pe.selectionReason}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not given yet.</p>
                    )}
                    <p dir="rtl" className="font-faruma text-[12px] text-muted-foreground">
                      އަގުބެލި ގޮތް: {pe.method}
                    </p>
                  </div>
                </section>
              </div>
            </div>

            {/* Right: signatories */}
            <aside className="lg:col-span-1">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Users className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Signatories</h2>
                </header>
                <div className="space-y-2 p-3">
                  {PE_ROLES.map((role, i) => {
                    const [staff, signedAt] = signers[i];
                    const rejectedHere =
                      wasRejected && staff && pe.rejectedById === staff.id && i > 0;
                    return (
                      <SignatoryCard
                        key={role.key}
                        label={`${i + 1} · ${role.en}`}
                        staff={staff}
                        signedAt={signedAt}
                        rejectedAt={rejectedHere ? pe.rejectedAt : null}
                        comment={rejectedHere ? pe.rejectionComment : null}
                      />
                    );
                  })}
                </div>
              </section>
            </aside>

            <section className="lg:col-span-3">
              <AttachmentSection
                referenceType="price_evaluation"
                referenceId={pe.id}
                canAdd={canUploadAttachments}
                canDelete={canDeleteAttachments}
                embedViewer
                viewerClassName="h-[60vh]"
              />
            </section>

            <section className="lg:col-span-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <History className="size-4 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Approval Timeline
                </h2>
              </div>
              <ApprovalTimeline events={pe.approvalEvents} />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default PriceEvaluationDetailPage;
