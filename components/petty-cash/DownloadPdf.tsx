"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PettyCashPrintData } from "@/components/petty-cash/PrintView";

interface Props {
  pettyCashNum: string;
  /** Render as a labelled button instead of a bare icon. */
  withLabel?: boolean;
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
    glCode: record.glAccount.code,
    parkedDate: record.parkedDate ? new Date(record.parkedDate) : null,
    postingDate: record.postingDate ? new Date(record.postingDate) : null,
    systemApproved: !!record.systemApproved,
    items:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      record.items?.map((it: any) => ({
        qty: it.qty,
        name: it.name || it.nameDhivehi || "",
      })) ?? [],
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

const DownloadPdf: React.FC<Props> = ({ pettyCashNum, withLabel }) => {
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

      const [{ renderPdfBlob }, { default: PrintView }] = await Promise.all([
        import("@/lib/pdf-render"),
        import("@/components/petty-cash/PrintView"),
      ]);

      const blob = await renderPdfBlob(
        <PrintView pettyCash={transformed} />,
      );

      // Append the reference documents attached to this record — PDFs
      // page-for-page, images one page each. Errors are non-fatal: the
      // base petty cash PDF still downloads.
      let finalBlob = blob;
      try {
        const listRes = await fetch(
          `/api/attachment?referenceType=petty_cash&referenceId=${record.id}`,
        );
        if (listRes.ok) {
          const { attachments } = (await listRes.json()) as {
            attachments: {
              id: number;
              mimeType: string | null;
              originalName: string | null;
            }[];
          };
          if (attachments.length > 0) {
            const { bundleAttachmentsIntoPdf } = await import(
              "@/lib/pdf-bundle"
            );
            const result = await bundleAttachmentsIntoPdf(blob, attachments);
            finalBlob = result.blob;

            const notes: string[] = [];
            if (result.errors.length > 0) {
              notes.push(`Couldn't be added: ${result.errors.join(", ")}`);
            }
            if (result.skipped.length > 0) {
              notes.push(
                `Only PDFs and images can be bundled — left out: ${result.skipped.join(", ")}`,
              );
            }
            if (notes.length > 0) {
              toast({
                title: "Some attachments weren't included",
                description: notes.join(" · "),
              });
            }
          }
        }
      } catch {
        // List fetch / merge failed — fall through with the bare PDF.
      }

      const url = URL.createObjectURL(finalBlob);
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

export default DownloadPdf;
