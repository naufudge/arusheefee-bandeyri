"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import type { PriceEvalPdfData, PriceEvalPdfPerson } from "./PriceEvaluationPdf";

type Staffish = {
  name: string;
  designation: string;
  dhivehiName: string | null;
  dhivehiDesignation: string | null;
} | null;

// The form is Dhivehi, so signatories print by their Dhivehi name and
// designation where one is on file.
const person = (s: Staffish, signature: string | null): PriceEvalPdfPerson => ({
  name: s ? s.dhivehiName || s.name : undefined,
  designation: s ? s.dhivehiDesignation || s.designation : undefined,
  signature,
});

interface Props {
  evalNum: string;
  /** Labelled button (detail page) instead of an icon (register rows). */
  withLabel?: boolean;
}

export function DownloadPriceEvalPdf({ evalNum, withLabel }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pe = await queryClient.fetchQuery(
        trpc.priceEval.pdfPayload.queryOptions({ evalNum }),
      );
      const data: PriceEvalPdfData = {
        evalNum: pe.evalNum,
        date: format(new Date(pe.date), "dd/MM/yyyy"),
        section: pe.section,
        method: pe.method,
        glCode: pe.glAccount.code,
        budgetBalance: pe.budgetBalance,
        // Set by the budget checker (cleared if the evaluation goes back to draft).
        budgetAvailable: pe.budgetAvailable,
        gstRate: pe.gstRate,
        vendors: pe.vendors,
        items: pe.items,
        selectedVendor: pe.selectedVendor,
        selectionReason: pe.selectionReason ?? "",
        preparedBy: person(pe.preparedBy, pe.signatures.preparedBy),
        budgetCheckedBy: person(pe.budgetCheckedBy, pe.signatures.budgetCheckedBy),
        checkedBy: person(pe.checkedBy, pe.signatures.checkedBy),
        approvedBy: person(pe.approvedBy, pe.signatures.approvedBy),
      };

      const [{ renderPdfBlob }, { default: PriceEvaluationPdf }] = await Promise.all([
        import("@/lib/pdf-render"),
        import("./PriceEvaluationPdf"),
      ]);
      const blob = await renderPdfBlob(<PriceEvaluationPdf data={data} />);

      // Append the attached quotations — PDFs page-for-page, images one page
      // each. Non-fatal: the form itself still downloads.
      let finalBlob = blob;
      try {
        const res = await fetch(
          `/api/attachment?referenceType=price_evaluation&referenceId=${pe.id}`,
        );
        if (res.ok) {
          const { attachments } = (await res.json()) as {
            attachments: { id: number; mimeType: string | null; originalName: string | null }[];
          };
          if (attachments.length > 0) {
            const { bundleAttachmentsIntoPdf } = await import("@/lib/pdf-bundle");
            const result = await bundleAttachmentsIntoPdf(blob, attachments);
            finalBlob = result.blob;
            const notes = [
              result.errors.length ? `Couldn't be added: ${result.errors.join(", ")}` : null,
              result.skipped.length
                ? `Only PDFs and images can be bundled — left out: ${result.skipped.join(", ")}`
                : null,
            ].filter(Boolean);
            if (notes.length) {
              toast({ title: "Some attachments weren't included", description: notes.join(" · ") });
            }
          }
        }
      } catch {
        // Fall through with the bare form.
      }

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `price_evaluation_${evalNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Could not download PDF",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
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
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Download PDF
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      aria-label="Download PDF"
      title="Download PDF"
      className="transition hover:text-foreground disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
    </button>
  );
}
