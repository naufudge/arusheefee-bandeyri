// Week helpers for the Petty Cash Reconciliation Report. A report covers one
// Maldives work week (Sunday → Thursday). All math is done in UTC to match the
// existing `byYear` date-range queries (and to keep boundaries stable across
// the server and the browser, where the user picks a local Date).

const DAY_MS = 86_400_000;

// Dhivehi month names (index = month - 1).
const DHIVEHI_MONTHS = [
  "ޖަނަވަރީ", // January
  "ފެބުރުވަރީ", // February
  "މާރިޗު", // March
  "އޭޕްރިލް", // April
  "މޭ", // May
  "ޖޫން", // June
  "ޖުލައި", // July
  "އޮގަސްޓް", // August
  "ސެޕްޓެންބަރު", // September
  "އޮކްޓޫބަރު", // October
  "ނޮވެންބަރު", // November
  "ޑިސެންބަރު", // December
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

/** Midnight-UTC date for the given y/m/d. */
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/**
 * Given any date, return the Sunday→Thursday work week that contains it.
 * `weekStart` is that week's Sunday (00:00 UTC); `weekEnd` is the Thursday.
 */
export function weekBoundsForDate(d: Date): { weekStart: Date; weekEnd: Date } {
  const day = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const weekStart = utcDate(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - day,
  );
  const weekEnd = new Date(weekStart.getTime() + 4 * DAY_MS); // Thursday
  return { weekStart, weekEnd };
}

/** Suggested report number "NN/YYYY" — the week's ordinal within its year. */
export function suggestReportNum(weekStart: Date): string {
  const year = weekStart.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((weekStart.getTime() - jan1) / DAY_MS) + 1;
  const weekNum = Math.floor((dayOfYear - 1) / 7) + 1;
  return `${pad(weekNum)}/${year}`;
}

/** "04 ޖަނަވަރީ 2026" — day, Dhivehi month, year. */
function dhivehiDate(d: Date): string {
  return `${pad(d.getUTCDate())} ${DHIVEHI_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "04 ޖަނަވަރީ 2026 ން 08 ޖަނަވަރީ 2026 އަށް" */
export function dhivehiPeriodText(weekStart: Date, weekEnd: Date): string {
  return `${dhivehiDate(weekStart)} ން ${dhivehiDate(weekEnd)} އަށް`;
}

/** "08.01.2026" */
export function formatDmy(d: Date): string {
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** "08.01.2026 ގެ ނިޔަލަށް ހުރި ފައިސާގެ ތަފްޞީލް" */
export function asOfTitle(weekEnd: Date): string {
  return `${formatDmy(weekEnd)} ގެ ނިޔަލަށް ހުރި ފައިސާގެ ތަފްޞީލް`;
}
