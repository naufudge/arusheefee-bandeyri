"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AssetCreationForm } from "@/components/asset-creation/AssetCreationForm";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { ProcurementContextBanner } from "@/components/procurement/ProcurementChip";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";

const CreateAssetCreationForm = ({
  searchParams,
}: {
  searchParams: Promise<{ procurementId?: string; from?: string }>;
}) => {
  // Opened from a procurement's "Create …" button, or "Duplicate" on a set.
  const { procurementId, from } = use(searchParams);
  const router = useRouter();
  const trpc = useTRPC();
  const hasAccess = useHasPermission(PERMISSIONS.ASSETCREATION_CREATE);

  const { data: source, isLoading } = useQuery({
    ...trpc.assetCreation.getByNum.queryOptions({ formNum: from ?? "" }),
    enabled: hasAccess && Boolean(from),
  });

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/asset-creation-register" className="transition hover:text-foreground">
              Register
            </Link>
            <span>/</span>
            <span>New</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">New Asset Creation Form</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {from
              ? `A copy of ${from} — new numbers, same details. Change what differs.`
              : "The SAP asset master data request: fill it in once, for as many forms as share the details."}
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

      <div className="mx-auto mt-8 max-w-6xl pb-16">
        <ProcurementContextBanner procurementId={procurementId} />
        {from && isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[160px] w-full rounded-md" />
            <Skeleton className="h-[360px] w-full rounded-md" />
          </div>
        ) : (
          // Remount once the source arrives so its details become the defaults.
          <AssetCreationForm key={source?.id ?? "new"} source={source} procurementId={procurementId} />
        )}
      </div>
    </div>
  );
};

export default CreateAssetCreationForm;
