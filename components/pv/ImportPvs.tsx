"use client";

import React, { useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type EntryKind = "pv" | "pc";

type PreviewSummary = {
  totalRows: number;
  pvCount: number;
  pcCount: number;
  valid: {
    kind: EntryKind;
    num: string;
    vendor: string;
    total: number;
    invoiceCount: number;
    glCount: number;
  }[];
  invalid: {
    kind: EntryKind;
    num: string;
    error: string;
    rowNumbers: number[];
  }[];
  duplicates: { kind: EntryKind; num: string; vendor: string }[];
};

type CommitResult = {
  inserted: number;
  replaced: number;
  skipped: number;
  failed: { kind: EntryKind; num: string; error: string }[];
};

function kindLabel(kind: EntryKind): string {
  return kind === "pv" ? "PV" : "PC";
}

function kindBadgeClasses(kind: EntryKind): string {
  return kind === "pv"
    ? "bg-blue-100 text-blue-700"
    : "bg-purple-100 text-purple-700";
}

type Stage = "pick" | "loading-preview" | "preview" | "committing" | "result";

interface ImportPvsProps {
  onImported?: () => void;
}

const ImportPvs: React.FC<ImportPvsProps> = ({ onImported }) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [replaceDuplicates, setReplaceDuplicates] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStage("pick");
    setFile(null);
    setSummary(null);
    setResult(null);
    setError(null);
    setReplaceDuplicates(false);
    setDragActive(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    setOpen(next);
  };

  const onPickFile = (f: File | null) => {
    setError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setError("Please select a .xlsx file.");
      return;
    }
    setFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onPickFile(f);
  };

  const requestPreview = async () => {
    if (!file) return;
    setStage("loading-preview");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "preview");
      const res = await fetch("/api/pv/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to read file.");
        setStage("pick");
        return;
      }
      setSummary(json.summary as PreviewSummary);
      setStage("preview");
    } catch {
      setError("Network error while uploading the file.");
      setStage("pick");
    }
  };

  const requestCommit = async () => {
    if (!file || !summary) return;
    setStage("committing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "commit");
      fd.append("onConflict", replaceDuplicates ? "replace" : "skip");
      const res = await fetch("/api/pv/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Import failed",
          description: json.error ?? "Could not import vouchers.",
        });
        setStage("preview");
        return;
      }
      const r = json.result as CommitResult;
      setResult(r);
      setStage("result");
      const parts: string[] = [];
      if (r.inserted) parts.push(`${r.inserted} created`);
      if (r.replaced) parts.push(`${r.replaced} replaced`);
      if (r.skipped) parts.push(`${r.skipped} skipped`);
      toast({
        title: "Import complete",
        description: parts.join(" · ") || "No changes made",
      });
      onImported?.();
    } catch {
      toast({
        title: "Import failed",
        description: "Network error during import.",
      });
      setStage("preview");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
      >
        <Upload className="size-4" />
        Import
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl gap-0 p-0 sm:rounded-md">
          {/* Header */}
          <div className="border-b px-6 py-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {stage === "result" ? "Complete" : "Bulk import"}
            </div>
            <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
              {stage === "result"
                ? "Import finished"
                : "Import register"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {stage === "result"
                ? "Here's what changed."
                : "Upload an .xlsx file. Rows with \"PC\" in the Voucher No are routed to the petty cash register; the rest become PVs."}
            </DialogDescription>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            {(stage === "pick" || stage === "loading-preview") && (
              <PickStage
                file={file}
                error={error}
                dragActive={dragActive}
                inputRef={inputRef}
                onSetDragActive={setDragActive}
                onDrop={onDrop}
                onPickFile={onPickFile}
                onClear={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                loading={stage === "loading-preview"}
              />
            )}

            {stage === "preview" && summary && (
              <PreviewStage summary={summary} />
            )}

            {stage === "committing" && <CommittingStage />}

            {stage === "result" && result && <ResultStage result={result} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
            {stage === "pick" && (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!file}
                  onClick={requestPreview}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                </button>
              </>
            )}

            {stage === "loading-preview" && (
              <>
                <span className="text-sm text-muted-foreground">
                  Reading file…
                </span>
                <span />
              </>
            )}

            {stage === "preview" && summary && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStage("pick");
                    setSummary(null);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                  Back
                </button>

                <div className="flex items-center gap-4">
                  {summary.duplicates.length > 0 && (
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={replaceDuplicates}
                        onChange={(e) =>
                          setReplaceDuplicates(e.target.checked)
                        }
                        className="size-3.5 rounded border-input accent-foreground"
                      />
                      Replace {summary.duplicates.length}{" "}
                      {summary.duplicates.length === 1
                        ? "duplicate"
                        : "duplicates"}
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={
                      summary.valid.length === 0 ||
                      (summary.duplicates.length > 0 &&
                        !replaceDuplicates &&
                        summary.valid.length === summary.duplicates.length)
                    }
                    onClick={requestCommit}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Import {willImportCount(summary, replaceDuplicates)}{" "}
                    {willImportCount(summary, replaceDuplicates) === 1
                      ? "record"
                      : "records"}
                  </button>
                </div>
              </>
            )}

            {stage === "committing" && (
              <>
                <span className="text-sm text-muted-foreground">
                  Writing to database…
                </span>
                <span />
              </>
            )}

            {stage === "result" && (
              <>
                <span />
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium transition hover:bg-muted"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

function willImportCount(summary: PreviewSummary, replace: boolean): number {
  if (replace) return summary.valid.length;
  return summary.valid.length - summary.duplicates.length;
}

function PickStage({
  file,
  error,
  dragActive,
  inputRef,
  onSetDragActive,
  onDrop,
  onPickFile,
  onClear,
  loading,
}: {
  file: File | null;
  error: string | null;
  dragActive: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSetDragActive: (b: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  onPickFile: (f: File | null) => void;
  onClear: () => void;
  loading: boolean;
}) {
  return (
    <>
      {!file ? (
        <label
          htmlFor="pv-import-input"
          onDragOver={(e) => {
            e.preventDefault();
            onSetDragActive(true);
          }}
          onDragLeave={() => onSetDragActive(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed p-10 text-center transition ${
            dragActive
              ? "border-foreground bg-muted/60"
              : "border-input bg-card hover:bg-muted/40"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-md bg-muted">
            <Upload className="size-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-medium">
              Drop your .xlsx here, or click to browse
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Same column layout as the PV register export. Rows with{" "}
              <span className="font-mono">PC</span> in the Voucher No become
              petty cash entries.
            </div>
          </div>
          <input
            ref={inputRef}
            id="pv-import-input"
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-md border bg-card p-4">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
            <FileSpreadsheet className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{file.name}</div>
            <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatFileSize(file.size)}
            </div>
          </div>
          {!loading && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Remove file"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
          {loading && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !file && (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
    </>
  );
}

function PreviewStage({ summary }: { summary: PreviewSummary }) {
  const willCreate = summary.valid.length - summary.duplicates.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="PVs" value={summary.pvCount} />
        <StatTile label="PCs" value={summary.pcCount} accent="purple" />
        <StatTile label="New" value={willCreate} accent="emerald" />
        <StatTile
          label="Duplicates"
          value={summary.duplicates.length}
          accent={summary.duplicates.length > 0 ? "amber" : undefined}
        />
        <StatTile
          label="Invalid"
          value={summary.invalid.length}
          accent={summary.invalid.length > 0 ? "red" : undefined}
        />
      </div>

      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Read{" "}
        <span className="font-mono tabular-nums text-foreground">
          {summary.totalRows}
        </span>{" "}
        rows
      </div>

      {summary.duplicates.length > 0 && (
        <details className="group rounded-md border bg-card">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Duplicates ({summary.duplicates.length})
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              Show
            </span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">
              Hide
            </span>
          </summary>
          <div className="max-h-48 overflow-auto border-t">
            <ul className="divide-y">
              {summary.duplicates.map((d) => (
                <li
                  key={`${d.kind}-${d.num}`}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <KindBadge kind={d.kind} />
                    <span className="font-mono tabular-nums">{d.num}</span>
                  </span>
                  <span className="truncate text-muted-foreground">
                    {d.vendor}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {summary.invalid.length > 0 && (
        <details className="group rounded-md border bg-card" open>
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-red-500" />
              Invalid ({summary.invalid.length})
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">
              Show
            </span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">
              Hide
            </span>
          </summary>
          <div className="max-h-48 overflow-auto border-t">
            <ul className="divide-y">
              {summary.invalid.map((i) => (
                <li
                  key={`${i.kind}-${i.num}`}
                  className="px-4 py-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <KindBadge kind={i.kind} />
                      <span className="font-mono tabular-nums">{i.num}</span>
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {i.rowNumbers.length === 1
                        ? `row ${i.rowNumbers[0]}`
                        : `rows ${i.rowNumbers[0]}-${
                            i.rowNumbers[i.rowNumbers.length - 1]
                          }`}
                    </span>
                  </div>
                  <div className="mt-0.5 text-red-700">{i.error}</div>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: EntryKind }) {
  return (
    <span
      className={`inline-flex h-4 items-center rounded-sm px-1.5 text-[9px] font-semibold uppercase tracking-wider ${kindBadgeClasses(kind)}`}
      title={kind === "pv" ? "Payment Voucher" : "Petty Cash"}
    >
      {kindLabel(kind)}
    </span>
  );
}

function CommittingStage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <div className="text-sm text-muted-foreground">
        Importing vouchers, please wait…
      </div>
    </div>
  );
}

function ResultStage({ result }: { result: CommitResult }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <CheckCircle2 className="size-10 text-emerald-600" />
        <div className="text-base font-semibold">Done</div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Created" value={result.inserted} accent="emerald" />
        <StatTile label="Replaced" value={result.replaced} />
        <StatTile label="Skipped" value={result.skipped} />
      </div>

      {result.failed.length > 0 && (
        <details className="rounded-md border bg-card" open>
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-red-500" />
              Failed ({result.failed.length})
            </span>
          </summary>
          <div className="max-h-40 overflow-auto border-t">
            <ul className="divide-y">
              {result.failed.map((f) => (
                <li
                  key={`${f.kind}-${f.num}`}
                  className="px-4 py-2 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <KindBadge kind={f.kind} />
                    <span className="font-mono tabular-nums">{f.num}</span>
                  </span>
                  <div className="mt-0.5 text-red-700">{f.error}</div>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "amber" | "red" | "purple";
}) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "amber"
        ? "text-amber-700"
        : accent === "red"
          ? "text-red-700"
          : accent === "purple"
            ? "text-purple-700"
            : "";
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1.5 font-mono text-xl font-medium tabular-nums ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default ImportPvs;
