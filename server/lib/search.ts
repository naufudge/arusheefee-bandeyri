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

/**
 * Exact-identifier rows first (fetched separately so an old record with
 * that exact number is never cut off by the newest-first `take`), then the
 * rest by tier: number starts with q, number contains q, any other field.
 * Array.sort is stable, so newest-first order holds within a tier.
 */
export function rankHits<T extends { id: string }>(
  exact: T[],
  rows: T[],
  q: string,
  limit: number,
  keysOf: (row: T) => (string | null | undefined)[],
) {
  const needle = q.toLowerCase();
  const tier = (row: T) => {
    const keys = keysOf(row).map(lower);
    if (keys.some((k) => k === needle)) return 0;
    if (keys.some((k) => k.startsWith(needle))) return 1;
    if (keys.some((k) => k.includes(needle))) return 2;
    return 3;
  };
  const seen = new Set(exact.map((r) => r.id));
  const ranked = [
    ...exact,
    ...rows.filter((r) => !seen.has(r.id)).sort((a, b) => tier(a) - tier(b)),
  ];
  return { items: ranked.slice(0, limit), hasMore: ranked.length > limit };
}

export const isoDate = (d: Date | null | undefined) =>
  d ? d.toISOString() : null;

/** Non-empty trimmed values joined for a one-line summary. */
export const joinList = (values: (string | null | undefined)[]) =>
  values
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(", ");
