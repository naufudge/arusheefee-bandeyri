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
  Package,
  Users,
  History,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { GSRStatusPill } from "@/components/approval/StatusPill";
import { SignatoryCard } from "@/components/approval/SignatoryCard";
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
import { GSRActionBar } from "@/components/approval/GSRActionBar";
import DownloadGsrPdf from "@/components/gsr/DownloadGsrPdf";

const dhivehiStyle: React.CSSProperties = {
  fontFamily: "var(--font-faruma), sans-serif",
  direction: "rtl",
  textAlign: "right",
};

const GsrDetailPage = ({
  params,
}: {
  params: Promise<{ gsrFormNum: string }>;
}) => {
  const { gsrFormNum } = use(params);
  const decodedNum = decodeURIComponent(gsrFormNum);
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();
  const hasAccess = useHasPermission(PERMISSIONS.GSR_READ);
  const canUpdate = useHasPermission(PERMISSIONS.GSR_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.GSR_EDIT_LOCKED);

  const {
    data: gsr,
    isLoading,
    error,
  } = useQuery({
    ...trpc.gsr.getByNum.queryOptions({ gsrFormNum: decodedNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  const locked = gsr ? gsr.status !== "DRAFT" : false;
  const editAllowed = canUpdate && (!locked || canEditLocked);

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/gsr-register"
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
                href={`/gsr/edit/${encodeURIComponent(decodedNum)}`}
                title={locked ? "Override edit (locked form)" : undefined}
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
            {gsr && <DownloadGsrPdf gsrFormNum={decodedNum} withLabel />}
          </div>
        </div>

        {/* Hero */}
        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Requisition form
            </div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:mt-1 sm:text-3xl">
              {gsr ? gsr.gsrFormNum : <Skeleton className="inline-block h-8 w-64" />}
            </h1>
          </div>
          {gsr && (
            <div className="md:text-right">
              <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Section
              </div>
              <div className="mt-1 max-w-xs text-sm" style={dhivehiStyle}>
                {gsr.section}
              </div>
            </div>
          )}
        </div>

        {/* Meta row */}
        {gsr && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-4 sm:gap-x-5">
            <GSRStatusPill status={gsr.status} />
            <span className="italic tabular-nums text-foreground">
              {format(new Date(gsr.date), "d MMM yyyy")}
            </span>
            <span className="tabular-nums">
              {gsr.items.length} {gsr.items.length === 1 ? "item" : "items"}
            </span>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="mx-auto mt-6 grid max-w-5xl gap-4 pb-16 sm:mt-8 sm:gap-6 lg:grid-cols-3 lg:items-start">
        {isLoading ? (
          <>
            <Skeleton className="h-[260px] w-full rounded-md lg:col-span-2" />
            <Skeleton className="h-[260px] w-full rounded-md" />
            <Skeleton className="h-[320px] w-full rounded-md lg:col-span-3" />
          </>
        ) : !gsr ? (
          <div className="rounded-md border bg-card p-12 text-center lg:col-span-3">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              Could not load GSR form {decodedNum}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message || "The form may have been deleted or moved."}
            </p>
            <Link
              href="/gsr-register"
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back to register
            </Link>
          </div>
        ) : (
          <>
            {/* Action bar */}
            {session?.user?.id && (
              <div className="lg:col-span-3">
                <div className="overflow-hidden rounded-md border border-primary/20 bg-primary/5 [&:not(:has(button))]:hidden">
                  <div className="flex flex-wrap items-center gap-3 border-l-2 border-primary px-4 py-3 sm:flex-nowrap">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                      Next action
                    </div>
                    <GSRActionBar
                      gsrFormNum={gsr.gsrFormNum}
                      status={gsr.status}
                      currentUserId={session.user.id}
                      authorizedById={gsr.authorizedById}
                      receivedById={gsr.receivedById}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Left column — line items */}
            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Package className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Requisition Items</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground tabular-nums">
                    {gsr.items.length}
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">
                          Particulars
                        </th>
                        <th className="px-3 py-2 text-right font-medium">Req.</th>
                        <th className="px-3 py-2 text-right font-medium">Iss.</th>
                        <th className="px-3 py-2 text-left font-medium">
                          Rqd. Date
                        </th>
                        <th className="px-4 py-2 text-right font-medium">
                          Remarks
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {gsr.items.map((item) => (
                        <tr key={item.id} className="align-top">
                          <td className="px-4 py-3">{item.particulars}</td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums">
                            {item.requestedQty}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">
                            {item.issuedQty ?? "—"}
                          </td>
                          <td className="px-3 py-3 tabular-nums text-muted-foreground">
                            {item.rqdDate
                              ? format(new Date(item.rqdDate), "d MMM yyyy")
                              : "—"}
                          </td>
                          <td
                            className="px-4 py-3 text-muted-foreground"
                            style={item.remarks ? dhivehiStyle : undefined}
                          >
                            {item.remarks || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Right column — signatories */}
            <aside className="lg:col-span-1">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Users className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Approvers</h2>
                </header>
                <div className="space-y-2 p-3">
                  <SignatoryCard
                    label="Requested by"
                    staff={gsr.requestedBy}
                    signedAt={gsr.status !== "DRAFT" ? gsr.createdAt : null}
                  />
                  <SignatoryCard
                    label="Authorized by"
                    staff={gsr.authorizedBy}
                    signedAt={gsr.authorizedAt}
                  />
                  <SignatoryCard
                    label="Form received by"
                    staff={gsr.receivedBy}
                    signedAt={gsr.receivedAt}
                  />
                </div>
              </section>
            </aside>

            {/* Timeline */}
            <section className="lg:col-span-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <History className="size-4 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Approval Timeline
                </h2>
              </div>
              <ApprovalTimeline events={gsr.approvalEvents} />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default GsrDetailPage;
