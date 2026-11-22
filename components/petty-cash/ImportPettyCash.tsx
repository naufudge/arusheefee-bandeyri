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
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";

// Staff picked for sheet names, remembered in this browser for the next
// import (a convenience only; the server checks every pick).
const NAME_MAP_KEY = "pc-import-name-map";
function rememberedNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NAME_MAP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function rememberNames(map: Record<string, string>) {
  try {
    localStorage.setItem(NAME_MAP_KEY, JSON.stringify({ ...rememberedNames(), ...map }));
  } catch {
    // Storage unavailable: nothing to remember.
  }
}

type PreviewSummary = {
  totalRows: number;
  valid: { num: string; details: string; total: number }[];
  invalid: { num: string; error: string; row: number }[];
  duplicates: { num: string }[];
  /** In Charge of Thijoory / Received by names with no single staff match. */
  unmatchedNames?: { key: string; name: string; columns: string[]; reason: string; rows: number[] }[];
};

type CommitResult = {
  inserted: number;
  replaced: number;
  skipped: number;
  failed: { num: string; error: string }[];
};

type Stage =
  | "pick"
  | "loading-preview"
  | "select-sheet"
  | "preview"
  | "committing"
  | "result";

interface ImportPettyCashProps {
  onImported?: () => void;
}

const ImportPettyCash: React.FC<ImportPettyCashProps> = ({ onImported }) => {
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
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  // Sheet name key → staff id, for names that matched no single staff member.
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const trpc = useTRPC();
  const { data: staff } = useQuery({
    ...trpc.staff.list.queryOptions(),
    enabled: open && (summary?.unmatchedNames?.length ?? 0) > 0,
  });
  const staffOptions: SearchableSelectOption[] = (staff ?? []).map((s) => ({ value: s.id, label: s.name }));
  const staffIds = new Set(staffOptions.map((o) => o.value));

  const reset = () => {
    setStage("pick");
    setFile(null);
    setSummary(null);
    setNameMap({});
    setResult(null);
    setError(null);
    setReplaceDuplicates(false);
    setDragActive(false);
    setSheets([]);
    setSelectedSheet("");
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

  const requestPreview = async (sheet?: string) => {
    if (!file) return;
    const sheetName = sheet ?? selectedSheet;
    setStage("loading-preview");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "preview");
      if (sheetName) fd.append("sheet", sheetName);
      const res = await fetch("/api/petty-cash/import", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to read file.");
        setStage("pick");
        return;
      }
      // Multiple sheets and none chosen yet — let the user pick one.
      if (json.needsSheet) {
        setSheets(json.sheets as string[]);
        setStage("select-sheet");
        return;
      }
      const next = json.summary as PreviewSummary;
      // Start from the picks made for these names last time.
      const remembered = rememberedNames();
      setNameMap(
        Object.fromEntries(
          (next.unmatchedNames ?? []).filter((n) => remembered[n.key]).map((n) => [n.key, remembered[n.key]]),
        ),
      );
      setSummary(next);
      setStage("preview");
    } catch {
      setError("Network error while uploading the file.");
      setStage("pick");
    }
  };

  const chooseSheet = (sheet: string) => {
    setSelectedSheet(sheet);
    requestPreview(sheet);
  };

  const requestCommit = async () => {
    if (!file || !summary) return;
    setStage("committing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "commit");
      fd.append("onConflict", replaceDuplicates ? "replace" : "skip");
      if (selectedSheet) fd.append("sheet", selectedSheet);
      // Only picks of staff still in the list (a remembered pick may be stale).
      const links = Object.fromEntries(Object.entries(nameMap).filter(([, id]) => staffIds.has(id)));
      if (Object.keys(links).length) fd.append("nameMap", JSON.stringify(links));
      const res = await fetch("/api/petty-cash/import", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: "Import failed",
          description: json.error ?? "Could not import records.",
        });
        setStage("preview");
        return;
      }
      rememberNames(links);
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
          <div className="border-b px-6 py-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {stage === "result" ? "Complete" : "Bulk import"}
            </div>
            <DialogTitle className="mt-1 text-xl font-semibold tracking-tight">
              {stage === "result"
                ? "Import finished"
                : "Import petty cash register"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {stage === "result"
                ? "Here's what changed."
                : stage === "select-sheet"
                  ? "This workbook has multiple sheets. Choose the one holding the petty cash register."
                  : "Upload the petty cash registry .xlsx. Opening-balance and reimbursement rows are skipped — only petty cash expense lines are imported."}
            </DialogDescription>
          </div>

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

            {stage === "select-sheet" && (
              <SelectSheetStage
                sheets={sheets}
                selected={selectedSheet}
                onChoose={chooseSheet}
              />
            )}

            {stage === "preview" && summary && (
              <PreviewStage
                summary={summary}
                staffOptions={staffOptions}
                nameMap={nameMap}
                onLink={(key, staffId) =>
                  setNameMap((m) => {
                    const next = { ...m };
                    if (staffId) next[key] = staffId;
                    else delete next[key];
                    return next;
                  })
                }
              />
            )}

            {stage === "committing" && <CommittingStage />}

            {stage === "result" && result && <ResultStage result={result} />}
          </div>

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
                  onClick={() => requestPreview()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                </button>
              </>
            )}

            {stage === "select-sheet" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStage("pick");
                    setSheets([]);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                  Back
                </button>
                <span className="text-xs text-muted-foreground">
                  Select a sheet to continue
                </span>
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
                    setSummary(null);
                    // Return to the sheet picker for multi-sheet workbooks,
                    // otherwise back to file selection.
                    setStage(sheets.length > 1 ? "select-sheet" : "pick");
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
                        onChange={(e) => setReplaceDuplicates(e.target.checked)}
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
                    disabled={willImportCount(summary, replaceDuplicates) === 0}
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
          htmlFor="pc-import-input"
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
              Petty cash registry layout (Sheet1). Rows with a{" "}
              <span className="font-mono">PC/NN/YYYY</span> Form No and a Paid
              amount become records.
            </div>
          </div>
          <input
            ref={inputRef}
            id="pc-import-input"
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

function SelectSheetStage({
  sheets,
  selected,
  onChoose,
}: {
  sheets: string[];
  selected: string;
  onChoose: (sheet: string) => void;
}) {
  return (
    <div className="space-y-2">
      {sheets.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onChoose(name)}
          className={`flex w-full items-center gap-3 rounded-md border bg-card px-4 py-3 text-left text-sm font-medium transition hover:bg-muted/50 ${
            selected === name ? "border-foreground ring-1 ring-foreground" : ""
          }`}
        >
          <FileSpreadsheet className="size-4 text-muted-foreground" />
          <span className="truncate">{name}</span>
        </button>
      ))}
    </div>
  );
}

