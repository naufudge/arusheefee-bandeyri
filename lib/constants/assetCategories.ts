/**
 * Asset taxonomy — static reference data, exactly like `currencies.ts`.
 *
 * The org's asset categories are fixed and live as three JSON files under
 * `public/asset_categories/`. We import them directly (Next inlines JSON at
 * build time, so these helpers run on both server and client) rather than
 * promoting the taxonomy to a database table — assets store the resolved
 * `category` / `assetType` strings on the row, and these helpers drive the
 * cascading form selector, the register facets, and the import's
 * category-resolution fallback.
 *
 * Shape (3 levels): main category → subcategory → leaf type. Leaf-type
 * values are usually `[]`; a few carry a 4th array of named variants which
 * we flatten in as additional selectable types. Excel sheet names match the
 * leaf-type level.
 */
import mainCategoriesJson from "@/public/asset_categories/main_categories.json";
import categoryListsJson from "@/public/asset_categories/asset_category_lists.json";
import categoryNumbersJson from "@/public/asset_categories/asset_category_numbers.json";

type TreeNode = { [key: string]: TreeNode | string[] };

const TREE = categoryListsJson as unknown as TreeNode;
const NUMBERS = categoryNumbersJson as unknown as Record<string, number>;

/** The 10 main categories, in their canonical order. */
export const MAIN_CATEGORIES: string[] = mainCategoriesJson as string[];

/** The raw taxonomy tree, exposed for callers that need to walk it directly. */
export const CATEGORY_TREE = TREE;

/** Narrow a tree value to a branch (object), treating arrays/undefined as empty. */
function asBranch(node: TreeNode | string[] | undefined): TreeNode {
  if (node && !Array.isArray(node) && typeof node === "object") {
    return node as TreeNode;
  }
  return {};
}

/** Subcategories under a main category (e.g. "Office Furniture"). */
export function getSubcategories(category: string): string[] {
  return Object.keys(asBranch(TREE[category]));
}

/**
 * Selectable leaf types under a (category, subcategory) — the 3rd-level keys
 * plus any 4th-level variant strings, deduped. These match Excel sheet names.
 * Used where any stored type name must be recognised (register facet, import
 * category resolution); the create/edit form uses the cascading
 * `getTypeKeys` + `getSubtypes` pair instead.
 */
export function getTypes(category: string, subcategory: string): string[] {
  const sub = asBranch(asBranch(TREE[category])[subcategory]);
  const types = new Set<string>();
  for (const [typeKey, variants] of Object.entries(sub)) {
    types.add(typeKey);
    if (Array.isArray(variants)) variants.forEach((v) => types.add(v));
  }
  return Array.from(types);
}

/**
 * Third-level type keys under a (category, subcategory) — the real types,
 * WITHOUT flattening their 4th-level sub-types. Drives the form's Type
 * dropdown; types that carry sub-types reveal a Sub-type dropdown (see
 * `getSubtypes`).
 */
export function getTypeKeys(category: string, subcategory: string): string[] {
  return Object.keys(asBranch(asBranch(TREE[category])[subcategory]));
}

/**
 * Fourth-level sub-types under a specific type (e.g. Phone → Telephone, IP
 * Phone…), or `[]` when the type has no finer breakdown.
 */
export function getSubtypes(
  category: string,
  subcategory: string,
  type: string,
): string[] {
  const sub = asBranch(asBranch(TREE[category])[subcategory]);
  const variants = sub[type];
  return Array.isArray(variants) ? [...variants] : [];
}

