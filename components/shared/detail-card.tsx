import React from "react";

export const Eyebrow: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
    {children}
  </div>
);

export const Chip: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}> = ({ icon, label, value, mono }) => (
  <div className="inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
    {icon && <span className="text-muted-foreground">{icon}</span>}
    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
      {label}
    </span>
    <span className={`text-xs ${mono ? "font-mono tabular-nums" : "font-medium"}`}>
      {value}
    </span>
  </div>
);

interface StepProps {
  label: string;
  value: string | null;
  isFirst?: boolean;
  isLast?: boolean;
}

export const LifecycleStep: React.FC<StepProps> = ({
  label,
  value,
  isFirst,
  isLast,
}) => {
  const filled = !!value;
  return (
    <div className="flex flex-1 items-start gap-1.5 sm:gap-2">
      {!isFirst && (
        <div
          className={`mt-[9px] h-px flex-1 ${
            filled ? "bg-foreground/70" : "bg-border"
          }`}
        />
      )}
      <div className="flex min-w-0 flex-col items-center gap-1.5 px-0.5 sm:px-1">
        <div
          className={`size-2.5 rounded-full ${
            filled ? "bg-foreground" : "border border-border bg-background"
          }`}
        />
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        <div
          className={`text-center text-[11px] tabular-nums ${
            filled
              ? "font-mono text-foreground"
              : "italic text-muted-foreground/70"
          }`}
        >
          {filled ? value : "Pending"}
        </div>
      </div>
      {!isLast && (
        <div
          className={`mt-[9px] h-px flex-1 ${
            filled ? "bg-foreground/70" : "bg-border"
          }`}
        />
      )}
    </div>
  );
};
