"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, AlertCircle } from "lucide-react";
import AssetForm from "@/components/asset/AssetForm";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

const AssetEditPage = ({
  params,
}: {
  params: Promise<{ assetNum: string }>;
}) => {
  const { assetNum: raw } = use(params);
  const assetNum = decodeURIComponent(raw);
  const router = useRouter();
  const trpc = useTRPC();
  const hasAccess = useHasPermission(PERMISSIONS.ASSET_UPDATE);

  const {
    data: asset,
    isLoading,
    error,
  } = useQuery({
    ...trpc.asset.getByNum.queryOptions({ assetNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/asset-register"
              className="transition hover:text-foreground"
            >
              Register
            </Link>
            <span>/</span>
            <span>Edit</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">
              {assetNum}
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Edit Asset
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update the asset&apos;s details and press{" "}
            <span className="font-medium text-foreground">Save changes</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={router.back}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
            Back
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto mt-8 max-w-3xl pb-16">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[260px] w-full rounded-md" />
            <Skeleton className="h-[200px] w-full rounded-md" />
            <Skeleton className="h-[280px] w-full rounded-md" />
          </div>
        ) : asset ? (
          <AssetForm asset={asset} />
        ) : (
          <div className="rounded-md border bg-card p-12 text-center">
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
        )}
      </div>
    </div>
  );
};

export default AssetEditPage;
