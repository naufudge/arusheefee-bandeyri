"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, AlertCircle } from "lucide-react";
import PettyCashForm from "@/components/petty-cash/PettyCashForm";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

const PettyCashEditPage = ({
  params,
}: {
  params: Promise<{ pettyCashNum: string }>;
}) => {
  const { pettyCashNum } = use(params);
  const router = useRouter();
  const trpc = useTRPC();
  const hasAccess = useHasPermission(PERMISSIONS.PETTYCASH_UPDATE);

  const {
    data: record,
    isLoading,
    error,
  } = useQuery({
    ...trpc.pettycash.getByNum.queryOptions({ pettyCashNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/petty-cash-register"
              className="transition hover:text-foreground"
            >
              Register
            </Link>
            <span>/</span>
            <span>Edit</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">
              {pettyCashNum}
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Edit Petty Cash
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update the record and press{" "}
            <span className="font-medium text-foreground">Save changes</span>{" "}
            to commit.
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

      <div className="mx-auto mt-8 max-w-3xl pb-16">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[260px] w-full rounded-md" />
            <Skeleton className="h-[420px] w-full rounded-md" />
            <Skeleton className="h-[280px] w-full rounded-md" />
          </div>
        ) : record ? (
          <PettyCashForm pettyCash={record} />
        ) : (
          <div className="rounded-md border bg-card p-12 text-center">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              Could not load petty cash {pettyCashNum}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message ?? "The record may have been deleted or moved."}
            </p>
            <Link
              href="/petty-cash-register"
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

export default PettyCashEditPage;
