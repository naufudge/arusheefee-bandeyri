"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import PvForm from "@/components/pv/PvForm";
import { NoAccessCard } from "@/components/shared/PermissionGate";
import { useHasPermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

const CreatePV = () => {
  const router = useRouter();
  const hasAccess = useHasPermission(PERMISSIONS.PV_CREATE);

  if (!hasAccess) return <NoAccessCard />;

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
            <span>New</span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Create Payment Voucher
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record a new disbursement with invoice and GL distribution details.
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
        <PvForm />
      </div>
    </div>
  );
};

export default CreatePV;
