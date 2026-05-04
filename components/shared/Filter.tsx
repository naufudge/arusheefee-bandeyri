import React, { Dispatch, SetStateAction, useState } from "react";
import { FilterIcon, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import FilterOption from "./FilterOption";
import { FilterType } from "@/types";

interface FilterProps {
  vendors?: string[];
  filters: FilterType;
  setFilters: Dispatch<SetStateAction<FilterType>>;
}

const Filter: React.FC<FilterProps> = ({ vendors, filters, setFilters }) => {
  const [open, setOpen] = useState(false);
  const isClean = !filters.vendor && !filters.status;
  const activeCount = (filters.vendor ? 1 : 0) + (filters.status ? 1 : 0);

  const handleClearFilter = () => {
    setFilters((prev) => ({ ...prev, vendor: "", status: "" }));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
        >
          <FilterIcon className="size-4" />
          Filter
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 font-mono text-[10px] font-medium tabular-nums text-background">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-md border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid gap-5">
          <div className="space-y-1">
            <h4 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Filter PVs
            </h4>
            <p className="text-xs text-muted-foreground">
              Narrow vouchers by vendor or status.
            </p>
          </div>

          <div className="grid gap-4">
            <FilterOption
              label="Vendor"
              placeholder="Any vendor"
              selectItems={vendors}
              selectedValue={filters.vendor}
              setSelect={(value) => setFilters({ ...filters, vendor: value })}
            />

            <FilterOption
              label="Status"
              placeholder="Any status"
              selectItems={["pending", "processed"]}
              selectedValue={filters.status}
              setSelect={(value) => setFilters({ ...filters, status: value })}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button
              disabled={isClean}
              onClick={handleClearFilter}
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <FilterX className="size-3.5" />
              Clear
            </Button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 items-center rounded-md border bg-background px-3 text-xs font-medium transition hover:bg-muted"
            >
              Done
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default Filter;
