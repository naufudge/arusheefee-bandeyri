"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PvValues } from "@/schemas/PvSchema";

interface DownloadPdfProps {
  pvNum: string;
}

// Mirrors the transform in app/(pv)/print/page.tsx — Prisma → PvValues.
// Kept inline (duplicated) so this component is self-contained for v1.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformToPv(pv: any): PvValues {
  return {
    pvNum: pv.pvNum,
    businessArea: pv.businessArea,
    agency: pv.agency,
    vendor: pv.vendor,
    date: new Date(pv.date),
    notes: pv.notes,
    currency: pv.currency,
    exchangeRate: pv.exchangeRate,
    paymentMethod: pv.paymentMethod,
    preparedBy: {
      name: pv.preparedBy?.name,
      designation: pv.preparedBy?.designation,
    },
    verifiedBy: {
      name: pv.verifiedBy?.name,
      designation: pv.verifiedBy?.designation,
    },
    authorisedByOne: {
      name: pv.authorisedByOne?.name,
      designation: pv.authorisedByOne?.designation,
    },
    authorisedByTwo: {
      name: pv.authorisedByTwo?.name,
      designation: pv.authorisedByTwo?.designation,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoiceDetails: pv.invoices.map((invoice: any) => ({
      comments: invoice.comments,
      invoiceNumber: invoice.invoiceNumber ?? undefined,
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate) : null,
      invoiceTotal: invoice.invoiceTotal,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      glDetails: invoice.glDetails.map((gl: any) => ({
        code: gl.code,
        fund: gl.fund,
        amount: gl.amount,
      })),
    })),
    poNum: pv.poNum ?? undefined,
    parkedDate: pv.parkedDate ? new Date(pv.parkedDate) : null,
    postingDate: pv.postingDate ? new Date(pv.postingDate) : null,
    clearingDoc: {
      num: pv.clearingDocNum ?? undefined,
      date: pv.clearingDocDate ? new Date(pv.clearingDocDate) : undefined,
    },
    transferNum: pv.transferNum ?? undefined,
  };
}

const DownloadPdf: React.FC<DownloadPdfProps> = ({ pvNum }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const data = await queryClient.fetchQuery(
        trpc.pv.getByNum.queryOptions({ pvNum })
      );
      const pv = transformToPv(data);

      const [{ pdf }, { default: PrintViewPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/pv/PrintViewPdf"),
      ]);

      const blob = await pdf(<PrintViewPdf pv={pv} />).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pv_${pvNum}.pdf`;
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
