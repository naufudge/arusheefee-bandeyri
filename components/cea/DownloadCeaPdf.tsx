"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import type { CeaPdfData } from "./CeaPdf";
import type { CeaPdfPayload } from "./types";

/** The CEA as the PDF prints it. Dhivehi falls back to English when blank. */
export function toCeaPdfData(cea: CeaPdfPayload): CeaPdfData {
  const r = cea.resolved;
  return {
    ceaNum: cea.ceaNum,
    date: format(new Date(cea.date), "dd/MM/yyyy"),
    businessArea: cea.businessArea,
    section: r.section ?? "",
    glCode: r.glAccount?.code ?? null,
    budgetBalance: r.budgetBalance,
    rows: r.rows,
    feNameDv: cea.feNameDv || cea.feNameEn || "",
    feDesignationDv: cea.feDesignationDv || cea.feDesignationEn || "",
    creatorNameDv: cea.requestedBy ? cea.requestedBy.dhivehiName || cea.requestedBy.name : "",
    creatorDesignationDv: cea.requestedBy ? cea.requestedBy.dhivehiDesignation || cea.requestedBy.designation : "",
    signature: cea.signature,
    stamp: cea.stamp,
  };
}

interface Props {
  ceaNum: string;
  /** Labelled button (detail page) instead of an icon (register rows). */
  withLabel?: boolean;
}

export function DownloadCeaPdf({ ceaNum, withLabel }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Always fresh: a draft's values follow its price evaluation.
      const cea = await queryClient.fetchQuery({
        ...trpc.cea.pdfPayload.queryOptions({ ceaNum }),
        staleTime: 0,
      });
      const [{ renderPdfBlob }, { default: CeaPdf }] = await Promise.all([
        import("@/lib/pdf-render"),
        import("./CeaPdf"),
      ]);
      const blob = await renderPdfBlob(<CeaPdf data={toCeaPdfData(cea)} />);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cea_${ceaNum.replace(/[()]/g, "").replace(/\//g, "-")}.pdf`;
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
