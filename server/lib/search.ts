// Helpers for the global search router (server/routers/search.ts).

/**
 * Case-insensitive substring filter for a Prisma string field. Prisma passes
 * `%` and `_` through to ILIKE as wildcards, so they're escaped to match
 * literally.
 */
export const containsCi = (q: string) =>
  ({ contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" }) as const;

/** Spellings to try where only exact matches work. */
export const caseVariants = (q: string) =>
  Array.from(new Set([q, q.toUpperCase(), q.toLowerCase()]));

/**
 * Exact identifier match as typed, upper- or lower-case. Not `equals` with
 * `mode: "insensitive"`: Prisma runs that as an unescaped ILIKE, so "_%"
 * would match any row. This also uses the unique index.
 */
export const exactly = (q: string) => ({ in: caseVariants(q) });

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();

type Candidate = [label: string, value: string | null | undefined];

/**
 * Explains a hit whose match isn't on screen, e.g. "Invoice INV-12". Null
 * when one of the visible strings already shows the match.
 */
export function matchedOn(
  q: string,
  visible: (string | null | undefined)[],
  candidates: Candidate[],
): string | null {
  const needle = q.toLowerCase();
  if (visible.some((v) => lower(v).includes(needle))) return null;
  for (const [label, value] of candidates) {
    if (value && lower(value).includes(needle)) return `${label} ${value}`;
  }
  return null;
}

/** How recent a row is, compared item by item: e.g. its date, then createdAt. */
export type Recency = (Date | number | null | undefined)[];

const recencyValue = (v: Date | number | null | undefined) =>
  v instanceof Date ? v.getTime() : typeof v === "number" ? v : -Infinity;

/** Newest first; a missing value sorts last. */
function compareRecency(a: Recency, b: Recency): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = recencyValue(a[i]);
    const y = recencyValue(b[i]);
    if (x !== y) return y - x;
  }
  return 0;
}

/**
 * Hits newest first, as the searchers query them. Exact-identifier rows are
 * fetched separately so an old record with that exact number is never cut
 * off by the newest-first `take`; they take their place by date, and stay
 * even when older than every other hit shown.
 */
export function rankHits<T extends { id: string }>(
  exact: T[],
  rows: T[],
  limit: number,
  recency: (row: T) => Recency,
) {
  const byNewest = (a: T, b: T) => compareRecency(recency(a), recency(b));
  const seen = new Set(exact.map((r) => r.id));
  const all = [...exact, ...rows.filter((r) => !seen.has(r.id))].sort(byNewest);
  let items = all.slice(0, limit);
  const dropped = exact.filter((r) => !items.includes(r));
  if (dropped.length) items = [...items.slice(0, limit - dropped.length), ...dropped].sort(byNewest);
  return { items, hasMore: all.length > limit };
}

export const isoDate = (d: Date | null | undefined) =>
  d ? d.toISOString() : null;

/** Non-empty trimmed values joined for a one-line summary. */
export const joinList = (values: (string | null | undefined)[]) =>
  values
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(", ");
