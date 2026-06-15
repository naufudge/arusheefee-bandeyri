"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportPettyCashProps {
  year: number | string;
}

const ExportPettyCash: React.FC<ExportPettyCashProps> = ({ year }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleExportClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/petty-cash/export/${year}`);
      if (!res.ok) {
        const message = await res
          .json()
          .then((j) => j?.error)
          .catch(() => null);
        throw new Error(message ?? `Export failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `petty_cash_register_${year}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Could not export",
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
      onClick={handleExportClick}
      disabled={busy}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background"
    >
      {busy ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Exporting…
        </>
      ) : (
        <>
          <Download className="size-4" />
          Export
        </>
      )}
    </button>
  );
};

export default ExportPettyCash;