function PreviewStage({
  summary,
  staffOptions,
  nameMap,
  onLink,
}: {
  summary: PreviewSummary;
  staffOptions: SearchableSelectOption[];
  nameMap: Record<string, string>;
  onLink: (key: string, staffId: string | null) => void;
}) {
  const willCreate = summary.valid.length - summary.duplicates.length;
  const unmatched = summary.unmatchedNames ?? [];
  const known = new Set(staffOptions.map((o) => o.value));
  const linked = unmatched.filter((n) => known.has(nameMap[n.key] ?? "")).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Rows read" value={summary.totalRows} />
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

      {summary.invalid.length > 0 && (
        <details className="group rounded-md border bg-card" open>
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-red-500" />
              Invalid ({summary.invalid.length})
            </span>
          </summary>
          <div className="max-h-48 overflow-auto border-t">
            <ul className="divide-y">
              {summary.invalid.map((i) => (
                <li key={`${i.num}-${i.row}`} className="px-4 py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono tabular-nums">{i.num}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      row {i.row}
                    </span>
                  </div>
                  <div className="mt-0.5 text-red-700">{i.error}</div>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {unmatched.length > 0 && (
        <details className="group rounded-md border bg-card" open>
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${linked === unmatched.length ? "bg-emerald-500" : "bg-amber-500"}`} />
              Names not in the staff list ({unmatched.length})
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {linked} of {unmatched.length} linked
            </span>
          </summary>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Link each name to the staff member it means. A name left unlinked still imports, with that person left blank.
          </p>
          <div className="max-h-72 overflow-auto border-t">
            <ul className="divide-y">
              {unmatched.map((n) => {
                const picked = known.has(nameMap[n.key] ?? "") ? nameMap[n.key] : "";
                return (
                  <li key={n.key} className="flex flex-col gap-2 px-4 py-2.5 text-xs sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate font-medium">{n.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {n.rows.length === 1 ? `row ${n.rows[0]}` : `${n.rows.length} rows`}
                        </span>
                      </div>
                      <div className={`mt-0.5 ${picked ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300"}`}>
                        {n.columns.join(" · ")}: {picked ? "linked" : n.reason.toLowerCase()}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <SearchableSelect
                        modal
                        value={picked}
                        onValueChange={(v) => onLink(n.key, v)}
                        options={staffOptions}
                        placeholder={staffOptions.length ? "Link to staff…" : "Loading staff…"}
                        searchPlaceholder="Search staff…"
                        emptyMessage="No staff available"
                        disabled={staffOptions.length === 0}
                        aria-label={`Staff member for ${n.name}`}
                        className="h-8 w-full text-xs sm:w-56"
                        contentClassName="w-[min(18rem,85vw)]"
                      />
                      {/* Fixed slot, so the pickers line up whether or not a row is linked. */}
                      <span className="flex w-6 shrink-0 justify-center">
                        {picked && (
                          <button
                            type="button"
                            onClick={() => onLink(n.key, null)}
                            aria-label={`Unlink ${n.name}`}
                            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </details>
      )}

      {summary.duplicates.length > 0 && (
        <details className="group rounded-md border bg-card">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-amber-500" />
              Duplicates ({summary.duplicates.length})
            </span>
          </summary>
          <div className="max-h-48 overflow-auto border-t">
            <ul className="divide-y">
              {summary.duplicates.map((d) => (
                <li
                  key={d.num}
                  className="px-4 py-2 font-mono text-xs tabular-nums"
                >
                  {d.num}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}

function CommittingStage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <div className="text-sm text-muted-foreground">
        Importing records, please wait…
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
                <li key={f.num} className="px-4 py-2 text-xs">
                  <span className="font-mono tabular-nums">{f.num}</span>
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
  accent?: "emerald" | "amber" | "red";
}) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "amber"
        ? "text-amber-700"
        : accent === "red"
          ? "text-red-700"
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

export default ImportPettyCash;
