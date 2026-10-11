import type { PrismaClient } from "@prisma/client";

// Works with both the client and a transaction client.
type Db = Pick<PrismaClient, "appSetting">;

export const GST_RATE_KEY = "gst_rate";

/** Used only if the setting row is missing (the migration seeds it). */
const DEFAULT_GST_RATE = 8;

/** The global GST rate, as a percentage (e.g. 8). */
export async function getGstRate(db: Db): Promise<number> {
  const row = await db.appSetting.findUnique({ where: { key: GST_RATE_KEY } });
  const rate = row ? Number(row.value) : NaN;
  return Number.isFinite(rate) ? rate : DEFAULT_GST_RATE;
}
