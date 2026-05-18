"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PettyCashPrintData } from "@/components/petty-cash/PrintView";

interface Props {
  pettyCashNum: string;
}

const ROLE_LABELS = [
  { key: "handledBy", label: "Handled By" },
  { key: "procurementApprovedBy", label: "Procurement Approved By" },
  { key: "budgetCheckedBy", label: "Budget Checked By" },
  { key: "balanceHandedOverBy", label: "Balance Handed Over By" },
  { key: "balanceCollectedBy", label: "Balance Collected By" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transform(record: any): PettyCashPrintData {
  return {
    pettyCashNum: record.pettyCashNum,
    date: record.date ? new Date(record.date) : null,
    formNum: record.formNum,
    sectionUnit: record.sectionUnit,
    totalRequiredAmount: record.totalRequiredAmount,
    glCode: record.glCode,
    parkedDate: record.parkedDate ? new Date(record.parkedDate) : null,
    postingDate: record.postingDate ? new Date(record.postingDate) : null,
    items:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      record.items?.map((it: any) => ({ qty: it.qty, name: it.name })) ?? [],
    roles: ROLE_LABELS.map(({ key, label }) => {
      const role = record[key];
      return {
        label,
        name: role?.staff?.name ?? "",
        designation: role?.staff?.designation ?? "",
        amount: role?.amount ?? null,
        isApproved: !!role?.isApproved,
        date: role?.date ? new Date(role.date) : null,
        signature: record.signatures?.[key] ?? null,
      };
    }),
  };
}

const DownloadPdf: React.FC<Props> = ({ pettyCashNum }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const record = await queryClient.fetchQuery(
        trpc.pettycash.pdfPayload.queryOptions({ pettyCashNum }),
      );
      const transformed = transform(record);

      const [{ pdf }, { default: PrintView }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/petty-cash/PrintView"),
      ]);

      const blob = await pdf(
        <PrintView pettyCash={transformed} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `petty_cash_${pettyCashNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Could not download PDF",
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      aria-label="Download PDF"
      onClick={handleDownload}
      disabled={busy}
      className="transition hover:text-foreground disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
    </button>
  );
};

export default DownloadPdf;
