import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROCUREMENT_STAGES,
  procurementStatusLabel,
  type ProcurementProgress,
  type ProcurementStageKey,
  type StageState,
} from "@/lib/procurement";

const NODE: Record<StageState, string> = {
  done: "border-foreground bg-foreground text-background",
  "in-progress": "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  empty: "border-dashed border-muted-foreground/40 bg-background text-muted-foreground/60",
};

/**
 * The procurement's stages as a stepper: filled when done, amber while in
 * progress, dashed when not started. `compact` is the register's dot row;
 * the full version names each stage and what's in it.
 */
export function StageTracker({
  progress,
  detail,
  compact,
}: {
  progress: ProcurementProgress;
  /** Full variant: a line under each stage, e.g. "PE 2026-1 · Awaiting check". */
  detail?: Partial<Record<ProcurementStageKey, React.ReactNode>>;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center" aria-label={procurementStatusLabel(progress)}>
        {PROCUREMENT_STAGES.map((stage, i) => {
          const state = progress.stages[stage.key];
          return (
            <React.Fragment key={stage.key}>
              {i > 0 && (
                <span
                  className={cn(
                    "h-px w-4 sm:w-6",
                    progress.stages[PROCUREMENT_STAGES[i - 1].key] === "done" ? "bg-foreground/60" : "bg-border",
                  )}
                />
              )}
              <span
                title={`${stage.label}${stage.optional ? " (if an asset)" : ""}: ${state === "done" ? "done" : state === "in-progress" ? "in progress" : "not started"}`}
                className={cn(
                  "size-2.5 shrink-0 rounded-full border",
                  state === "done" && "border-foreground bg-foreground",
                  state === "in-progress" && "border-amber-500 bg-amber-400",
                  state === "empty" && "border-muted-foreground/40 bg-background",
                  stage.optional && state === "empty" && "border-dotted",
                )}
              />
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <ol className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 sm:gap-0">
      {PROCUREMENT_STAGES.map((stage, i) => {
        const state = progress.stages[stage.key];
        const prevDone = i > 0 && progress.stages[PROCUREMENT_STAGES[i - 1].key] === "done";
        return (
          <li key={stage.key} className="relative flex flex-col items-start sm:items-center sm:text-center">
            {/* Connector to the previous stage (desktop only). */}
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute right-1/2 top-[15px] hidden h-0.5 w-full sm:block",
                  prevDone ? "bg-foreground" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2 font-mono text-xs font-semibold",
                NODE[state],
              )}
            >
              {state === "done" ? <Check className="size-4" /> : i + 1}
              {state === "in-progress" && (
                <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-amber-500 ring-2 ring-card" />
              )}
            </span>
            <span className="mt-2 text-sm font-medium">{stage.label}</span>
            {stage.optional && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">if an asset</span>
            )}
            <span className="mt-0.5 text-xs text-muted-foreground">
              {detail?.[stage.key] ?? (state === "empty" ? "Not started" : null)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** "Completed" (emerald), "Ongoing · Payment" (amber) or "Not started". */
export function ProcurementStatusPill({ progress }: { progress: ProcurementProgress }) {
  const label = procurementStatusLabel(progress);
  const tone = progress.completed
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
    : progress.currentStage
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-muted text-muted-foreground";
  const dot = progress.completed ? "bg-emerald-500" : progress.currentStage ? "bg-amber-500" : "bg-muted-foreground/60";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em]",
        tone,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
