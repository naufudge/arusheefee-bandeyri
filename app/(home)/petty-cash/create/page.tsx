"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import PettyCashForm from "@/components/petty-cash/PettyCashForm";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

const CreatePettyCashPage = () => {
  const router = useRouter();
  const hasAccess = useHasPermission(PERMISSIONS.PETTYCASH_CREATE);

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
            <span>New</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Create Petty Cash
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record a new petty cash request with items, GL code, and signatories.
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
        <PettyCashForm />
      </div>
    </div>
  );
};

export default CreatePettyCashPage;
