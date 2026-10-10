import React from "react";
import { format } from "date-fns";
import { FileText, Hash, Layers } from "lucide-react";
import { Eyebrow, Chip, LifecycleStep } from "@/components/shared/detail-card";

interface PettyCashLike {
  sectionUnit: string;
  formNum: string | null;
  glAccount: { code: number; longTextEn: string };
  parkedDate: Date | string | null;
  postingDate: Date | string | null;
}

interface Props {
  pettyCash: PettyCashLike;
}

const formatDate = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "d MMM yyyy") : null;

const PettyCashCard: React.FC<Props> = ({ pettyCash }) => {
  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <FileText className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Request</h2>
      </header>

      <div className="px-4 pt-4 sm:px-5">
        <Eyebrow>Section / Unit</Eyebrow>
        <div className="mt-0.5 text-sm font-medium">{pettyCash.sectionUnit}</div>
      </div>

      {/* GL account: the code as a reference, with its name spelled out. */}
      <div className="px-4 pt-4 sm:px-5">
        <Eyebrow>GL Account</Eyebrow>
        <div className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
          <Layers className="size-3 shrink-0 text-muted-foreground" />
          <span className="shrink-0 font-mono tabular-nums">
            {pettyCash.glAccount.code}
          </span>
          <span className="min-w-0 text-muted-foreground">
            {pettyCash.glAccount.longTextEn}
          </span>
        </div>
      </div>

      {pettyCash.formNum ? (
        <div className="mt-5 border-t px-4 py-4 sm:px-5">
          <Eyebrow>References</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip
              icon={<Hash className="size-3" />}
              label="Form #"
              value={pettyCash.formNum}
              mono
            />
          </div>
        </div>
      ) : (
        <div className="pb-4" />
      )}

      <div className="border-t px-4 py-4 sm:px-5">
        <Eyebrow>ERP Lifecycle</Eyebrow>
        <div className="mt-3 flex items-start">
          <LifecycleStep
            label="Parked"
            value={formatDate(pettyCash.parkedDate)}
            isFirst
          />
          <LifecycleStep
            label="Posted"
            value={formatDate(pettyCash.postingDate)}
            isLast
          />
        </div>
      </div>
    </section>
  );
};

export default PettyCashCard;
