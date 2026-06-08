/**
 * Asset-number format helpers (pure, JSON-backed — safe on client & server).
 *
 * An asset number encodes the asset's taxonomy position:
 *
 *   {agency}-{YY}-{mainCatNum}-{subCatNum}-{typeNum}[-{variantNum}]-{itemNo}
 *     433  -  18 -     02     -    15     -   79                  -   01
 *
 * The category numbers come from the taxonomy (`getCategoryNumber`). Legacy
 * data mixes zero-padding (`02` vs `2`, `01` vs `1`), so all comparisons here
 * are done on parsed integers — never on the raw strings.
 */
import { CATEGORY_TREE, getCategoryNumber } from "@/lib/constants/assetCategories";

/** Fixed agency/business code for National Archives assets. */
export const AGENCY_CODE = "433";

type TreeNode = { [key: string]: TreeNode | string[] };
const TREE = CATEGORY_TREE as unknown as TreeNode;

function asBranch(node: TreeNode | string[] | undefined): TreeNode {
  if (node && !Array.isArray(node) && typeof node === "object") {
    return node as TreeNode;
  }
  return {};
}

export type TypePath = {
  mainNum?: number;
  subNum?: number;
  typeNum?: number;
  variantNum?: number;
  /** The resolved L3 type / L4 variant names actually used. */
  typeName?: string;
  variantName?: string;
};

/**
 * Resolve the numeric path for a (category, subcategory, leaf) selection.
 * `leaf` may be an L3 type or an L4 variant; we walk the tree to tell which
 * and fill `typeNum` (+ `variantNum` for variants).
 */
export function getTypePath(
  category: string,
  subcategory: string,
  leaf: string,
): TypePath {
  const path: TypePath = {
    mainNum: category ? getCategoryNumber(category) : undefined,
    subNum: subcategory ? getCategoryNumber(subcategory) : undefined,
  };
  if (!leaf) return path;

  const subBranch = asBranch(asBranch(TREE[category])[subcategory]);
  const l3Keys = Object.keys(subBranch);
  const leafLc = leaf.trim().toLowerCase();

  // Direct L3 type match.
  const l3Match = l3Keys.find((k) => k.toLowerCase() === leafLc);
  if (l3Match) {
    path.typeName = l3Match;
    path.typeNum = getCategoryNumber(l3Match);
    return path;
  }

  // L4 variant: find the L3 type whose variant array contains `leaf`.
  for (const k of l3Keys) {
    const variants = subBranch[k];
    if (Array.isArray(variants)) {
      const v = variants.find((x) => x.trim().toLowerCase() === leafLc);
      if (v) {
        path.typeName = k;
        path.typeNum = getCategoryNumber(k);
        path.variantName = v;
        path.variantNum = getCategoryNumber(v);
        return path;
      }
    }
  }

  // Free-text / off-taxonomy leaf: best-effort number lookup.
  path.typeName = leaf;
  path.typeNum = getCategoryNumber(leaf);
  return path;
}

/** Two-digit year from a 2- or 4-digit year string, else null. */
export function toYY(year: string | undefined | null): string | null {
  if (!year) return null;
  const digits = year.replace(/\D/g, "");
  if (digits.length < 2) return null;
  return digits.slice(-2);
}

export type BuildPrefixResult = {
  /** `433-YY-main-sub-type[-variant]-` (unpadded), or null if anything's missing. */
  prefix: string | null;
  /** Human-readable names of the missing pieces, for UI guidance. */
  missing: string[];
  yy: string | null;
  path: TypePath;
};

/**
 * Build the asset-number prefix (everything up to and including the dash
 * before the running item number).
 */
