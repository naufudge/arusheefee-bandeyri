import { PERMISSIONS, type Permission } from "@/lib/permissions";

// Modules the global search covers, in the order their groups are shown.
export const SEARCH_MODULES = [
  "pv",
  "pettycash",
  "gsr",
  "pcrecon",
  "priceeval",
  "assetcreation",
  "asset",
  "procurement",
  "cea",
] as const;

export type SearchModule = (typeof SEARCH_MODULES)[number];

// A module is searched only for users who can read it.
export const SEARCH_MODULE_PERMISSION: Record<SearchModule, Permission> = {
  pv: PERMISSIONS.PV_READ,
  pettycash: PERMISSIONS.PETTYCASH_READ,
  gsr: PERMISSIONS.GSR_READ,
  pcrecon: PERMISSIONS.PCRECON_READ,
  priceeval: PERMISSIONS.PRICEEVAL_READ,
  assetcreation: PERMISSIONS.ASSETCREATION_READ,
  asset: PERMISSIONS.ASSET_READ,
  procurement: PERMISSIONS.PROCUREMENT_READ,
  cea: PERMISSIONS.CEA_READ,
};

export const SEARCH_MODULE_LABEL: Record<SearchModule, string> = {
  pv: "Payment vouchers",
  pettycash: "Petty cash",
  gsr: "GSR forms",
  pcrecon: "PC reconciliations",
  priceeval: "Price evaluations",
  assetcreation: "Asset creation forms",
  asset: "Asset register",
  procurement: "Procurements",
  cea: "CEA forms",
};

/** Results per group in the mixed view, and when scoped to one module. */
export const SEARCH_LIMIT = 5;
export const SEARCH_SCOPED_LIMIT = 25;

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
