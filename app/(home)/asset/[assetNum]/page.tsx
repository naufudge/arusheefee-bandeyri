"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronLeft,
  AlertCircle,
  Pencil,
  Trash2,
  Boxes,
  MapPin,
} from "lucide-react";
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
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { getCategoryNumber } from "@/lib/constants/assetCategories";
import { formatNumberWithCommas } from "@/utils/helpers";
import AssetQrCode from "@/components/asset/AssetQrCode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AssetRow = any;

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    value === "—";
  return (
    <div className="flex flex-col gap-0.5 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4 sm:px-5">
      <dt className="w-full text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:w-48 sm:flex-shrink-0">
        {label}
      </dt>
      <dd
        className={`min-w-0 flex-1 break-words text-sm ${
          mono ? "font-mono tabular-nums" : ""
        } ${empty ? "text-muted-foreground/60" : "text-foreground"}`}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function formatAcquired(asset: AssetRow): string {
  if (!asset.date) return "—";
  const d = new Date(asset.date);
  if (asset.datePrecision === "FULL") return format(d, "d MMM yyyy");
  return String(d.getUTCFullYear());
}

const AssetDetailPage = ({
  params,
}: {
  params: Promise<{ assetNum: string }>;
}) => {
  const { assetNum: raw } = use(params);
  const assetNum = decodeURIComponent(raw);
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hasAccess = useHasPermission(PERMISSIONS.ASSET_READ);
  const canUpdate = useHasPermission(PERMISSIONS.ASSET_UPDATE);
  const canDelete = useHasPermission(PERMISSIONS.ASSET_DELETE);

  const {
    data: asset,
    isLoading,
    error,
  } = useQuery({
    ...trpc.asset.getByNum.queryOptions({ assetNum }),
    enabled: hasAccess,
  });

  const deleteMutation = useMutation(
    trpc.asset.delete.mutationOptions({
      onSuccess: () => {
        toast({ title: "Success", description: "Asset deleted." });
        queryClient.invalidateQueries({ queryKey: trpc.asset.list.queryKey() });
        router.push("/asset-register");
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: err.message || "An unknown error occurred.",
        });
      },
    }),
  );

  if (!hasAccess) return <NoAccessCard />;

  const categoryNumber = asset?.category
    ? getCategoryNumber(asset.category)
    : undefined;
  const typeNumber = asset?.assetType
    ? getCategoryNumber(asset.assetType)
    : undefined;

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/asset-register"
              className="transition hover:text-foreground"
            >
              Register
            </Link>
            <span>/</span>
            <span>Detail</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">
              {assetNum}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={router.back}
              aria-label="Back"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            {asset && canUpdate && (
              <Link
                href={`/asset/edit/${encodeURIComponent(assetNum)}`}
                aria-label="Edit"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
              >
                <Pencil className="size-4" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            )}
            {asset && canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    aria-label="Delete"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:text-red-400"
                  >
                    <Trash2 className="size-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      asset <span className="font-mono">{assetNum}</span> from the
                      register.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate({ assetNum })}
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

        {/* Hero */}
        <div className="mt-3 sm:mt-4">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {asset ? (
              asset.assetName
            ) : (
              <Skeleton className="inline-block h-8 w-64" />
            )}
          </h1>
          {asset && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Boxes className="size-3.5" />
                {asset.category}
                <span className="text-muted-foreground/50">·</span>
                {asset.assetType}
              </span>
              {asset.condition && (
                <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-[10px] font-medium uppercase tracking-wide">
                  {asset.condition}
                </span>
              )}
              {asset.presentLocation && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {asset.presentLocation}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto mt-6 grid max-w-5xl gap-4 pb-16 sm:mt-8 sm:gap-6 lg:grid-cols-3 lg:items-start">
        {isLoading ? (
          <>
            <Skeleton className="h-[480px] w-full rounded-md lg:col-span-2" />
            <Skeleton className="h-[320px] w-full rounded-md" />
          </>
        ) : !asset ? (
          <div className="rounded-md border bg-card p-12 text-center lg:col-span-3">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              Could not load asset {assetNum}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message || "The asset may have been deleted or moved."}
            </p>
            <Link
              href="/asset-register"
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
              Back to register
            </Link>
          </div>
        ) : (
          <>
            {/* Details */}
            <section className="rounded-md border bg-card lg:col-span-2">
              <header className="border-b px-4 py-3 sm:px-5">
                <h2 className="text-sm font-semibold">Details</h2>
              </header>
              <dl>
                <DetailRow label="Asset Number" value={asset.assetNum} mono />
                <DetailRow label="SAP Asset No." value={asset.SAPassetNum} mono />
                <DetailRow label="Asset Name" value={asset.assetName} />
                <DetailRow label="Model Number" value={asset.modelNum} />
                <DetailRow label="Manufacturer ID" value={asset.manufacturerId} />
                <DetailRow
                  label="Classification"
                  value={asset.classification}
                  mono
                />
                <DetailRow
                  label="Category"
                  value={
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span>{asset.category}</span>
                      {categoryNumber !== undefined && (
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          #{categoryNumber}
                        </span>
                      )}
                    </span>
                  }
                />
                <DetailRow
                  label="Type"
                  value={
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span>{asset.assetType}</span>
                      {typeNumber !== undefined && (
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          #{typeNumber}
                        </span>
                      )}
                    </span>
                  }
                />
                <DetailRow
                  label="Previous Location"
                  value={asset.previousLocation}
                />
                <DetailRow
                  label="Present Location"
                  value={asset.presentLocation}
                />
                <DetailRow label="Acquired" value={formatAcquired(asset)} mono />
                <DetailRow
                  label="Price"
                  value={
                    asset.price != null
                      ? `MVR ${formatNumberWithCommas(asset.price)}`
                      : null
                  }
                  mono
                />
                <DetailRow label="Condition" value={asset.condition} />
              </dl>
            </section>

            {/* QR */}
            <aside className="lg:col-span-1">
              <AssetQrCode
                assetNum={asset.assetNum}
                assetName={asset.assetName}
              />
            </aside>
          </>
        )}
      </div>
    </div>
  );
};

export default AssetDetailPage;
