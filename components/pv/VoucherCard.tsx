import React from "react";
import { format } from "date-fns";
import { FileText, Hash, Banknote, ArrowRightLeft } from "lucide-react";
import { Eyebrow, Chip, LifecycleStep } from "@/components/shared/detail-card";

interface PvLike {
  pvNum: string;
  date: Date | string;
  paymentMethod: string;
  poNum: string | null;
  transferNum: string | null;
  parkedDate: Date | string | null;
  postingDate: Date | string | null;
  clearingDocNum: string | null;
  notes: string | null;
}

interface Props {
  pv: PvLike;
}

const formatDate = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "d MMM yyyy") : null;

const VoucherCard: React.FC<Props> = ({ pv }) => {
  const hasRouting = !!pv.poNum || !!pv.transferNum;
  const trimmedNotes = pv.notes?.trim() ?? "";
  const showNotes = trimmedNotes.length > 0;

  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <FileText className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Voucher</h2>
      </header>

      {/* Hero strip: PV# + date | payment method chip */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <Eyebrow>PV Number</Eyebrow>
          <div className="mt-0.5 font-mono text-sm font-medium tabular-nums">
            {pv.pvNum}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {format(new Date(pv.date), "d MMM yyyy")}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end">
          <Eyebrow>Payment Method</Eyebrow>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 font-mono text-xs">
            <Banknote className="size-3 text-muted-foreground" />
            {pv.paymentMethod}
          </div>
        </div>
      </div>

      {/* Payment routing */}
      <div className="border-t mt-5 px-4 py-4 sm:px-5">
        <Eyebrow>Payment Routing</Eyebrow>
        <div className="mt-2">
          {hasRouting ? (
            <div className="flex flex-wrap gap-2">
              {pv.poNum && (
                <Chip
                  icon={<Hash className="size-3" />}
                  label="PO"
                  value={pv.poNum}
                  mono
                />
              )}
              {pv.transferNum && (
                <Chip
                  icon={<ArrowRightLeft className="size-3" />}
                  label="Transfer"
                  value={pv.transferNum}
                  mono
                />
              )}
            </div>
          ) : (
            <div className="text-xs italic text-muted-foreground/70">
              No routing documents yet.
            </div>
          )}
        </div>
      </div>

      {/* ERP lifecycle */}
      <div className="border-t px-4 py-4 sm:px-5">
        <Eyebrow>ERP Lifecycle</Eyebrow>
        <div className="mt-3 flex items-start">
          <LifecycleStep
            label="Parked"
            value={formatDate(pv.parkedDate)}
            isFirst
          />
          <LifecycleStep
            label="Posted"
            value={formatDate(pv.postingDate)}
          />
          <LifecycleStep
            label="Cleared"
            value={pv.clearingDocNum}
            isLast
          />
        </div>
      </div>

      {/* Notes — only when present */}
      {showNotes && (
        <div className="border-t px-4 py-4 sm:px-5">
          <Eyebrow>Notes</Eyebrow>
          <div className="mt-2 border-l-2 border-muted-foreground/40 pl-3">
            <p className="whitespace-pre-wrap text-sm italic text-foreground/90">
              {trimmedNotes}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default VoucherCard;
