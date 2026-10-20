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
  Copy,
  FileStack,
  History,
  Layers,
  MapPin,
  Package,
  Pencil,
  ShoppingCart,
  TrendingDown,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { AssetCreationStatusPill } from "@/components/approval/StatusPill";
import { ProcurementChip } from "@/components/procurement/ProcurementChip";
import { SignatoryCard } from "@/components/approval/SignatoryCard";
import { ApprovalTimeline } from "@/components/approval/ApprovalTimeline";
import { AssetCreationActionBar } from "@/components/approval/AssetCreationActionBar";
import { DownloadAssetCreationPdf } from "@/components/asset-creation/DownloadAssetCreationPdf";
import { formatNumberWithCommas } from "@/utils/helpers";
import { AC_ROLES, formNumRange, perPiecePrice, requestTypeLabel } from "@/lib/asset-creation";
import { assetClassByCode } from "@/lib/asset-classes";

const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";

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

function Section({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside && <span className="ml-auto text-[11px] text-muted-foreground">{aside}</span>}
      </header>
      <dl className="divide-y px-4 py-1 sm:px-5">{children}</dl>
    </section>
  );
}

const AssetCreationDetailPage = ({ params }: { params: Promise<{ formNum: string }> }) => {
  const { formNum } = use(params);
  const decodedNum = decodeURIComponent(formNum);
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();
  const hasAccess = useHasPermission(PERMISSIONS.ASSETCREATION_READ);
  const canCreate = useHasPermission(PERMISSIONS.ASSETCREATION_CREATE);
  const canUpdate = useHasPermission(PERMISSIONS.ASSETCREATION_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.ASSETCREATION_EDIT_LOCKED);
  const canReadAssets = useHasPermission(PERMISSIONS.ASSET_READ);

  const { data: ac, isLoading, error } = useQuery({
    ...trpc.assetCreation.getByNum.queryOptions({ formNum: decodedNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  const locked = ac ? ac.status !== "DRAFT" : false;
  const editAllowed = canUpdate && (!locked || canEditLocked);
  const wasRejected = ac?.status === "DRAFT" && ac.rejectedAt;
  const formNums = ac?.forms.map((f) => f.formNum) ?? [];
  const assetClass = assetClassByCode(ac?.assetClass ?? ac?.requestedAssetClass);
  const registered = ac?.forms.reduce((n, f) => n + f.assets.length, 0) ?? 0;
  const lifeChanged =
    ac?.usefulLifeYears != null && assetClass && ac.usefulLifeYears !== assetClass.defaultLife;

  const signers = ac
    ? ([
        [ac.requestedBy, ac.sentAt],
        [ac.authorizedBy, ac.authorizedAt],
        [ac.sapUpdatedBy, ac.sapUpdatedAt],
      ] as const)
    : [];

  const acquired = ac?.acquisitionDate
    ? ac.acquisitionPrecision === "YEAR"
      ? String(new Date(ac.acquisitionDate).getUTCFullYear())
      : format(new Date(ac.acquisitionDate), "d MMM yyyy")
    : null;

  return (
    <div className="font-poppins h-full">
      <header className="border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/asset-creation-register" className="transition hover:text-foreground">
              Register
            </Link>
            <span>/</span>
            <span>Detail</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">{decodedNum}</span>
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
            {editAllowed && ac && (
              <Link
                href={`/asset-creation/edit/${encodeURIComponent(formNums[0])}`}
                title={locked ? "Override edit (sent set)" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted",
                  locked && "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-300",
                )}
              >
                <Pencil className="size-4" />
                {locked ? "Override edit" : "Edit"}
              </Link>
            )}
            {canCreate && ac && (
              <Link
                href={`/asset-creation/create?from=${encodeURIComponent(formNums[0])}${ac.procurement ? `&procurementId=${ac.procurement.id}` : ""}`}
                title="Start a new set with these details"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
              >
                <Copy className="size-4" />
                Duplicate
              </Link>
            )}
            {ac && <DownloadAssetCreationPdf formNum={formNums[0]} withLabel />}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Asset creation form{formNums.length > 1 ? `s · ${formNums.length}` : ""}
            </div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:mt-1 sm:text-3xl">
              {ac ? formNumRange(formNums) : <Skeleton className="inline-block h-8 w-48" />}
            </h1>
            {ac && <p className="mt-1 truncate text-sm text-muted-foreground">{ac.description1}</p>}
          </div>
          {ac && ac.originalValue != null && (
            <div className="md:text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Original value{formNums.length > 1 ? " · all forms" : ""}
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                <span className="mr-1.5 text-sm font-normal text-muted-foreground">MVR</span>
                {money(ac.originalValue * formNums.length)}
              </div>
            </div>
          )}
        </div>

        {ac && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:mt-4 sm:gap-x-5">
            <AssetCreationStatusPill status={ac.status} />
            <ProcurementChip procurement={ac.procurement} />
            <span className="rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em]">
              {requestTypeLabel(ac.requestType)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {ac.location}
            </span>
            <span className="tabular-nums">
              {ac.quantity} {ac.quantity === 1 ? "piece" : "pieces"} per form
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
        ) : !ac ? (
          <div className="rounded-md border bg-card p-12 text-center lg:col-span-3">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">Could not load asset creation form {decodedNum}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message || "It may have been deleted or renumbered."}
            </p>
            <Link
              href="/asset-creation-register"
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
                  <span className="font-medium">Rejected by {ac.rejectedBy?.name ?? "a signatory"}</span>{" "}
                  on {format(new Date(ac.rejectedAt!), "d MMM yyyy")}
                  {ac.rejectionComment ? <> — “{ac.rejectionComment}”</> : null}. Make any changes,
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
                    <AssetCreationActionBar
                      formNum={formNums[0]}
                      status={ac.status}
                      currentUserId={session.user.id}
                      requestedById={ac.requestedById}
                      authorizedById={ac.authorizedById}
                      sapUpdatedById={ac.sapUpdatedById}
                      sap={{
                        forms: ac.forms.map((f) => ({ id: f.id, formNum: f.formNum, sapAssetNum: f.sapAssetNum })),
                        assetClass: ac.assetClass ?? ac.requestedAssetClass,
                        registerEntries: ac.requestType === "CREATE" ? ac.forms.length * ac.quantity : 0,
                        originalValue: ac.originalValue,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              {/* Forms in the set */}
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <FileStack className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">
                    {formNums.length === 1 ? "Form" : `Forms in this set`}
                  </h2>
                  {registered > 0 && (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {registered} register {registered === 1 ? "entry" : "entries"}
                    </span>
                  )}
                </header>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:grid-cols-[150px_150px_minmax(0,1fr)] sm:px-5">
                  <span>Form no.</span>
                  <span>SAP asset no.</span>
                  <span className="hidden sm:block">Asset register</span>
                </div>
                <ul className="divide-y">
                  {ac.forms.map((f) => (
                    <li
                      key={f.id}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 px-4 py-2.5 text-sm sm:grid-cols-[150px_150px_minmax(0,1fr)] sm:px-5"
                    >
                      <span className="font-mono">{f.formNum}</span>
                      <span className={cn("font-mono", !f.sapAssetNum && "text-muted-foreground/60")}>
                        {f.sapAssetNum ?? "Not yet"}
                      </span>
                      <span className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-1">
                        {f.assets.length === 0 ? (
                          <span className="text-xs text-muted-foreground/60">
                            {ac.requestType === "CREATE" && ac.status !== "COMPLETED"
                              ? "Added when completed"
                              : "—"}
                          </span>
                        ) : (
                          f.assets.map((a) =>
                            canReadAssets ? (
                              <Link
                                key={a.id}
                                href={`/asset/${encodeURIComponent(a.assetNum)}`}
                                className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] transition hover:bg-muted"
                              >
                                {a.assetNum}
                              </Link>
                            ) : (
                              <span key={a.id} className="rounded border px-1.5 py-0.5 font-mono text-[11px]">
                                {a.assetNum}
                              </span>
                            ),
                          )
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <Section icon={Package} title="Asset general information">
                <Field label="Description 1">{ac.description1}</Field>
                <Field label="Description 2">{ac.description2}</Field>
                <Field label="Use of the asset">{ac.useOfAsset}</Field>
                <Field label="Location">{ac.location}</Field>
                <Field label="Quantity">{`${ac.quantity} per form`}</Field>
                <Field label="Requested asset class">
                  {ac.requestedAssetClass}
                  {assetClassByCode(ac.requestedAssetClass) && (
                    <span className="text-muted-foreground"> · {assetClassByCode(ac.requestedAssetClass)!.name}</span>
                  )}
                </Field>
                {ac.assetClass && ac.assetClass !== ac.requestedAssetClass && (
                  <Field label="Confirmed asset class">{ac.assetClass}</Field>
                )}
                <Field label="Requested GL code">
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-0.5 text-xs">
                    <Layers className="size-3 shrink-0 text-muted-foreground" />
                    <span className="shrink-0 font-mono tabular-nums">{ac.glAccount.code}</span>
                    <span className="min-w-0 text-muted-foreground">{ac.glAccount.longTextEn}</span>
                  </span>
                </Field>
              </Section>

              <Section icon={ShoppingCart} title="Asset origin information">
                <Field label="Vendor">{ac.vendor}</Field>
                <Field label="Manufacturer">{ac.manufacturer}</Field>
                <Field label="Purchased">{ac.purchasedNew ? "New" : "Used"}</Field>
                <Field label="Acquisition date">{acquired}</Field>
                <Field label="Use commence date">
                  {ac.commenceDate ? format(new Date(ac.commenceDate), "d MMM yyyy") : null}
                </Field>
                <Field label="Country of origin">{ac.countryOfOrigin}</Field>
                <Field label="Type / brand">{ac.brand}</Field>
                <Field label="Original value" mono>
                  {ac.originalValue != null ? (
                    <>
                      MVR {money(ac.originalValue)}
                      {ac.quantity > 1 && (
                        <span className="font-sans text-xs text-muted-foreground">
                          {" "}· MVR {money(perPiecePrice(ac.originalValue, ac.quantity)!)} each
                        </span>
                      )}
                    </>
                  ) : null}
                </Field>
              </Section>

              <Section
                icon={TrendingDown}
                title="Depreciation"
                aside={assetClass ? `Default for ${assetClass.code}: ${assetClass.defaultLife} years` : undefined}
              >
                <Field label="Useful life">
                  {ac.usefulLifeYears != null ? `${ac.usefulLifeYears} years` : null}
                </Field>
                {(lifeChanged || ac.usefulLifeReason) && <Field label="Reason">{ac.usefulLifeReason}</Field>}
              </Section>

              <Section icon={Layers} title="SAP coding">
                <Field label="Agency name">{ac.agencyName}</Field>
                <Field label="Business area" mono>{ac.businessArea}</Field>
                <Field label="Cost centre / WBS" mono>{ac.costCentre}</Field>
                <Field label="Fund" mono>{ac.fund}</Field>
                <Field label="Functional area" mono>{ac.functionalArea}</Field>
                {ac.requestType === "CREATE" && (
                  <Field label="Register category">
                    {[ac.registerCategory, ac.registerSubcategory, ac.registerAssetType]
                      .filter(Boolean)
                      .join(" › ") || null}
                  </Field>
                )}
              </Section>
            </div>

            <aside className="lg:col-span-1">
              <section className="rounded-md border bg-card">
                <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
                  <Users className="size-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Signatories</h2>
                </header>
                <div className="space-y-2 p-3">
                  {AC_ROLES.map((role, i) => {
                    const [staff, signedAt] = signers[i];
                    const rejectedHere = wasRejected && staff && ac.rejectedById === staff.id && i > 0;
                    return (
                      <SignatoryCard
                        key={role.key}
                        label={`${i + 1} · ${role.label}`}
                        staff={staff}
                        signedAt={signedAt}
                        rejectedAt={rejectedHere ? ac.rejectedAt : null}
                        comment={rejectedHere ? ac.rejectionComment : null}
                        actions={
                          staff ? (
                            <span className="text-[11px] text-muted-foreground">
                              ID card{" "}
                              {staff.idCardNo ? (
                                <span className="font-mono text-foreground">{staff.idCardNo}</span>
                              ) : (
                                "not set"
                              )}
                            </span>
                          ) : undefined
                        }
                      />
                    );
                  })}
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
              <ApprovalTimeline events={ac.approvalEvents} />
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default AssetCreationDetailPage;
