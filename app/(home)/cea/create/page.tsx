"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { CeaForm } from "@/components/cea/CeaForm";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { ProcurementContextBanner } from "@/components/procurement/ProcurementChip";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";

const CreateCeaPage = ({ searchParams }: { searchParams: Promise<{ procurementId?: string }> }) => {
  // Opened from a procurement's "Create CEA form" button.
  const { procurementId } = use(searchParams);
  const router = useRouter();
  const trpc = useTRPC();
  const hasAccess = useHasPermission(PERMISSIONS.CEA_CREATE);

  const fe = useQuery({ ...trpc.settings.ceaFe.queryOptions(), enabled: hasAccess });
  const live = useQuery({
    ...trpc.cea.liveSource.queryOptions({ procurementId: procurementId ?? "" }),
    enabled: hasAccess && Boolean(procurementId),
  });
  // The form builds its defaults once, so it waits for both.
  const ready = !fe.isLoading && (!procurementId || !live.isLoading);

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/cea-register" className="transition hover:text-foreground">
              Register
            </Link>
            <span>/</span>
            <span>New</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">New CEA Form</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approval to buy capital items not in the PSIP. You sign it here; the Financial
            Executive signs the printout.
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
        {!ready ? (
          <div className="space-y-4">
            <Skeleton className="h-[120px] w-full rounded-md" />
            <Skeleton className="h-[120px] w-full rounded-md" />
            <Skeleton className="h-[280px] w-full rounded-md" />
          </div>
        ) : (
          <CeaForm live={live.data ?? null} feDefaults={fe.data} procurementId={procurementId} />
        )}
      </div>
    </div>
  );
};

export default CreateCeaPage;
