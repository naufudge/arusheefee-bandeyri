import React, { Dispatch, SetStateAction } from "react";
import { FilterIcon, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import FilterOption from "./FilterOption";
import { FilterType } from "@/lib/MyTypes";

interface FilterProps {
  vendors?: string[];
  filters: FilterType;
  setFilters: Dispatch<SetStateAction<FilterType>>;
  handleFilter: () => void;
}

const Filter: React.FC<FilterProps> = ({ vendors, filters, setFilters, handleFilter }) => {
  const defaultFilters: FilterType = {
    year: new Date().getFullYear(),
    vendor: "",
    status: "",
    gl: 0,
  }

  const handleClearFilter = () => {
    setFilters(defaultFilters);
    
    setTimeout(
      () => handleFilter(),
      1100
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="gap-3" variant={"outline"}>
          <FilterIcon width={20} height={20} /> Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96" onClick={(e) => e.stopPropagation()}>
        <div className="grid gap-5">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Filter PVs</h4>
            <p className="text-sm text-muted-foreground">
              Filter PVs by specific fields.
            </p>
          </div>

          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-5">
              {/* Vendor Filter */}
              <FilterOption
                label="Vendor"
                placeholder="Select a Vendor"
                selectItems={vendors}
                selectedValue={filters.vendor}
                setSelect={(value) => setFilters({ ...filters, vendor: value })}
              />

              {/* Pending or Proccessed Filter */}
              <FilterOption
                label="Status"
                placeholder="Select Status"
                selectItems={["pending", "processed"]}
                selectedValue={filters.status}
                setSelect={(value) => setFilters({ ...filters, status: value })}
              />
              
              {/* Pending or Proccessed Filter */}
              <FilterOption
                label="Year"
                placeholder="Select Year"
                selectItems={["2024", "2025"]}
                selectedValue={filters.year.toString()}
                setSelect={(value) => setFilters({ ...filters, year: value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 h-fit">
            <Button
            disabled={filters === defaultFilters} 
            onClick={handleClearFilter} 
            variant={"outline"}
            className="w-fit"><FilterX /> Clear Filter</Button>
  
            <Button onClick={handleFilter}>Apply Filter</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default Filter;
