// Capital expenditure authorization (CEA) — shared by the form, the server,
// the detail page and the PDF.

import {
  computeComparison,
  landedLine,
  ratesByPosition,
  type CompareVendor,
} from "@/lib/price-eval";

/** CEA numbers, e.g. "(FRM)433-CA/433/2026/189". */
export const CEA_NUM_FORMAT = /^\(FRM\)433-CA\/433\/(\d{4})\/(\d+)$/;

export const ceaNumFor = (year: number, seq: number) => `(FRM)433-CA/433/${year}/${seq}`;

/** Next number for `year`, given the numbers already used. */
export function nextCeaNum(year: number, existing: string[]): string {
  let max = 0;
  for (const num of existing) {
    const m = CEA_NUM_FORMAT.exec(num.trim());
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  }
  return ceaNumFor(year, max + 1);
}

/** A row as stored on the CEA. */
export interface CeaRow {
  position: number;
  description: string | null;
  qty: number | null;
  cost: number | null;
  onHand: string | null;
  acquired: string | null;
  condition: string | null;
  reason: string | null;
}

/** What a CEA takes from its procurement's price evaluation. */
export interface CeaPeSource {
  evalNum: string;
  section: string;
  budgetBalance: number | null;
  glAccountId: number;
  glAccount: { code: number; longTextEn: string };
  /** Items in order, each costed at the chosen vendor's price (MVR, after discount and GST). */
  items: { description: string; qty: number; cost: number | null }[];
}

/** A price evaluation as loaded with its vendors and items (with quotes). */
interface PeWithQuotes {
  evalNum: string;
  section: string;
  budgetBalance: number | null;
  gstRate: number;
  selectedVendor: number | null;
  glAccountId: number;
  glAccount: { code: number; longTextEn: string };
  vendors: (CompareVendor & { id: string; position: number })[];
  items: { name: string; qty: number; quotes: { vendorId: string; rate: number }[] }[];
}

export function peSource(pe: PeWithQuotes): CeaPeSource {
  const items = pe.items.map((it) => ({ qty: it.qty, rates: ratesByPosition(pe.vendors, it.quotes) }));
  const chosen = pe.selectedVendor;
  const vendor = chosen != null ? pe.vendors[chosen] : undefined;
  const lines = chosen != null ? computeComparison(items, pe.vendors, pe.gstRate).vendors[chosen]?.lines : undefined;
  return {
    evalNum: pe.evalNum,
    section: pe.section,
    budgetBalance: pe.budgetBalance,
    glAccountId: pe.glAccountId,
    glAccount: pe.glAccount,
    items: pe.items.map((it, i) => {
      const line = lines?.[i];
      return {
        description: it.name,
        qty: it.qty,
        cost: vendor && line != null ? landedLine(line, vendor, pe.gstRate) : null,
      };
    }),
  };
}

export interface ResolvedCea {
  /** Values come live from the price evaluation (a draft linked to one). */
  live: boolean;
  sourceEvalNum: string | null;
  section: string | null;
  glAccountId: number | null;
  glAccount: { code: number; longTextEn: string } | null;
  budgetBalance: number | null;
  rows: CeaRow[];
  total: number | null;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * The values a CEA shows. A draft linked to a price evaluation takes the
 * section, budget code, balance and each row's item, quantity and cost from
 * it (row i ↔ item i), keeping its own on-hand/acquired/condition/reason;
 * otherwise it's the stored values.
 */
export function resolveCea(
  cea: {
    status: string;
    section: string | null;
    glAccountId: number | null;
    glAccount: { code: number; longTextEn: string } | null;
    budgetBalance: number | null;
    items: CeaRow[];
  },
  pe: CeaPeSource | null,
): ResolvedCea {
  const live = cea.status === "DRAFT" && pe !== null;
  const stored = [...cea.items].sort((a, b) => a.position - b.position);

  const rows: CeaRow[] = live
    ? pe!.items.map((it, i) => {
        const own = stored.find((r) => r.position === i);
        return {
          position: i,
          description: it.description,
          qty: it.qty,
          cost: it.cost,
          onHand: own?.onHand ?? null,
          acquired: own?.acquired ?? null,
          condition: own?.condition ?? null,
          reason: own?.reason ?? null,
        };
      })
    : stored;

  const costs = rows.map((r) => r.cost).filter((c): c is number => c != null);
  return {
    live,
    sourceEvalNum: live ? pe!.evalNum : null,
    section: live ? pe!.section : cea.section,
    glAccountId: live ? pe!.glAccountId : cea.glAccountId,
    glAccount: live ? pe!.glAccount : cea.glAccount,
    budgetBalance: live ? pe!.budgetBalance : cea.budgetBalance,
    rows,
    total: costs.length ? round2(costs.reduce((s, c) => s + c, 0)) : null,
  };
}

/** Why a CEA can't be signed yet, or null when it's ready. */
export function ceaSignProblem(r: ResolvedCea): string | null {
  const fromPe = r.sourceEvalNum ? ` on price evaluation ${r.sourceEvalNum}` : "";
  if (r.rows.length === 0) return "Add at least one item before signing.";
  if (r.rows.some((row) => !row.description?.trim())) return "Every row needs the item (ބާވަތް) before signing.";
  if (r.rows.some((row) => row.cost == null)) {
    return r.live
      ? `Choose the vendor${fromPe} so every item has a cost before signing.`
      : "Every row needs its estimated cost before signing.";
  }
  if (!r.glAccount) return `Set the budget code${fromPe} before signing.`;
  if (r.budgetBalance == null) return `Enter the code balance${fromPe} before signing.`;
  if (!r.section?.trim()) return `Set the section${fromPe} before signing.`;
  return null;
}
