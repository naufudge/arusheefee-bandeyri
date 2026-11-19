"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Lock } from "lucide-react";
import { FiyesForm } from "@/components/fiyes/FiyesForm";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";
import { parsePeriod, returnTitle } from "@/lib/fiyes";

const EditFiyesPage = ({ params }: { params: Promise<{ period: string }> }) => {
  const { period } = use(params);
  const router = useRouter();
  const trpc = useTRPC();
  const canUpdate = useHasPermission(PERMISSIONS.FIYES_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.FIYES_EDIT_LOCKED);
  const p = parsePeriod(period);

  const { data: ret, isLoading, error } = useQuery({
    ...trpc.fiyes.getByPeriod.queryOptions({ period }),
    enabled: canUpdate && p !== null,
  });

  if (!canUpdate) return <NoAccessCard />;
  const locked = ret ? ret.status !== "DRAFT" : false;

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/fiyes-register" className="transition hover:text-foreground">
              Fiyes
            </Link>
            <span>/</span>
            <Link href={`/fiyes/${period}`} className="transition hover:text-foreground">
              {period}
            </Link>
            <span>/</span>
            <span>Edit</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {p ? `Edit ${returnTitle(p)}` : "Edit return"}
          </h1>
        </div>
        <button
          type="button"
          onClick={router.back}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted md:self-auto"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>
      </header>

      <div className="mx-auto mt-8 max-w-5xl pb-16">
        {isLoading ? (
          <Skeleton className="h-[420px] w-full rounded-md" />
        ) : !ret ? (
          <div className="rounded-md border bg-card p-12 text-center text-sm text-muted-foreground">
            {error?.message ?? "This return doesn't exist."}
          </div>
        ) : locked && !canEditLocked ? (
          <div className="rounded-md border bg-card p-12 text-center">
            <Lock className="mx-auto size-8 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">This return has been sent</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Call it back to draft before editing it.
            </p>
            <Link
              href={`/fiyes/${period}`}
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              Open the return
            </Link>
          </div>
        ) : (
          <>
            {locked && (
              <p className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                You&apos;re overriding the lock on a return that has been{" "}
                {ret.status === "APPROVED" ? "approved" : "sent for approval"}. Its signatures stay as they are.
              </p>
            )}
            <FiyesForm ret={ret} />
          </>
        )}
      </div>
    </div>
  );
};

export default EditFiyesPage;
