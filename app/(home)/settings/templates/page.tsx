import React from "react";
import { LayoutTemplate } from "lucide-react";

const TemplatesPage = () => {
  return (
    <div className="font-poppins h-full">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Settings &middot; Templates
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Manage PV Templates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save and reuse common voucher layouts to speed up data entry.
          </p>
        </div>
      </header>

      {/* Empty state */}
      <div className="mt-6 rounded-md border bg-card p-12 text-center">
        <LayoutTemplate className="mx-auto size-10 text-muted-foreground/60" />
        <h2 className="mt-4 text-base font-semibold">Templates coming soon</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;ll be able to save a PV as a template and reuse its
          structure when creating future vouchers.
        </p>
      </div>
    </div>
  );
};

export default TemplatesPage;
