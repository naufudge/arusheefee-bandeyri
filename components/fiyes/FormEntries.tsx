"use client";

import React, { useId, useState } from "react";
import { get, useFieldArray, useFormState, useWatch, type Control, type FieldPath } from "react-hook-form";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNumberWithCommas } from "@/utils/helpers";
import { toNumber } from "@/schemas/PriceEvalSchema";
import type { FiyesFormValues, FiyesLinesFormValues, FiyesRowsFormValues } from "@/schemas/FiyesSchema";
import {
  enteredColumns,
  enteredLines,
  linesForms,
  rowClosing,
  rowsForms,
  type FiyesAmount,
  type FiyesColumn,
  type FiyesEntries,
  type FiyesFormCode,
  type FiyesFormDef,
  type FiyesKind,
  type FiyesLinesForm as LinesForm,
  type FiyesRowsContent,
  type FiyesRowsForm as RowsForm,
} from "@/lib/fiyes";
import { formatDmy } from "@/lib/week";

// Editors for what each form carries beyond F01's petty cash and F19's
// invoices. The fields come from the catalogue in lib/fiyes.ts.

const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";
const KINDS: FiyesKind[] = ["MONTHLY", "YEARLY"];
/** Amounts show blank for 0, so an untouched form reads as nil. */
const amountText = (n: number | string | undefined) => (typeof n === "number" && n !== 0 ? String(n) : "");

// ----- Values in and out of the form -----

/** Line amounts for every form of both sets, from a saved return or blank. */
export function linesDefaults(entries?: FiyesEntries): FiyesLinesFormValues {
  const out: FiyesLinesFormValues = {};
  for (const f of KINDS.flatMap(linesForms)) {
    const saved = entries?.lines[f.code as FiyesFormCode] ?? {};
    out[f.code] = Object.fromEntries(
      enteredLines(f.content).map((l) => [
        l.key,
        Object.fromEntries(f.content.amounts.map((a) => [a.key, amountText(saved[l.key]?.[a.key])])),
      ]),
    );
  }
  return out;
}

/** Rows for every form of both sets, from a saved return or none. */
export function rowsDefaults(entries?: FiyesEntries): FiyesRowsFormValues {
  const out: FiyesRowsFormValues = {};
  for (const f of KINDS.flatMap(rowsForms)) {
    out[f.code] = (entries?.rows[f.code as FiyesFormCode] ?? []).map((row) =>
      Object.fromEntries(
        enteredColumns(f.content).map((c) => [c.key, c.type === "money" ? amountText(row[c.key]) : String(row[c.key] ?? "")]),
      ),
    );
  }
  return out;
}

const blankRow = (content: FiyesRowsContent): Record<string, string> =>
  Object.fromEntries(enteredColumns(content).map((c) => [c.key, c.type === "currency" ? "MVR" : ""]));

/** One set's lines and rows as the server takes them: blank amounts are 0. */
export function entriesInput(kind: FiyesKind, values: Pick<FiyesFormValues, "lines" | "rows">) {
  return {
    lines: Object.fromEntries(
      linesForms(kind).map((f) => [
        f.code,
        Object.fromEntries(
          enteredLines(f.content).map((l) => [
            l.key,
            Object.fromEntries(f.content.amounts.map((a) => [a.key, toNumber(values.lines[f.code]?.[l.key]?.[a.key]) ?? 0])),
          ]),
        ),
      ]),
    ),
    rows: Object.fromEntries(
      rowsForms(kind).map((f) => [
        f.code,
        (values.rows[f.code] ?? []).map((r) =>
          Object.fromEntries(
            enteredColumns(f.content).map((c) => {
              const v = (r[c.key] ?? "").trim();
              return [c.key, c.type === "money" ? (toNumber(v) ?? 0) : c.type === "currency" ? v.toUpperCase() : v];
            }),
          ),
        ),
      ]),
    ),
  };
}

// ----- Layout -----

export function FormCode({ code }: { code: string }) {
  return (
    <span className="w-[4.5rem] shrink-0 rounded border bg-background px-1.5 py-0.5 text-center font-mono text-[11px] tabular-nums">
      {code.replace("-", " ")}
    </span>
  );
}

