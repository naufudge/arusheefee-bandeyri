import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { capitalizeFirstLetter } from "@/utils/helpers";

interface FilterOptionProps {
  label: string;
  placeholder: string;
  selectItems?: string[];
  setSelect: (value: string) => void;
  selectedValue: string;
}

const FilterOption: React.FC<FilterOptionProps> = ({
  label,
  placeholder,
  setSelect,
  selectedValue,
  selectItems,
}) => {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={label}
        className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
      </label>
      <Select onValueChange={setSelect} value={selectedValue}>
        <SelectTrigger
          id={label}
          className={`h-9 w-full text-sm ${
            selectedValue ? "border-foreground" : ""
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent id={label} onClick={(e) => e.stopPropagation()}>
          {selectItems?.map((item, index) => (
            <SelectItem
              key={index}
              value={item}
              className="cursor-pointer text-sm"
            >
              {capitalizeFirstLetter(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default FilterOption;
