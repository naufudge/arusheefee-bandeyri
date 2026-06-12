"use client";

import React, { useState } from "react";
import { Download, ChevronDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

type ExportAssetRegisterProps = {
  /** Distinct acquisition years (descending), from the register page. */
  years: string[];
};

const ExportAssetRegister: React.FC<ExportAssetRegisterProps> = ({ years }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  // Which option is downloading ("all" or a year); null when idle.
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (year: string) => {
    if (busy) return;
    setBusy(year);
    try {
      const res = await fetch(`/api/asset/export/fa?year=${year}`);
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
      link.setAttribute(
        "download",
        year === "all" ? "Asset Register (All).xlsx" : `Asset Register ${year}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      toast({
        title: "Could not export",
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={busy !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background"
        >
          {busy !== null ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export FA
          <ChevronDown className="size-4 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <ExportItem
          label="All years"
          busy={busy === "all"}
          disabled={busy !== null}
          onClick={() => download("all")}
        />
        {years.length > 0 && (
          <div className="my-1 border-t" role="separator" />
        )}
        <div className="max-h-64 overflow-y-auto">
          {years.map((y) => (
            <ExportItem
              key={y}
              label={y}
              busy={busy === y}
              disabled={busy !== null}
              onClick={() => download(y)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

type ExportItemProps = {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
};

const ExportItem: React.FC<ExportItemProps> = ({
  label,
  busy,
  disabled,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
  >
    {label}
    {busy && <Loader2 className="size-4 animate-spin" />}
  </button>
);

export default ExportAssetRegister;
