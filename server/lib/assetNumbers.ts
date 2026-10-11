import type { PrismaClient } from "@prisma/client";
import { AGENCY_CODE, parseAssetNumber } from "@/lib/assetNumber";

// Works with both the client and a transaction client.
type Db = Pick<PrismaClient, "asset">;

export interface ItemPrefix {
  yy: string;
  mainNum: number;
  subNum: number;
  typeNum?: number;
  variantNum?: number | null;
  /** Type-less subcategory: the number has no type segment. */
  noType?: boolean;
}

/**
 * The next running item number for an asset-number prefix. Narrows by
 * agency + year, then matches the category/subcategory/type segments
 * numerically (ignoring legacy zero-padding) and returns max + 1.
 */
export async function nextAssetItem(db: Db, prefix: ItemPrefix): Promise<number> {
  const { yy, mainNum, subNum, typeNum, variantNum, noType } = prefix;
  const hasVariant = variantNum !== undefined && variantNum !== null;

  const assets = await db.asset.findMany({
    where: { assetNum: { startsWith: `${AGENCY_CODE}-${yy}-` } },
    select: { assetNum: true },
  });

  let max = 0;
  for (const a of assets) {
    const parsed = parseAssetNumber(a.assetNum);
    if (!parsed) continue;
    const p = parsed.parts;
    if (p[2] !== mainNum || p[3] !== subNum) continue;
    if (noType) {
      // Type-less subcategory: 5-segment 433-YY-main-sub-item.
      if (p.length !== 5) continue;
    } else {
      if (p[4] !== typeNum) continue;
      if (hasVariant) {
        if (p.length !== 7 || p[5] !== variantNum) continue;
      } else if (p.length !== 6) {
        continue;
      }
    }
    if (parsed.item > max) max = parsed.item;
  }
  return max + 1;
}
