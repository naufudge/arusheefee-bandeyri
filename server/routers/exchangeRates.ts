import { router, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import axios from "axios";
import { MmaSeriesIds } from "@/lib/constants/currencies";

const MMA_SERIES_URL = "https://database.mma.gov.mv/api/series";

// The series are monthly, so a cached copy stays correct for a long time.
// One fetch pulls ~235KB (every currency, back to 1992), which is far too
// much to re-request each time the user touches the currency dropdown.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type Observation = { date: string; amount: number };

type SeriesCache = {
  fetchedAt: number;
  // Currency code -> observations, ascending by date.
  series: Record<string, Observation[]>;
};

let cache: SeriesCache | null = null;

/**
 * Pulls every currency series from the MMA statistics database in a single
 * request. `meta.per_page` is 100 and we ask for 19 ids, so the response is
 * never paginated.
 */
async function fetchSeries(): Promise<Record<string, Observation[]>> {
  const token = process.env.MMA_TOKEN;
  if (!token) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "MMA_TOKEN is not configured, so exchange rates can't be fetched. " +
        "Request a token at https://database.mma.gov.mv/api/register and " +
        "set MMA_TOKEN in the environment.",
    });
  }

  const ids = Object.values(MmaSeriesIds).join(",");

  let response;
  try {
    response = await axios.get(`${MMA_SERIES_URL}?ids=${ids}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
    });
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        status === 401
          ? "MMA rejected the API token (401). Check MMA_TOKEN is current."
          : "Could not reach the MMA exchange rate service.",
    });
  }

  // Series id -> currency code, to label what comes back.
  const codeById = new Map<number, string>(
    Object.entries(MmaSeriesIds).map(([code, id]) => [id, code]),
  );

  const payload = response.data as {
    data?: { id: number; data?: Observation[] }[];
  };

  const series: Record<string, Observation[]> = {};
  for (const entry of payload.data ?? []) {
    const code = codeById.get(entry.id);
    if (!code || !entry.data?.length) continue;
    series[code] = entry.data;
  }

  if (Object.keys(series).length === 0) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "MMA returned no exchange rate data.",
    });
  }

  return series;
}

async function getSeries(): Promise<Record<string, Observation[]>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.series;
  }
  const series = await fetchSeries();
  cache = { fetchedAt: Date.now(), series };
  return series;
}

/**
 * Picks the rate that applies to `date`'s month. Observations are dated to
 * the last day of their month, so we take the newest one at or before the
 * end of that month — a voucher dated March uses March's rate. A voucher in
 * a month MMA hasn't published yet falls back to the newest available; one
 * predating the series falls back to its earliest point.
 */
function rateForMonth(observations: Observation[], date: Date): number | undefined {
  // Exclusive upper bound: the first instant of the following month. Read
  // in UTC to match how the client anchors the month it asks for.
  const cutoff = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);

  let chosen: Observation | undefined;
  for (const point of observations) {
    if (Date.parse(point.date) < cutoff) chosen = point;
    else break; // Ascending, so everything past here is in the future.
  }
  chosen ??= observations[0];

  return typeof chosen?.amount === "number" ? chosen.amount : undefined;
}

export const exchangeRatesRouter = router({
  // Rates in MVR per one unit of each foreign currency, for the month of
  // the given date (defaults to today). Used by PvForm to fill in the rate
  // when the currency or the PV date changes; gating behind pv:read keeps
  // it consistent with anyone who can see PVs.
  get: permissionProcedure("pv:read")
    .input(z.object({ date: z.coerce.date().optional() }).optional())
    .query(async ({ input }) => {
      const series = await getSeries();
      const date = input?.date ?? new Date();

      const rates: Record<string, number> = {};
      for (const [code, observations] of Object.entries(series)) {
        const amount = rateForMonth(observations, date);
        if (amount === undefined) continue;
        // MMA publishes to 4dp, but small-unit currencies (IDR ≈ 0.0009)
        // would be flattened by a fixed decimal round — significant digits
        // keep both readable and usable.
        rates[code] = Number(amount.toPrecision(6));
      }

      return rates;
    }),
});
