"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  FileSpreadsheet,
  History,
  Pencil,
  Receipt,
  Trash2,
  Users,
  Wallet,
  XCircle,
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
import { useHasPermission } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { FiyesStatusPill } from "@/components/approval/StatusPill";
import { SignatoryCard } from "@/components/approval/SignatoryCard";
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
import { FiyesActionBar } from "@/components/approval/FiyesActionBar";
import { BulkDownloads, FormDownloads } from "@/components/fiyes/FormDownloads";
import { LinesCard, LinesTable, RowsCard, entriesSummary } from "@/components/fiyes/EntriesView";
import { formatNumberWithCommas } from "@/utils/helpers";
import {
  filledLines,
  formRows,
  formsFor,
  isLinesForm,
  isRowsForm,
  monthBounds,
  parsePeriod,
  periodLabel,
  type FiyesForm,
  type FiyesFormDef,
  type FiyesLinesForm,
} from "@/lib/fiyes";
import { formatDmy } from "@/lib/week";
import type { FiyesReturnDetail } from "@/components/fiyes/types";

const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";

const FiyesReturnPage = ({ params }: { params: Promise<{ period: string }> }) => {
  const { period } = use(params);
  const p = parsePeriod(period);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session } = useSession();
  const hasAccess = useHasPermission(PERMISSIONS.FIYES_READ);
  const canUpdate = useHasPermission(PERMISSIONS.FIYES_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.FIYES_EDIT_LOCKED);
  const canDelete = useHasPermission(PERMISSIONS.FIYES_DELETE);

  const { data: ret, isLoading, error } = useQuery({
    ...trpc.fiyes.getByPeriod.queryOptions({ period }),
    enabled: hasAccess && p !== null,
  });
  // A draft's figures are compared with the register as it stands now.
  const { data: balances } = useQuery({
    ...trpc.fiyes.pettyCashBalances.queryOptions({ year: p?.year ?? 2000, month: p?.month ?? 1 }),
    enabled: hasAccess && ret?.kind === "MONTHLY" && ret.status === "DRAFT",
  });

  const deleteMutation = useMutation(
    trpc.fiyes.delete.mutationOptions({
      onSuccess: () => {
        toast({ title: "Return deleted" });
        queryClient.invalidateQueries({ queryKey: trpc.fiyes.list.pathKey() });
        router.push("/fiyes-register");
      },
      onError: (err) => toast({ title: "Could not delete", description: err.message }),
    }),
  );

  if (!hasAccess) return <NoAccessCard />;

  const locked = ret ? ret.status !== "DRAFT" : false;
  const editAllowed = canUpdate && (!locked || canEditLocked);
  const wasRejected = ret?.status === "DRAFT" && ret.rejectedAt;
  const title = p ? periodLabel(p) : period;

  return (
    <div className="font-poppins h-full">
      <header className="border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/fiyes-register" className="transition hover:text-foreground">
              Fiyes
            </Link>
            <span>/</span>
            <span className="font-mono normal-case tracking-normal text-foreground">{period}</span>
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
            {editAllowed && ret && (
              <Link
                href={`/fiyes/edit/${period}`}
                title={locked ? "Override edit (sent return)" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted",
                  locked && "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300",
                )}
              >
                <Pencil className="size-4" />
                {locked ? "Override edit" : "Edit"}
              </Link>
            )}
            {canDelete && ret && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Delete return"
                    className="inline-flex h-9 items-center rounded-md border bg-background px-2.5 text-muted-foreground transition hover:bg-muted hover:text-red-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete the {title} return?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the return, its figures, payables and approval history. It can&apos;t be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ period })}
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

        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              {p?.kind === "YEARLY" ? "Year-end return" : "Monthly return"}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:mt-1 sm:text-3xl">{title}</h1>
          </div>
          {ret && <HeadlineFigure ret={ret} />}
        </div>

        {ret && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-4 sm:gap-x-5">
            <FiyesStatusPill status={ret.status} />
            <span className="tabular-nums text-foreground">Dated {format(new Date(ret.documentDate), "d MMM yyyy")}</span>
            <span>{formsFor(ret.kind).length} forms</span>
          </div>
        )}
      </header>

      <div className="mx-auto mt-6 grid max-w-6xl gap-4 pb-16 sm:mt-8 sm:gap-6 lg:grid-cols-3 lg:items-start">
        {isLoading ? (
          <>
            <Skeleton className="h-[320px] w-full rounded-md lg:col-span-2" />
            <Skeleton className="h-[320px] w-full rounded-md" />
          </>
        ) : !ret ? (
          <div className="rounded-md border bg-card p-12 text-center lg:col-span-3">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">No return for {title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error?.message || "It may have been deleted."}</p>
            <Link
              href="/fiyes-register"
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back to Fiyes
            </Link>
          </div>
        ) : (
          <>
            {wasRejected && (
              <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 lg:col-span-3 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <span className="font-medium">Rejected by {ret.rejectedBy?.name ?? "the approver"}</span> on{" "}
                  {format(new Date(ret.rejectedAt!), "d MMM yyyy")}
                  {ret.rejectionComment ? <> — “{ret.rejectionComment}”</> : null}. Make any changes, then sign and send it again.
                </div>
              </div>
            )}

            {session?.user?.id && (
              <div className="lg:col-span-3">
                <div className="overflow-hidden rounded-md border border-primary/20 bg-primary/5 [&:not(:has(button))]:hidden">
                  <div className="flex flex-wrap items-center gap-3 border-l-2 border-primary px-4 py-3 sm:flex-nowrap">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Next action</div>
                    <FiyesActionBar
                      period={ret.period}
                      status={ret.status}
                      currentUserId={session.user.id}
                      enteredById={ret.enteredById}
                      approvedById={ret.approvedById}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              <section className="rounded-md border bg-card">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 sm:px-5">
                  <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold">Forms</h2>
                    <p className="text-[11px] text-muted-foreground">Upload the Excel file · attach the PDF</p>
                  </div>
                  <BulkDownloads period={ret.period} forms={formsFor(ret.kind)} />
                </header>
                {ret.status !== "APPROVED" && (
                  <p className="border-b bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                    Not approved yet: these download as drafts, and each PDF shows a signature only once that person has signed.
                  </p>
                )}
                <ul className="divide-y">
                  {formsFor(ret.kind).map((form) => (
                    <li key={form.code} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                      <span className="w-[4.5rem] shrink-0 rounded border bg-background px-1.5 py-0.5 text-center font-mono text-[11px] tabular-nums">
                        {form.code.replace("-", " ")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{form.title.replace(/^F\d+ /, "")}</div>
                        <div className="truncate text-xs text-muted-foreground">{summary(form, ret)}</div>
                      </div>
                      <FormDownloads period={ret.period} form={form} />
                    </li>
                  ))}
                </ul>
              </section>

              {/* Each form's contents, in form order; nil forms are just listed above. */}
              {(formsFor(ret.kind) as FiyesFormDef[]).map((form) => {
                if (form.code === "F01" && isLinesForm(form)) {
                  return <PettyCashCard key={form.code} form={form} ret={ret} balances={balances} />;
                }
                if (form.code === "F19") return <PayablesCard key={form.code} ret={ret} />;
                if (isLinesForm(form) && filledLines(form, ret.entries).length > 0) {
                  return <LinesCard key={form.code} form={form} entries={ret.entries} />;
                }
                if (isRowsForm(form) && formRows(form, ret.entries).length > 0) {
                  return <RowsCard key={form.code} form={form} entries={ret.entries} />;
                }
                return null;
              })}
            </div>

            <aside className="lg:col-span-1">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Users className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Signatories</h2>
                </header>
                <div className="space-y-2 p-3">
                  <SignatoryCard label="1 · Entered by" staff={ret.enteredBy} signedAt={ret.status !== "DRAFT" ? ret.sentAt : null} />
                  <SignatoryCard
                    label="2 · Approved by"
                    staff={ret.approvedBy}
                    signedAt={ret.approvedAt}
                    rejectedAt={wasRejected ? ret.rejectedAt : null}
                    comment={wasRejected ? ret.rejectionComment : null}
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
              <ApprovalTimeline events={ret.approvalEvents} />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

/** What a form carries for this return, in a phrase. */
function summary(form: FiyesForm, ret: FiyesReturnDetail): string {
  const def: FiyesFormDef = form;
  if (def.code === "F01" && isLinesForm(def)) {
    if (ret.pettyCashOpening === null || ret.pettyCashClosing === null) return "Petty cash amounts not entered yet";
    const other = filledLines(def, ret.entries).length;
    return `Petty cash ${money(ret.pettyCashOpening)} → ${money(ret.pettyCashClosing)}${other ? `, plus other cash on ${other} ${other === 1 ? "line" : "lines"}` : ""}`;
  }
  if (def.code === "F19") {
    if (ret.payables.length === 0) return "Nil return (no payables)";
    const total = ret.payables.reduce((s, x) => s + x.amountMvr, 0);
    return `${ret.payables.length} ${ret.payables.length === 1 ? "payable" : "payables"}, MVR ${money(total)}`;
  }
  return entriesSummary(def, ret.entries);
}

function HeadlineFigure({ ret }: { ret: FiyesReturnDetail }) {
  const value =
    ret.kind === "MONTHLY"
      ? ret.pettyCashClosing
      : ret.payables.reduce((s, x) => s + x.amountMvr, 0);
  return (
    <div className="md:text-right">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {ret.kind === "MONTHLY" ? "Petty cash at month end" : "Payables at year end"}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
        <span className="mr-1.5 text-sm font-normal text-muted-foreground">MVR</span>
        {value === null ? "—" : money(value)}
      </div>
    </div>
  );
}

function PettyCashCard({
  form,
  ret,
  balances,
}: {
  form: FiyesLinesForm;
  ret: FiyesReturnDetail;
  balances: { opening: { balance: number }; closing: { balance: number } } | undefined;
}) {
  const { first, last } = monthBounds(ret.year, ret.month ?? 1);
  const differs =
    balances && (balances.opening.balance !== ret.pettyCashOpening || balances.closing.balance !== ret.pettyCashClosing);
  const other = filledLines(form, ret.entries);
  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Wallet className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{other.length ? "F01 Cash on Hand" : "F01 Cash on Hand · Petty cash"}</h2>
      </header>
      <dl className="grid grid-cols-2 divide-x">
        {(
          [
            [`As at ${formatDmy(first)}`, ret.pettyCashOpening],
            [`As at ${formatDmy(last)}`, ret.pettyCashClosing],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="px-4 py-4 sm:px-5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">{value === null ? "—" : money(value)}</dd>
          </div>
        ))}
      </dl>
      {balances && (
        <p
          className={cn(
            "flex items-start gap-2 border-t px-4 py-2.5 text-xs sm:px-5",
            differs ? "text-amber-800 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400",
          )}
        >
          {differs ? <AlertTriangle className="mt-px size-3.5 shrink-0" /> : <CheckCircle2 className="mt-px size-3.5 shrink-0" />}
          {differs
            ? `The petty cash register now gives ${money(balances.opening.balance)} and ${money(balances.closing.balance)}. Edit the return to use them.`
            : "Matches the petty cash register."}
        </p>
      )}
      {other.length > 0 && (
        <div className="overflow-x-auto border-t">
          <div className="px-4 pt-3 text-xs font-medium text-muted-foreground sm:px-5">Other cash on hand</div>
          <LinesTable form={form} entries={ret.entries} lines={other} bounds={{ first, last }} />
        </div>
      )}
    </section>
  );
}

function PayablesCard({ ret }: { ret: FiyesReturnDetail }) {
  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Receipt className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">F19 Payables</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">Unpaid at 31 December {ret.year}</span>
      </header>
      {ret.payables.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
          No payables. F19 goes out as a nil return.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 font-medium sm:px-5">Invoice</th>
                <th className="px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Vendor</th>
                <th className="px-2 py-2 font-medium">Details</th>
                <th className="px-2 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2 text-right font-medium sm:px-5">MVR</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ret.payables.map((x) => (
                <tr key={x.id}>
                  <td className="px-4 py-2 font-mono text-xs sm:px-5">{x.invoiceNumber}</td>
                  <td className="px-2 py-2 font-mono text-xs tabular-nums">{new Date(x.invoiceDate).toISOString().slice(0, 10)}</td>
                  <td className="px-2 py-2">
                    <div>{x.vendorName}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{x.vendorAccount}</div>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{x.details}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {x.currency !== "MVR" && <span className="mr-1 text-[10px] text-muted-foreground">{x.currency}</span>}
                    {money(x.amount)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums sm:px-5">{money(x.amountMvr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default FiyesReturnPage;
