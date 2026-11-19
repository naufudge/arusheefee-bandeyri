"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { FiyesForm } from "@/components/fiyes/FiyesForm";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

const CreateFiyesPage = ({ searchParams }: { searchParams: Promise<{ period?: string }> }) => {
  // Opened from a calendar tile's "Start return".
  const { period } = use(searchParams);
  const router = useRouter();
  const hasAccess = useHasPermission(PERMISSIONS.FIYES_CREATE);

  if (!hasAccess) return <NoAccessCard />;

  return (
    <div className="font-poppins h-full">
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Link href="/fiyes-register" className="transition hover:text-foreground">
              Fiyes
            </Link>
            <span>/</span>
            <span>New</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">New Fiyes Return</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One return covers a month&apos;s (or a year&apos;s) set of Ministry of Finance forms. You
            sign it by sending it; the approver signs by approving it.
          </p>
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
        <FiyesForm initialPeriod={period} />
      </div>
    </div>
  );
};

export default CreateFiyesPage;
