import React from "react";
import { format } from "date-fns";
import { FileText, Hash, Banknote, ArrowRightLeft } from "lucide-react";

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

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
    {children}
  </div>
);

const Chip: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}> = ({ icon, label, value, mono }) => (
  <div className="inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
    {icon && <span className="text-muted-foreground">{icon}</span>}
    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
      {label}
    </span>
    <span className={`text-xs ${mono ? "font-mono tabular-nums" : "font-medium"}`}>
      {value}
    </span>
  </div>
);

interface StepProps {
  label: string;
  value: string | null;
  isFirst?: boolean;
  isLast?: boolean;
}

const LifecycleStep: React.FC<StepProps> = ({ label, value, isFirst, isLast }) => {
  const filled = !!value;
  return (
    <div className="flex flex-1 items-start gap-1.5 sm:gap-2">
      {!isFirst && (
        <div
          className={`mt-[9px] h-px flex-1 ${
            filled ? "bg-foreground/70" : "bg-border"
          }`}
        />
      )}
      <div className="flex min-w-0 flex-col items-center gap-1.5 px-0.5 sm:px-1">
        <div
          className={`size-2.5 rounded-full ${
            filled ? "bg-foreground" : "border border-border bg-background"
          }`}
        />
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        <div
          className={`text-center text-[11px] tabular-nums ${
            filled
              ? "font-mono text-foreground"
              : "italic text-muted-foreground/70"
          }`}
        >
          {filled ? value : "Pending"}
        </div>
      </div>
      {!isLast && (
        <div
          className={`mt-[9px] h-px flex-1 ${
            filled ? "bg-foreground/70" : "bg-border"
          }`}
        />
      )}
    </div>
  );
};

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
