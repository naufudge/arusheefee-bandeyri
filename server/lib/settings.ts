import type { PrismaClient } from "@prisma/client";
import type { AssetCoding } from "@/lib/asset-creation";

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

/** Setting key for each part of the asset creation form's SAP coding. */
export const ASSET_CODING_KEYS: Record<keyof AssetCoding, string> = {
  agencyName: "asset_agency_name",
  businessArea: "asset_business_area",
  costCentre: "asset_cost_centre",
  fund: "asset_fund",
  functionalArea: "asset_functional_area",
};

/** Used only if a setting row is missing (the migration seeds them). */
const DEFAULT_ASSET_CODING: AssetCoding = {
  agencyName: "National Archives",
  businessArea: "1506",
  costCentre: "C15069999",
  fund: "GOM",
  functionalArea: "S067005001001001",
};

/** The SAP coding new asset creation forms start with. */
export async function getAssetCoding(db: Db): Promise<AssetCoding> {
  const rows = await db.appSetting.findMany({
    where: { key: { in: Object.values(ASSET_CODING_KEYS) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const coding = { ...DEFAULT_ASSET_CODING };
  for (const field of Object.keys(ASSET_CODING_KEYS) as (keyof AssetCoding)[]) {
    const value = byKey.get(ASSET_CODING_KEYS[field])?.trim();
    if (value) coding[field] = value;
  }
  return coding;
}
