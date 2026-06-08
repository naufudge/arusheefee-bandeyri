"use client";

import React, { useMemo, useState } from "react";
import { Check, FilterX, Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

// Multi-select facets are arrays; price is a min/max range (kept as strings so
// an empty input stays empty rather than coercing to 0). Subcategory and year
// aren't stored columns — the register derives them (see asset-register page).
export type AssetFilters = {
  categories: string[];
  subcategories: string[];
  types: string[];
  conditions: string[];
  locations: string[];
  years: string[];
  priceMin: string;
  priceMax: string;
};

export const EMPTY_ASSET_FILTERS: AssetFilters = {
  categories: [],
  subcategories: [],
  types: [],
  conditions: [],
  locations: [],
  years: [],
  priceMin: "",
  priceMax: "",
};

/** Total number of active selections (price range counts as one). */
export function countActiveFilters(f: AssetFilters): number {
  return (
    f.categories.length +
    f.subcategories.length +
    f.types.length +
    f.conditions.length +
    f.locations.length +
    f.years.length +
    (f.priceMin.trim() !== "" || f.priceMax.trim() !== "" ? 1 : 0)
  );
}

// The multi-select array keys (everything except the price range).
type ArrayKey = Exclude<keyof AssetFilters, "priceMin" | "priceMax">;

/**
 * A labelled group of toggle pills for one facet. Pure inline elements (no
 * portals/Selects), so clicking never dismisses the surrounding panel — the
 * whole reason this replaced the Popover+Select filter. Long facets (Type,
 * Location) get a search box and a capped scroll area.
 */
const MultiSelectFilter: React.FC<{
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  emptyHint?: string;
}> = ({ label, options, selected, onToggle, emptyHint }) => {
  const [search, setSearch] = useState("");
  const showSearch = options.length > 12;
  const visible = useMemo(() => {
    if (!showSearch || !search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search, showSearch]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        {selected.length > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {selected.length} selected
          </span>
        )}
      </div>

      {showSearch && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="h-9 pl-8 text-sm sm:h-8 sm:text-xs"
          />
        </div>
      )}

      {options.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          {emptyHint ?? "No options"}
        </p>
      ) : (
        <div
          className={`flex flex-wrap gap-1.5 ${
            showSearch ? "max-h-44 overflow-y-auto pr-1" : ""
          }`}
        >
          {visible.map((opt) => {
            const isSel = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onToggle(opt)}
                aria-pressed={isSel}
                className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition sm:py-1 ${
                  isSel
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {isSel && <Check className="size-3 shrink-0" />}
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="text-xs italic text-muted-foreground">No matches.</p>
          )}
        </div>
      )}
    </div>
  );
};

interface AssetFilterProps {
  categoryOptions: string[];
  subcategoryOptions: string[];
  typeOptions: string[];
  conditionOptions: string[];
  locationOptions: string[];
  yearOptions: string[];
  filters: AssetFilters;
  setFilters: (next: AssetFilters) => void;
  onClear: () => void;
}

/**
 * Inline filter panel body for the Asset Register. Rendered inside a
 * Collapsible on the page (the page owns the trigger button + open state);
 * cascading option lists are computed there and passed in.
 */
const AssetFilter: React.FC<AssetFilterProps> = ({
  categoryOptions,
  subcategoryOptions,
  typeOptions,
  conditionOptions,
  locationOptions,
  yearOptions,
  filters,
  setFilters,
  onClear,
}) => {
  const activeCount = countActiveFilters(filters);

  const toggle = (key: ArrayKey, value: string) => {
    const arr = filters[key];
    const next = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value];
    setFilters({ ...filters, [key]: next });
  };

  const setPrice = (key: "priceMin" | "priceMax", raw: string) => {
    // Allow only digits and a single decimal point.
    const cleaned = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    setFilters({ ...filters, [key]: cleaned });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <MultiSelectFilter
          label="Category"
          options={categoryOptions}
          selected={filters.categories}
          onToggle={(v) => toggle("categories", v)}
        />
        <MultiSelectFilter
          label="Subcategory"
          options={subcategoryOptions}
          selected={filters.subcategories}
          onToggle={(v) => toggle("subcategories", v)}
          emptyHint={
            filters.categories.length
              ? "No subcategories in this selection"
              : "Select a category to narrow"
          }
        />
        <MultiSelectFilter
          label="Type"
          options={typeOptions}
          selected={filters.types}
          onToggle={(v) => toggle("types", v)}
          emptyHint="No types in this selection"
        />
        <MultiSelectFilter
          label="Condition"
          options={conditionOptions}
          selected={filters.conditions}
          onToggle={(v) => toggle("conditions", v)}
        />
        <MultiSelectFilter
          label="Present location"
          options={locationOptions}
          selected={filters.locations}
          onToggle={(v) => toggle("locations", v)}
        />
        <MultiSelectFilter
          label="Acquired year"
          options={yearOptions}
          selected={filters.years}
          onToggle={(v) => toggle("years", v)}
        />

        {/* Price range */}
        <div className="space-y-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Price (MVR)
          </span>
          <div className="flex items-center gap-2">
            <Input
              inputMode="decimal"
              placeholder="Min"
              value={filters.priceMin}
              onChange={(e) => setPrice("priceMin", e.target.value)}
              className="h-9 font-mono text-sm tabular-nums sm:h-8 sm:text-xs"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              inputMode="decimal"
              placeholder="Max"
              value={filters.priceMax}
              onChange={(e) => setPrice("priceMax", e.target.value)}
              className="h-9 font-mono text-sm tabular-nums sm:h-8 sm:text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-4">
        <span className="text-xs text-muted-foreground">
          {activeCount === 0
            ? "No filters applied"
            : `${activeCount} active filter${activeCount === 1 ? "" : "s"}`}
        </span>
        <button
          type="button"
          onClick={onClear}
          disabled={activeCount === 0}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FilterX className="size-3.5" />
          Clear all
        </button>
      </div>
    </div>
  );
};

export default AssetFilter;