type FormPath = FieldPath<FiyesFormValues>;

/** Whether any of these fields has a validation error. */
export function useHasErrors(paths: FormPath[]): boolean {
  const { errors } = useFormState<FiyesFormValues>({ name: paths });
  return paths.some((p) => get(errors, p) !== undefined);
}

/** The clickable part of a collapsible header: chevron plus whatever it labels. */
export function DisclosureButton({
  shown,
  onToggle,
  controls,
  children,
}: {
  shown: boolean;
  onToggle: () => void;
  controls: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={shown}
      aria-controls={shown ? controls : undefined}
      className="-mx-1.5 flex w-full min-w-0 items-center gap-3 rounded-md px-1.5 py-1 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronRight
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
          shown && "rotate-90",
        )}
      />
      {children}
    </button>
  );
}

/**
 * One form's section on the return form, collapsible from its header. It
 * stays open while any field in `errorPaths` is invalid, so a save that
 * fails never hides the reason.
 */
export function FormCard({
  form,
  status,
  open,
  onOpenChange,
  errorPaths = [],
  action,
  children,
}: {
  form: FiyesFormDef;
  status: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorPaths?: FormPath[];
  /** Header buttons; given whether the card is showing. */
  action?: (shown: boolean) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const bodyId = useId();
  const hasErrors = useHasErrors(errorPaths);
  const shown = open || hasErrors;
  return (
    <section className="rounded-md border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <h3 className="min-w-0 flex-1">
          <DisclosureButton shown={shown} onToggle={() => onOpenChange(!shown)} controls={bodyId}>
            <FormCode code={form.code} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{form.title.replace(/^F\d+ /, "")}</span>
              <span className="block text-xs font-normal text-muted-foreground">{status}</span>
            </span>
          </DisclosureButton>
        </h3>
        {action?.(shown)}
      </header>
      {shown && children ? (
        <div id={bodyId} className="border-t px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

const amountLabel = (a: FiyesAmount, bounds?: { first: Date; last: Date }) =>
  a.asAt && bounds ? `As at ${formatDmy(bounds[a.asAt])}` : a.label;

// ----- Lines (F01's other cash, F03) -----

/** How many of a form's lines have an amount, as typed so far. */
export function useFilledLines(control: Control<FiyesFormValues>, form: LinesForm): number {
  const values = useWatch({ control, name: `lines.${form.code}` }) ?? {};
  return enteredLines(form.content).filter((l) =>
    form.content.amounts.some((a) => (toNumber(values[l.key]?.[a.key]) ?? 0) !== 0),
  ).length;
}

export const filledLinesText = (n: number) => `${n} ${n === 1 ? "line" : "lines"} with amounts`;

/** A form's fixed lines with an input per amount; blank is 0. */
export function LinesEditor({
  form,
  control,
  bounds,
}: {
  form: LinesForm;
  control: Control<FiyesFormValues>;
  bounds?: { first: Date; last: Date };
}) {
  const { amounts } = form.content;
  const two = amounts.length === 2;
  const grid = two ? "grid-cols-2 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]" : "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_10rem]";
  return (
    <div>
      <div className={cn("hidden gap-x-4 pb-1 sm:grid", grid)}>
        <span />
        {amounts.map((a) => (
          <span key={a.key} className="text-right text-xs text-muted-foreground">
            {amountLabel(a, bounds)}
          </span>
        ))}
      </div>
      <div className="divide-y">
        {enteredLines(form.content).map((line) => (
          <div key={line.key} className={cn("grid items-start gap-x-4 gap-y-1.5 py-2.5", grid)}>
            <div className={cn("pt-2 text-sm", two && "col-span-2 sm:col-span-1")}>
              {line.ref && <span className="mr-2 font-mono text-xs text-muted-foreground">{line.ref}</span>}
              {line.label}
            </div>
            {amounts.map((a) => (
              <FormField
                key={a.key}
                control={control}
                name={`lines.${form.code}.${line.key}.${a.key}`}
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[11px] font-normal text-muted-foreground sm:sr-only">
                      {amountLabel(a, bounds)}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="h-9 text-right font-mono tabular-nums"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** F03 and any other form made of fixed lines: starts closed while every amount is 0. */
export function LinesFormCard({ form, control }: { form: LinesForm; control: Control<FiyesFormValues> }) {
  const filled = useFilledLines(control, form);
  const [open, setOpen] = useState(filled > 0);
  return (
    <FormCard
      form={form}
      status={filled ? filledLinesText(filled) : "Nil return: every amount is 0.00"}
      open={open}
      onOpenChange={setOpen}
      errorPaths={[`lines.${form.code}`]}
      action={(shown) =>
        !shown &&
        filled === 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Enter amounts
          </Button>
        )
      }
    >
      <LinesEditor form={form} control={control} />
    </FormCard>
  );
}

// ----- Rows (F04, F05, F12, F06) -----

/** F04, F05, F12 and the F06 forms: any number of rows; none is a nil return. */
export function RowsFormCard({ form, control }: { form: RowsForm; control: Control<FiyesFormValues> }) {
  const { fields, append, remove } = useFieldArray({ control, name: `rows.${form.code}` });
  const [open, setOpen] = useState(fields.length > 0);
  const [singular, plural] = form.content.noun;
  const add = () => {
    append(blankRow(form.content));
    setOpen(true);
  };
  return (
    <FormCard
      form={form}
      status={fields.length ? `${fields.length} ${fields.length === 1 ? singular : plural}` : "Nil return: nothing to report"}
      open={open}
      onOpenChange={setOpen}
      errorPaths={[`rows.${form.code}`]}
      action={() =>
        fields.length === 0 && (
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="size-4" />
            Add {singular}
          </Button>
        )
      }
    >
      {fields.length > 0 ? (
        <>
          <div className="space-y-3">
            {fields.map((f, index) => (
              <EntryRow key={f.id} form={form} index={index} control={control} onRemove={() => remove(index)} />
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={add}>
            <Plus className="size-4" />
            Add another {singular}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No {plural} entered, so {form.code.replace("-", " ")} is filed as a nil return.
        </p>
      )}
    </FormCard>
  );
}

function inputProps(c: FiyesColumn) {
  if (c.type === "money") return { inputMode: "decimal" as const, placeholder: "0.00", className: "h-9 text-right font-mono tabular-nums" };
  if (c.type === "currency") return { maxLength: 3, className: "h-9 uppercase" };
  if (c.type === "code") return { className: "h-9 font-mono" };
  return { className: "h-9" };
}

function EntryRow({
  form,
  index,
  control,
  onRemove,
}: {
  form: RowsForm;
  index: number;
  control: Control<FiyesFormValues>;
  onRemove: () => void;
}) {
  const row = useWatch({ control, name: `rows.${form.code}.${index}` }) ?? {};
  const amount = (key: string) => toNumber(row[key]) ?? 0;
  const closing = rowClosing({ opening: amount("opening"), receipts: amount("receipts"), payments: amount("payments") });
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${form.content.noun[0]} ${index + 1}`}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-red-600"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {form.content.columns.map((c) => {
          if (c.type === "ba") return null;
          const label = c.header.replace(/\*$/, "");
          if (c.type === "closing") {
            return (
              <div key={c.key} className="flex flex-col justify-end">
                <span className="text-xs font-medium">{label}</span>
                <span className="mt-2 flex h-9 items-center justify-end rounded-md border border-dashed bg-muted/40 px-3 font-mono text-sm tabular-nums">
                  {money(closing)}
                </span>
              </div>
            );
          }
          return (
            <FormField
              key={c.key}
              control={control}
              name={`rows.${form.code}.${index}.${c.key}`}
              render={({ field }) => (
                <FormItem className={cn(c.wide && "sm:col-span-2")}>
                  <FormLabel className="text-xs">{label}</FormLabel>
                  <FormControl>
                    <Input {...field} {...inputProps(c)} />
                  </FormControl>
                  {c.hint && <FormDescription className="text-xs">{c.hint}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
