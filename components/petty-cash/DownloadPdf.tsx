"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { createRoot, type Root } from "react-dom/client";
import { useTRPC } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import PrintView, { type PettyCashPrintData } from "@/components/petty-cash/PrintView";

interface DownloadPdfProps {
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
      };
    }),
  };
}

const DownloadPdf: React.FC<DownloadPdfProps> = ({ pettyCashNum }) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);

    let host: HTMLDivElement | null = null;
    let root: Root | null = null;

    try {
      const data = await queryClient.fetchQuery(
        trpc.pettycash.getByNum.queryOptions({ pettyCashNum }),
      );
      const transformed = transform(data);

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Off-screen render at PrintView's natural width.
      host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "-10000px";
      host.style.top = "0";
      host.style.width = "950px";
      host.style.background = "#ffffff";
      host.style.zIndex = "-1";
      document.body.appendChild(host);

      root = createRoot(host);
      root.render(<PrintView pettyCash={transformed} />);

      // Two RAFs to let layout/paint settle before snapshotting.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(host, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        // Same Dhivehi-font / outline overrides PV uses (see
        // components/pv/DownloadPdf.tsx). Live page is untouched.
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement("style");
          style.textContent = `
            .outline {
              outline: none !important;
              border: 1px solid currentColor !important;
            }
            .dhivehi,
            .font-faruma,
            .font-waheed {
              line-height: 1.9 !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        },
      });

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 8;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const usableH = pageH - margin * 2;

      if (imgH <= usableH) {
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        doc.addImage(dataUrl, "JPEG", margin, margin, imgW, imgH);
      } else {
        const pxPerMm = canvas.width / imgW;
        const slicePxH = Math.floor(usableH * pxPerMm);
        let offset = 0;
        let pageIndex = 0;

        while (offset < canvas.height) {
          const sliceHeight = Math.min(slicePxH, canvas.height - offset);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceHeight;
          const ctx = sliceCanvas.getContext("2d");
          if (!ctx) throw new Error("Could not create 2D context for slice");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            offset,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
          );
          const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
          const sliceMmH = (sliceHeight * imgW) / canvas.width;

          if (pageIndex > 0) doc.addPage();
          doc.addImage(sliceDataUrl, "JPEG", margin, margin, imgW, sliceMmH);

          offset += sliceHeight;
          pageIndex++;
        }
      }

      doc.save(`petty_cash_${pettyCashNum}.pdf`);
    } catch (err) {
      toast({
        title: "Could not download PDF",
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
      });
    } finally {
      if (root) root.unmount();
      if (host && host.parentNode) host.parentNode.removeChild(host);
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