export function buildPrefix(opts: {
  year?: string | null;
  category: string;
  subcategory: string;
  assetType: string;
}): BuildPrefixResult {
  const { category, subcategory, assetType } = opts;
  const yy = toYY(opts.year);
  const path = getTypePath(category, subcategory, assetType);

  const missing: string[] = [];
  if (!yy) missing.push("year");
  if (!category) missing.push("category");
  else if (path.mainNum === undefined) missing.push("category number");
  if (!subcategory) missing.push("subcategory");
  else if (path.subNum === undefined) missing.push("subcategory number");
  if (!assetType) missing.push("type");
  else if (path.typeNum === undefined) missing.push("type number");

  if (
    !yy ||
    path.mainNum === undefined ||
    path.subNum === undefined ||
    path.typeNum === undefined
  ) {
    return { prefix: null, missing, yy, path };
  }

  const segs = [AGENCY_CODE, yy, path.mainNum, path.subNum, path.typeNum];
  if (path.variantNum !== undefined) segs.push(path.variantNum);
  return { prefix: `${segs.join("-")}-`, missing, yy, path };
}

export type ParsedAssetNumber = {
  /** All dash segments parsed as integers (padding-agnostic). */
  parts: number[];
  /** The trailing running item number. */
  item: number;
};

/** Parse an asset number into its integer segments, or null if not numeric/dashed. */
export function parseAssetNumber(num: string): ParsedAssetNumber | null {
  const trimmed = (num ?? "").trim();
  if (!trimmed) return null;
  const raw = trimmed.split("-");
  if (raw.length < 2) return null;
  if (!raw.every((s) => /^\d+$/.test(s))) return null;
  const parts = raw.map((s) => Number(s));
  return { parts, item: parts[parts.length - 1] };
}

export type ValidationResult = {
  /** Looks like an asset number (≥6 numeric dash segments). */
  formatOk: boolean;
  /** Leading segments match the selected category/subcategory/type. */
  matchesCategory: boolean;
  /** Human-readable problems for an inline hint. */
  issues: string[];
  parsed: ParsedAssetNumber | null;
};

/** Padding-agnostic regex for a well-formed asset number (≥6 numeric segments). */
export const ASSET_NUMBER_PATTERN = /^\d+(-\d+){5,}$/;

/**
 * Validate an asset number's shape and (optionally) that its segments match
 * the selected taxonomy. Non-blocking — drives an inline badge.
 */
export function validateAssetNumber(
  num: string,
  selection?: { category?: string; subcategory?: string; assetType?: string },
): ValidationResult {
  const parsed = parseAssetNumber(num);
  const issues: string[] = [];
  const formatOk = !!parsed && parsed.parts.length >= 6;
  if (!formatOk) {
    issues.push("Expected 433-YY-category-subcategory-type-item.");
    return { formatOk, matchesCategory: false, issues, parsed };
  }

  const p = parsed!.parts;
  if (String(p[0]) !== AGENCY_CODE) {
    issues.push(`Agency code should be ${AGENCY_CODE}.`);
  }

  let matchesCategory = true;
  if (selection?.category && selection?.assetType) {
    const path = getTypePath(
      selection.category,
      selection.subcategory ?? "",
      selection.assetType,
    );
    if (path.mainNum !== undefined && p[2] !== path.mainNum) {
      matchesCategory = false;
      issues.push(`Category segment (${p[2]}) ≠ ${path.mainNum}.`);
    }
    if (path.subNum !== undefined && p[3] !== path.subNum) {
      matchesCategory = false;
      issues.push(`Subcategory segment (${p[3]}) ≠ ${path.subNum}.`);
    }
    if (path.typeNum !== undefined && p[4] !== path.typeNum) {
      matchesCategory = false;
      issues.push(`Type segment (${p[4]}) ≠ ${path.typeNum}.`);
    }
    if (
      path.variantNum !== undefined &&
      !(p.length >= 7 && p[5] === path.variantNum)
    ) {
      matchesCategory = false;
      issues.push(`Variant segment ≠ ${path.variantNum}.`);
    }
  } else {
    matchesCategory = false;
  }

  return { formatOk, matchesCategory, issues, parsed };
}