/** Every leaf type across the whole taxonomy, sorted — used by the register facet. */
export const ALL_TYPES: string[] = (() => {
  const set = new Set<string>();
  for (const category of MAIN_CATEGORIES) {
    for (const sub of getSubcategories(category)) {
      for (const t of getTypes(category, sub)) set.add(t);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
})();

/** The taxonomy number assigned to a category / subcategory / type name. */
export function getCategoryNumber(name: string): number | undefined {
  return NUMBERS[name];
}

/** Main category that owns a given leaf type (case-insensitive). */
export function findCategoryForType(type: string): string | undefined {
  const needle = type.trim().toLowerCase();
  for (const category of MAIN_CATEGORIES) {
    for (const sub of getSubcategories(category)) {
      for (const t of getTypes(category, sub)) {
        if (t.trim().toLowerCase() === needle) return category;
      }
    }
  }
  return undefined;
}

/** Subcategory that owns a given leaf type within a category (case-insensitive). */
export function findSubcategoryForType(
  category: string,
  type: string,
): string | undefined {
  const needle = type.trim().toLowerCase();
  for (const sub of getSubcategories(category)) {
    for (const t of getTypes(category, sub)) {
      if (t.trim().toLowerCase() === needle) return sub;
    }
  }
  return undefined;
}

/** Main category that owns a given subcategory name (case-insensitive). */
export function findCategoryForSubcategory(
  subcategory: string,
): string | undefined {
  const needle = subcategory.trim().toLowerCase();
  for (const category of MAIN_CATEGORIES) {
    for (const sub of getSubcategories(category)) {
      if (sub.trim().toLowerCase() === needle) return category;
    }
  }
  return undefined;
}

// ----- Category normalisation (import hardening) -----
//
// The source register's "Catergory:" cells are hand-typed and messy: stray
// label prefixes ("Name:Plant…"), "&"/spelling variants ("Furniture, Fixture &
// Fittings"), subcategory names used as the category ("Office Equipment and
// Machinery"), and leading whitespace. `normalizeCategoryLabel` snaps these to
// the canonical `MAIN_CATEGORIES` where possible so imports come in clean.

/** Loose match key: lowercase, "&" → "and", strip punctuation, collapse spaces. */
function categoryKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const CANONICAL_BY_KEY: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const c of MAIN_CATEGORIES) map[categoryKey(c)] = c;
  return map;
})();

// Known source-spelling variants → canonical main category. Add new ones here
// as they surface; keys are matched via `categoryKey` so spacing/punctuation/
// case don't matter.
const CATEGORY_ALIAS_BY_KEY: Record<string, string> = (() => {
  const aliases: [string, string][] = [
    ["Furniture, Fixture & Fittings", "Furniture, Fixtures and Fittings"],
    [
      "Machineries, Equipments, Software & ICT Hardwares",
      "Plant, Machineries, Equipments, Software and IT Hardware",
    ],
    [
      "Machineries, Equipments, Software & ICT Hardware",
      "Plant, Machineries, Equipments, Software and IT Hardware",
    ],
  ];
  const map: Record<string, string> = {};
  for (const [from, to] of aliases) map[categoryKey(from)] = to;
  return map;
})();

export type NormalizedCategory = {
  category: string;
  /** How it resolved — for transparency in the import preview. */
  via: "canonical" | "alias" | "subcategory" | "cleaned";
};

/**
 * Clean and (where possible) canonicalise a raw category label read from a
 * sheet. Order: strip stray prefixes / whitespace → exact canonical → known
 * alias → subcategory's parent → otherwise the cleaned label (never dropped).
 * Idempotent: a canonical value normalises to itself.
 */
export function normalizeCategoryLabel(raw: string): NormalizedCategory {
  let cleaned = (raw ?? "").replace(/\s+/g, " ").trim();
  // Strip one or more leading "Name:" / "Category:" / "Catergory:" prefixes.
  let prev: string;
  do {
    prev = cleaned;
    cleaned = cleaned
      .replace(/^(name|category|catergory)\s*:\s*/i, "")
      .trim();
  } while (cleaned !== prev);

  if (!cleaned) return { category: cleaned, via: "cleaned" };

  const key = categoryKey(cleaned);
  if (CANONICAL_BY_KEY[key]) {
    return { category: CANONICAL_BY_KEY[key], via: "canonical" };
  }
  if (CATEGORY_ALIAS_BY_KEY[key]) {
    return { category: CATEGORY_ALIAS_BY_KEY[key], via: "alias" };
  }
  const parent = findCategoryForSubcategory(cleaned);
  if (parent) return { category: parent, via: "subcategory" };

  return { category: cleaned, via: "cleaned" };
}
