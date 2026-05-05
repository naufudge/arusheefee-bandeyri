"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { createRoot, type Root } from "react-dom/client";
import { useTRPC } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import PrintView from "@/components/pv/PrintView";
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

    let host: HTMLDivElement | null = null;
    let root: Root | null = null;

    try {
      const data = await queryClient.fetchQuery(
        trpc.pv.getByNum.queryOptions({ pvNum })
      );
      const pv = transformToPv(data);

      // Wait for fonts so Faruma / MVWaheed render in the capture.
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Off-screen container at PrintView's natural width.
      host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "-10000px";
      host.style.top = "0";
      host.style.width = "950px";
      host.style.background = "#ffffff";
      host.style.zIndex = "-1";
      document.body.appendChild(host);

      root = createRoot(host);
      root.render(<PrintView pv={pv} />);

      // Two RAFs to let layout/paint settle.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
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
        // Capture-only style overrides:
        //  1. Tailwind's `outline` is not rendered by html2canvas (lives outside
        //     the box model). Swap it for an equivalent `border`.
        //  2. Faruma/MVWaheed glyphs render with tight vertical metrics in
        //     html2canvas, so descenders leak past cell bottoms. Give Dhivehi
        //     text and bordered cells more line-height + a touch more padding
        //     to keep them inside their box.
        // Live page is untouched.
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
            .custom-border-1 div,
            .custom-border-2 div div,
            .custom-border-3 div div,
            .custom-border-4 div div,
            .GL-table div {
              line-height: 1.7 !important;
              padding-top: 4px !important;
              padding-bottom: 4px !important;
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
      const pageW = doc.internal.pageSize.getWidth(); // 210
      const pageH = doc.internal.pageSize.getHeight(); // 297
      const margin = 8;
      const imgW = pageW - margin * 2; // 194 mm
      const imgH = (canvas.height * imgW) / canvas.width;
      const usableH = pageH - margin * 2; // 281 mm

      if (imgH <= usableH) {
        // Single page — fits after the down-scale.
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        doc.addImage(dataUrl, "JPEG", margin, margin, imgW, imgH);
      } else {
        // Multi-page: slice the source canvas into page-height chunks.
        // Source-canvas pixels per mm of PDF page:
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
            sliceHeight
          );
          const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
          const sliceMmH = (sliceHeight * imgW) / canvas.width;

          if (pageIndex > 0) doc.addPage();
          doc.addImage(sliceDataUrl, "JPEG", margin, margin, imgW, sliceMmH);

          offset += sliceHeight;
          pageIndex++;
        }
      }

      doc.save(`pv_${pvNum}.pdf`);
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
