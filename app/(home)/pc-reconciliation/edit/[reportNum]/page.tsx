"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, AlertCircle } from "lucide-react";
import ReconciliationForm from "@/components/treasury/ReconciliationForm";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

const ReconciliationEditPage = ({
  params,
}: {
  params: Promise<{ reportNum: string }>;
}) => {
  const { reportNum } = use(params);
  const decodedNum = decodeURIComponent(reportNum);
  const router = useRouter();
  const trpc = useTRPC();
  const hasAccess = useHasPermission(PERMISSIONS.PCRECON_UPDATE);

  const {
    data: recon,
    isLoading,
    error,
  } = useQuery({
    ...trpc.pcRecon.getByNum.queryOptions({ reportNum: decodedNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/pc-reconciliation-register"
              className="transition hover:text-foreground"
            >
              Register
            </Link>
            <span>/</span>
            <span>Edit</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">
              {decodedNum}
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Edit Reconciliation Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update the figures and press{" "}
            <span className="font-medium text-foreground">Save changes</span> to
            commit.
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

      <div className="mx-auto mt-8 max-w-4xl pb-16">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full rounded-md" />
            <Skeleton className="h-[320px] w-full rounded-md" />
          </div>
        ) : recon ? (
          <ReconciliationForm recon={recon} />
        ) : (
          <div className="rounded-md border bg-card p-12 text-center">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              Could not load report {decodedNum}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message || "The report may have been deleted or moved."}
            </p>
            <Link
              href="/pc-reconciliation-register"
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

export default ReconciliationEditPage;
