"use client";

import React, { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { fiyesFileName, parsePeriod, returnTitle, type FiyesForm } from "@/lib/fiyes";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

const errorText = (err: unknown) => (err instanceof Error ? err.message : "An unknown error occurred.");

/** One form's Excel file: the filled template, from the server. */
async function excelBlob(period: string, code: string): Promise<Blob> {
  const res = await fetch(`/api/fiyes/${period}/${code}`);
  if (!res.ok) {
    const message = await res.json().then((j) => j?.error).catch(() => null);
    throw new Error(message ?? `Download failed (HTTP ${res.status})`);
  }
  return res.blob();
}

/** Renders one form's approval PDF here, from the server's layout of the filled sheet. */
function usePdfRenderer() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return async (period: string, code: FiyesForm["code"]) => {
    // Always fresh, so a signature added a moment ago shows.
    const data = await queryClient.fetchQuery({
      ...trpc.fiyes.pdfPayload.queryOptions({ period, form: code }),
      staleTime: 0,
    });
    const [{ renderPdfBlob }, { default: FiyesSheetPdf }] = await Promise.all([
      import("@/lib/pdf-render"),
      import("./FiyesSheetPdf"),
    ]);
    return { blob: await renderPdfBlob(<FiyesSheetPdf data={data} />), fileName: data.fileName };
  };
}

/** Excel (the exact template, for upload) and PDF (the approval document) for one form. */
export function FormDownloads({ period, form }: { period: string; form: FiyesForm }) {
  const renderPdf = usePdfRenderer();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const p = parsePeriod(period);

  const downloadExcel = async () => {
    if (busy || !p) return;
    setBusy("xlsx");
    try {
      saveBlob(await excelBlob(period, form.code), fiyesFileName(form, p, "xlsx"));
    } catch (err) {
      toast({ title: "Could not download the Excel file", description: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    if (busy) return;
    setBusy("pdf");
    try {
      const { blob, fileName } = await renderPdf(period, form.code);
      saveBlob(blob, fileName);
    } catch (err) {
      toast({ title: "Could not download the PDF", description: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" onClick={downloadExcel} disabled={busy !== null} className={BUTTON} title="The Fiyes template, filled in — upload this file">
        {busy === "xlsx" ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
        Excel
      </button>
      <button type="button" onClick={downloadPdf} disabled={busy !== null} className={BUTTON} title="The signed approval document — attach this">
        {busy === "pdf" ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
        PDF
      </button>
    </div>
  );
}

/**
 * Every form's Excel files, or every form's PDFs, as one .zip named after the
 * return. All or nothing: a form that fails stops the download.
 */
export function BulkDownloads({ period, forms }: { period: string; forms: FiyesForm[] }) {
  const renderPdf = usePdfRenderer();
  const { toast } = useToast();
  const [busy, setBusy] = useState<{ kind: "xlsx" | "pdf"; done: number } | null>(null);
  const p = parsePeriod(period);

  const download = async (kind: "xlsx" | "pdf") => {
    if (busy || !p) return;
    setBusy({ kind, done: 0 });
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      // One at a time: PDFs render in this tab and share react-pdf's font cache.
      for (const [i, form] of forms.entries()) {
        if (kind === "xlsx") {
          zip.file(fiyesFileName(form, p, "xlsx"), await excelBlob(period, form.code));
        } else {
          const { blob, fileName } = await renderPdf(period, form.code);
          zip.file(fileName, blob);
        }
        setBusy({ kind, done: i + 1 });
      }
      saveBlob(await zip.generateAsync({ type: "blob" }), `${returnTitle(p)} - ${kind === "xlsx" ? "Excel" : "PDFs"}.zip`);
    } catch (err) {
      toast({ title: `Could not download the ${kind === "xlsx" ? "Excel files" : "PDFs"}`, description: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const label = (kind: "xlsx" | "pdf", idle: string) =>
    busy?.kind === kind ? `${busy.done} of ${forms.length}…` : idle;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => download("xlsx")}
        disabled={busy !== null}
        className={BUTTON}
        title={`All ${forms.length} Excel files in one .zip`}
      >
        {busy?.kind === "xlsx" ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
        {label("xlsx", "All Excel")}
      </button>
      <button
        type="button"
        onClick={() => download("pdf")}
        disabled={busy !== null}
        className={BUTTON}
        title={`All ${forms.length} approval PDFs in one .zip`}
      >
        {busy?.kind === "pdf" ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
        {label("pdf", "All PDFs")}
      </button>
    </div>
  );
}
