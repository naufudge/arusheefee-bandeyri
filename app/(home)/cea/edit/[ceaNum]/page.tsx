"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, Lock } from "lucide-react";
import { CeaForm } from "@/components/cea/CeaForm";
import { Skeleton } from "@/components/ui/skeleton";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { useTRPC } from "@/lib/trpc";

const EditCeaPage = ({ params }: { params: Promise<{ ceaNum: string }> }) => {
  const { ceaNum } = use(params);
  const decodedNum = decodeURIComponent(ceaNum);
  const router = useRouter();
  const trpc = useTRPC();
  const hasAccess = useHasPermission(PERMISSIONS.CEA_UPDATE);
  const canEditLocked = useHasPermission(PERMISSIONS.CEA_EDIT_LOCKED);

  const { data: cea, isLoading, error } = useQuery({
    ...trpc.cea.getByNum.queryOptions({ ceaNum: decodedNum }),
    enabled: hasAccess,
  });

  if (!hasAccess) return <NoAccessCard />;

  const lockedOut = cea && cea.status !== "DRAFT" && !canEditLocked;

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/cea-register" className="transition hover:text-foreground">
              Register
            </Link>
            <span>/</span>
            <span>Edit</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono normal-case tracking-normal text-foreground">{decodedNum}</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Edit CEA Form</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update the details and press <span className="font-medium text-foreground">Save changes</span>.
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
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[120px] w-full rounded-md" />
            <Skeleton className="h-[280px] w-full rounded-md" />
          </div>
        ) : lockedOut ? (
          <div className="mx-auto max-w-lg rounded-md border bg-card p-10 text-center">
            <Lock className="mx-auto size-9 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">This form has been signed</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reopen it to draft from its page to make changes.
            </p>
            <Link
              href={`/cea/${encodeURIComponent(decodedNum)}`}
              className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
            >
              Open form
            </Link>
          </div>
        ) : cea ? (
          <CeaForm cea={cea} />
        ) : (
          <div className="rounded-md border bg-card p-12 text-center">
            <AlertCircle className="mx-auto size-10 text-muted-foreground/60" />
            <h2 className="mt-4 text-base font-semibold">Could not load CEA form {decodedNum}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{error?.message || "It may have been deleted."}</p>
            <Link
              href="/cea-register"
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

export default EditCeaPage;
