"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  ChevronLeft,
  History,
  Landmark,
  Layers,
  Link2,
  ListOrdered,
  Pencil,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { CeaStatusPill } from "@/components/approval/StatusPill";
import { ProcurementChip } from "@/components/procurement/ProcurementChip";
import { SignatoryCard } from "@/components/approval/SignatoryCard";
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
import { CeaActionBar } from "@/components/approval/CeaActionBar";
import { DownloadCeaPdf } from "@/components/cea/DownloadCeaPdf";
import { ceaSignProblem } from "@/lib/cea";
import { formatNumberWithCommas } from "@/utils/helpers";

const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";
const DV = "font-faruma text-[15px] leading-7";

// A label/value line in the detail sections.
function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  const empty = children == null || children === "";
  return (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3 py-2 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words", mono && "font-mono tabular-nums", empty && "text-muted-foreground/60")}>
        {empty ? "—" : children}
      </dd>
    </div>
  );
}

const CeaDetailPage = ({ params }: { params: Promise<{ ceaNum: string }> }) => {
  const { ceaNum } = use(params);
  const decodedNum = decodeURIComponent(ceaNum);
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();
  const hasAccess = useHasPermission(PERMISSIONS.CEA_READ);
  const canUpdate = useHasPermission(PERMISSIONS.CEA_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.CEA_EDIT_LOCKED);

  const { data: cea, isLoading, error } = useQuery({
    ...trpc.cea.getByNum.queryOptions({ ceaNum: decodedNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  const r = cea?.resolved;
  const locked = cea ? cea.status !== "DRAFT" : false;
  const editAllowed = canUpdate && (!locked || canEditLocked);
  const firstItem = r?.rows.find((row) => row.description)?.description;

  return (
    <div className="font-poppins h-full">
      <header className="border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/cea-register" className="transition hover:text-foreground">
              Register
            </Link>
            <span>/</span>
            <span>Detail</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={router.back}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back
            </button>
            {editAllowed && cea && (
              <Link
                href={`/cea/edit/${encodeURIComponent(cea.ceaNum)}`}
                title={locked ? "Override edit (signed form)" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted",
                  locked && "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300",
                )}
              >
                <Pencil className="size-4" />
                {locked ? "Override edit" : "Edit"}
              </Link>
            )}
            {cea && <DownloadCeaPdf ceaNum={cea.ceaNum} withLabel />}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Capital expenditure authorization
            </div>
            <h1 className="break-all font-mono text-2xl font-semibold tracking-tight sm:mt-1 sm:text-3xl">
              {cea ? cea.ceaNum : <Skeleton className="inline-block h-8 w-64" />}
            </h1>
            {firstItem && (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                <span dir="rtl" className={DV}>{firstItem}</span>
                {r && r.rows.length > 1 ? ` + ${r.rows.length - 1} more` : ""}
              </p>
            )}
          </div>
          {r && r.total != null && (
            <div className="md:text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Estimated cost
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                <span className="mr-1.5 text-sm font-normal text-muted-foreground">MVR</span>
                {money(r.total)}
              </div>
            </div>
          )}
        </div>

        {cea && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-4 sm:gap-x-5">
            <CeaStatusPill status={cea.status} />
            <ProcurementChip procurement={cea.procurement} />
            <span className="tabular-nums">{format(new Date(cea.date), "d MMM yyyy")}</span>
            {r?.live && (
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="size-3.5" />
                Live from price evaluation <span className="font-mono text-foreground">{r.sourceEvalNum}</span>
              </span>
            )}
          </div>
        )}
      </header>

      <div className="mx-auto mt-6 grid max-w-6xl gap-4 pb-16 sm:mt-8 sm:gap-6 lg:grid-cols-3 lg:items-start">
        {isLoading ? (
          <>
            <Skeleton className="h-[320px] w-full rounded-md lg:col-span-2" />
            <Skeleton className="h-[320px] w-full rounded-md" />
          </>
        ) : !cea || !r ? (
          <div className="rounded-md border bg-card p-12 text-center lg:col-span-3">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">Could not load CEA form {decodedNum}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error?.message || "It may have been deleted."}</p>
            <Link
              href="/cea-register"
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
                    <CeaActionBar
                      ceaNum={cea.ceaNum}
                      status={cea.status}
                      currentUserId={session.user.id}
                      requestedById={cea.requestedById}
                      signProblem={ceaSignProblem(r)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              {r.live && (
                <div className="flex gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
                  <Link2 className="mt-0.5 size-4 shrink-0" />
                  <p>
                    While this form is a draft, its section, budget code, balance and each item&apos;s
                    quantity and cost follow price evaluation{" "}
                    <Link
                      href={`/price-evaluation/${encodeURIComponent(r.sourceEvalNum!)}`}
                      className="font-mono font-medium underline-offset-4 hover:underline"
                    >
                      {r.sourceEvalNum}
                    </Link>
                    . Signing freezes them on this form.
                  </p>
                </div>
              )}

              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <ListOrdered className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Items</h2>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {r.rows.length} {r.rows.length === 1 ? "row" : "rows"}
                  </span>
                </header>
                {r.rows.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">No items yet.</p>
                ) : (
                  <ol className="divide-y">
                    {r.rows.map((row, i) => (
                      <li key={i} className="px-4 py-3 sm:px-5">
                        <div className="flex items-start gap-3">
                          <span className="mt-1 font-mono text-xs text-muted-foreground">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                              <span dir="rtl" className={cn(DV, !row.description && "text-muted-foreground/60")}>
                                {row.description || "—"}
                              </span>
                              <span className="font-mono text-sm tabular-nums">
                                <span className="text-muted-foreground">{row.qty ?? "—"} ×</span>{" "}
                                {row.cost != null ? `MVR ${money(row.cost)}` : <span className="text-muted-foreground/60">no cost</span>}
                              </span>
                            </div>
                            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                              {(
                                [
                                  ["On hand", row.onHand],
                                  ["Acquired", row.acquired],
                                  ["Condition", row.condition],
                                ] as const
                              ).map(([label, value]) => (
                                <div key={label} className="flex items-baseline gap-2">
                                  <dt className="text-muted-foreground">{label}</dt>
                                  <dd dir="rtl" className="font-faruma text-[13px]">{value || "—"}</dd>
                                </div>
                              ))}
                            </dl>
                            {row.reason && (
                              <p dir="rtl" className="mt-2 rounded-md bg-muted/40 px-3 py-1.5 font-faruma text-[13px] leading-6">
                                {row.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Landmark className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Budget</h2>
                </header>
                <dl className="divide-y px-4 py-1 sm:px-5">
                  <Field label="Business area" mono>{cea.businessArea}</Field>
                  <Field label="Department / section">
                    {r.section && <span dir="rtl" className={DV}>{r.section}</span>}
                  </Field>
                  <Field label="Budget code">
                    {r.glAccount && (
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-xs">
                        <Layers className="size-3 shrink-0 text-muted-foreground" />
                        <span className="shrink-0 font-mono tabular-nums">{r.glAccount.code}</span>
                        <span className="min-w-0 text-muted-foreground">{r.glAccount.longTextEn}</span>
                      </span>
                    )}
                  </Field>
                  <Field label="Code balance" mono>
                    {r.budgetBalance != null ? `MVR ${money(r.budgetBalance)}` : null}
                  </Field>
                </dl>
              </section>
            </div>

            <aside className="lg:col-span-1">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Users className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Signatories</h2>
                </header>
                <div className="space-y-2 p-3">
                  <SignatoryCard label="Requested by" staff={cea.requestedBy} signedAt={cea.signedAt} />
                  <div className="rounded-md border px-3 py-2.5">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Financial Executive
                    </div>
                    {cea.feNameEn || cea.feNameDv ? (
                      <>
                        <div className="mt-1 text-sm font-medium">{cea.feNameEn || cea.feNameDv}</div>
                        <div className="text-xs text-muted-foreground">{cea.feDesignationEn || cea.feDesignationDv}</div>
                      </>
                    ) : (
                      <div className="mt-1 text-sm text-muted-foreground/60">Not set</div>
                    )}
                    <div className="mt-1.5 text-[11px] text-muted-foreground">Signs the printed form by hand.</div>
                  </div>
                </div>
              </section>
            </aside>

            <section className="lg:col-span-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <History className="size-4 text-muted-foreground" />
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Timeline
                </h2>
              </div>
              <ApprovalTimeline events={cea.approvalEvents} />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default CeaDetailPage;
