import React from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberWithCommas } from "@/utils/helpers";
import {
  columnValue,
  enteredLines,
  filledLines,
  formRows,
  type FiyesAmount,
  type FiyesEntries,
  type FiyesFormCode,
  type FiyesFormDef,
  type FiyesLine,
  type FiyesLinesForm as LinesForm,
  type FiyesRowsContent,
  type FiyesRowsForm as RowsForm,
} from "@/lib/fiyes";
import { formatDmy } from "@/lib/week";

// Read-only views of what a return's forms carry, for the return page.

const money = (n: number) => formatNumberWithCommas(n) ?? "0.00";

const amountLabel = (a: FiyesAmount, bounds?: { first: Date; last: Date }) =>
  a.asAt && bounds ? `As at ${formatDmy(bounds[a.asAt])}` : a.label;

/** What a lines or rows form carries, in a phrase. */
export function entriesSummary(form: FiyesFormDef, entries: FiyesEntries): string {
  if (form.content.type === "lines") {
    const filled = filledLines(form as LinesForm, entries);
    if (filled.length === 0) return "Nil return, as the template";
    const values = entries.lines[form.code as FiyesFormCode] ?? {};
    if (filled.length === 1 && form.content.amounts.length === 1) {
      return `${filled[0].label}: MVR ${money(values[filled[0].key]?.[form.content.amounts[0].key] ?? 0)}`;
    }
    return `${filled.length} ${filled.length === 1 ? "line" : "lines"} with amounts`;
  }
  if (form.content.type === "rows") {
    const rows = formRows(form, entries);
    if (rows.length === 0) return "Nil return, as the template";
    const [singular, plural] = form.content.noun;
    const total = form.content.columns.find((c) => c.key === (form.content as FiyesRowsContent).total);
    const sum = total ? rows.reduce((s, r) => s + Number(columnValue(total, r)), 0) : null;
    return `${rows.length} ${rows.length === 1 ? singular : plural}${sum === null ? "" : `, MVR ${money(sum)}`}`;
  }
  return "";
}

/** Lines and their amounts as a table. */
export function LinesTable({
  form,
  entries,
  lines,
  bounds,
}: {
  form: LinesForm;
  entries: FiyesEntries;
  lines?: readonly FiyesLine[];
  bounds?: { first: Date; last: Date };
}) {
  const values = entries.lines[form.code as FiyesFormCode] ?? {};
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <th className="px-4 py-2 font-medium sm:px-5">Line</th>
          {form.content.amounts.map((a) => (
            <th key={a.key} className="px-4 py-2 text-right font-medium sm:px-5">
              {amountLabel(a, bounds)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {(lines ?? enteredLines(form.content)).map((l) => (
          <tr key={l.key}>
            <td className="px-4 py-2 sm:px-5">
              {l.ref && <span className="mr-2 font-mono text-[11px] text-muted-foreground">{l.ref}</span>}
              {l.label}
            </td>
            {form.content.amounts.map((a) => {
              const v = values[l.key]?.[a.key] ?? 0;
              return (
                <td key={a.key} className="whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums sm:px-5">
                  {v === 0 ? <span className="text-muted-foreground">–</span> : money(v)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CardHeader({ form, note }: { form: FiyesFormDef; note?: string }) {
  return (
    <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
      <Table2 className="size-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold">{form.title}</h2>
      {note && <span className="ml-auto text-[11px] text-muted-foreground">{note}</span>}
    </header>
  );
}

/** A lines form with amounts (e.g. F03), every line shown. */
export function LinesCard({ form, entries }: { form: LinesForm; entries: FiyesEntries }) {
  return (
    <section className="rounded-md border bg-card">
      <CardHeader form={form} />
      <div className="overflow-x-auto">
        <LinesTable form={form} entries={entries} />
      </div>
    </section>
  );
}

/**
 * A rows form's entries, each row as label/value pairs in the template's
 * column order (the F06 forms run to 15 columns, too wide for a table here).
 */
export function RowsCard({ form, entries }: { form: RowsForm; entries: FiyesEntries }) {
  const rows = formRows(form, entries);
  const columns = form.content.columns.filter((c) => c.type !== "ba");
  const [singular, plural] = form.content.noun;
  return (
    <section className="rounded-md border bg-card">
      <CardHeader form={form} note={`${rows.length} ${rows.length === 1 ? singular : plural}`} />
      <ol className="divide-y">
        {rows.map((row, i) => (
          <li key={i} className="px-4 py-3 sm:px-5">
            <div className="mb-2 font-mono text-[11px] text-muted-foreground">#{i + 1}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {columns.map((c) => {
                const v = columnValue(c, row);
                const numeric = c.type === "money" || c.type === "closing";
                return (
                  <div key={c.key} className={cn("min-w-0", c.wide && "col-span-2")}>
                    <dt className="text-[11px] text-muted-foreground">{c.header.replace(/\*$/, "")}</dt>
                    <dd
                      className={cn(
                        "break-words text-sm",
                        numeric && "font-mono tabular-nums",
                        c.type === "closing" && "font-semibold",
                        c.type === "code" && "font-mono text-xs leading-5",
                      )}
                    >
                      {numeric ? money(Number(v)) : v === "" ? <span className="text-muted-foreground">–</span> : v}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}
