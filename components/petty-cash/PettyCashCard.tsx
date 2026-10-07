import React from "react";
import { format } from "date-fns";
import { FileText, Hash, Layers } from "lucide-react";
import { Eyebrow, Chip, LifecycleStep } from "@/components/shared/detail-card";

interface PettyCashLike {
  sectionUnit: string;
  formNum: string | null;
  glAccount: { code: number };
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

      <div className="mt-5 border-t px-4 py-4 sm:px-5">
        <Eyebrow>References</Eyebrow>
        <div className="mt-2 flex flex-wrap gap-2">
          {pettyCash.formNum && (
            <Chip
              icon={<Hash className="size-3" />}
              label="Form #"
              value={pettyCash.formNum}
              mono
            />
          )}
          <Chip
            icon={<Layers className="size-3" />}
            label="GL code"
            value={String(pettyCash.glAccount.code)}
            mono
          />
        </div>
      </div>

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
