"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { RequisitionData } from "@/components/gsr/RequisitionFormPdf";

interface DownloadGsrPdfProps {
  gsrFormNum: string;
  /** Render as a labelled button instead of a bare icon. */
  withLabel?: boolean;
}

// "DD.MM.YYYY" — the format the reference form uses.
const formatDmy = (date?: Date | string | null): string => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
};

// Map the GSR pdfPayload (Prisma row + base64 signatures) into the PDF's
// RequisitionData shape. Each signature is already gated server-side (only
// fetched once its stage is complete); null → blank Signature cell.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformToRequisition(g: any): RequisitionData {
  const sig = g.signatures ?? {};
  return {
    section: g.section ?? "",
    number: g.gsrFormNum ?? "",
    date: formatDmy(g.date),
    minItemRows: 7,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (g.items ?? []).map((it: any) => ({
      remarks: it.remarks ?? "",
      rqdDate: formatDmy(it.rqdDate),
      particulars: it.particulars ?? "",
      issued: it.issuedQty ?? "",
      requested: it.requestedQty ?? "",
    })),
    approvals: [
      {
        // Requested-by "signs" on submit; gate on past-DRAFT.
        date: g.status !== "DRAFT" ? formatDmy(g.createdAt) : "",
        name: g.requestedBy?.name ?? "",
        designation: g.requestedBy?.designation ?? "",
        signature: sig.requestedBy ?? null,
        roleDv: "އެދުނު",
        roleEn: "Requested By",
      },
      {
        date: g.authorizedAt ? formatDmy(g.authorizedAt) : "",
        name: g.authorizedBy?.name ?? "",
        designation: g.authorizedBy?.designation ?? "",
        signature: sig.authorizedBy ?? null,
        roleDv: "ހުއްދަދެއްވި",
        roleEn: "Authorized By",
      },
      {
        date: g.receivedAt ? formatDmy(g.receivedAt) : "",
        name: g.receivedBy?.name ?? "",
        designation: g.receivedBy?.designation ?? "",
        signature: sig.receivedBy ?? null,
        roleDv: "ފޯމާއި ޙަވާލުވި ފަރާތް",
        roleEn: "Form Received By",
      },
    ],
  };
}

const DownloadGsrPdf: React.FC<DownloadGsrPdfProps> = ({
  gsrFormNum,
  withLabel,
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await queryClient.fetchQuery(
        trpc.gsr.pdfPayload.queryOptions({ gsrFormNum }),
      );

      const [{ pdf }, { default: RequisitionFormPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/gsr/RequisitionFormPdf"),
      ]);

      const blob = await pdf(
        <RequisitionFormPdf data={transformToRequisition(data)} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gsr_${gsrFormNum}.pdf`;
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

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Download PDF
      </button>
    );
  }

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

export default DownloadGsrPdf;
