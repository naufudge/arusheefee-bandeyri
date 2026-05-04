"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, AlertCircle } from "lucide-react";
import PvForm from "@/components/pv/PvForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

const PvEditPage = ({ params }: { params: Promise<{ pvNum: string }> }) => {
  const { pvNum } = use(params);
  const router = useRouter();
  const trpc = useTRPC();

  const {
    data: pvDetails,
    isLoading,
    error,
  } = useQuery(trpc.pv.getByNum.queryOptions({ pvNum }));

  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link
              href="/pv-register"
              className="transition hover:text-foreground"
            >
              Register
            </Link>
            <span>/</span>
            <span>Edit</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">
              {pvNum}
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Edit Payment Voucher
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update voucher details and press <span className="font-medium text-foreground">Save changes</span> to commit.
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
            <Skeleton className="h-[420px] w-full rounded-md" />
            <Skeleton className="h-[280px] w-full rounded-md" />
          </div>
        ) : pvDetails ? (
          <PvForm pv={pvDetails} />
        ) : (
          <div className="rounded-md border bg-card p-12 text-center">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">
              Could not load PV {pvNum}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message || "The voucher may have been deleted or moved."}
            </p>
            <Link
              href="/pv-register"
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

export default PvEditPage;
