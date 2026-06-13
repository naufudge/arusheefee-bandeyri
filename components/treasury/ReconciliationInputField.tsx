import React from "react";
import { cn } from "@/lib/utils";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Control, UseFormSetValue } from "react-hook-form";
import {
  ReconciliationSchema,
  ReconciliationValues,
} from "@/schemas/ReconciliationSchema";
import { Staff } from "@/types";
import { z } from "zod";

// RTL Thaana styling for Dhivehi text inputs (left-aligned).
const dhivehiInputStyle: React.CSSProperties = {
  fontFamily: "var(--font-faruma), sans-serif",
  direction: "rtl",
  textAlign: "left",
};

interface ReconInputFieldProps {
  control: Control<ReconciliationValues>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  name: any;
  label?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  className?: string;
  description?: string;
  /** Render the input right-to-left in the Faruma (Thaana) font. */
  dhivehi?: boolean;
}

export const ReconInputField: React.FC<ReconInputFieldProps> = ({
  control,
  name,
  label,
  placeholder,
  type,
  disabled,
  className,
  description,
  dhivehi,
}) => {
  if (String(name).toLowerCase().includes("date")) {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className={className}>
            {label && <FormLabel>{label}</FormLabel>}
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    disabled={disabled}
                    className={cn(
                      "w-full pl-3 text-left font-normal justify-between",
                      !field.value && "text-muted-foreground",
                    )}
                  >
                    {field.value ? (
                      format(field.value, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                    <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value ?? undefined}
                  onSelect={field.onChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {description && (
              <FormDescription className="text-xs">
                {description}
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              type={type}
              placeholder={placeholder ?? label}
              disabled={disabled}
              lang={dhivehi ? "dv" : undefined}
              dir={dhivehi ? "rtl" : undefined}
              style={dhivehi ? dhivehiInputStyle : undefined}
            />
          </FormControl>
          {description && (
            <FormDescription className="text-xs">{description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

type ReconStaffDropDownProps = {
  control: Control<ReconciliationValues>;
  name: "preparedBy" | "checkedBy" | "authorizedBy";
  label?: string;
  className?: string;
  staffs: Staff[];
  formSetValue: UseFormSetValue<z.infer<typeof ReconciliationSchema>>;
};

export const ReconStaffDropDownField: React.FC<ReconStaffDropDownProps> = ({
  control,
  name,
  label,
  className,
  staffs,
  formSetValue,
}) => {
  const selectableStaffs = staffs.filter(
    (s) => s.designation && s.designation.trim() !== "",
  );

  const handleStaffSelection = (staffName: string) => {
    const staff = staffs.find((s) => s.name === staffName);
    if (staff) {
      formSetValue(`${name}.name`, staff.name);
      formSetValue(`${name}.designation`, staff.designation);
    }
  };

  return (
    <FormField
      control={control}
      name={`${name}.name`}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <Select
            onValueChange={handleStaffSelection}
            defaultValue={field.value}
            value={field.value}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={"Select a staff member"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {selectableStaffs.map((staff, index) => (
                <SelectItem key={index} value={staff.name}>
                  {staff.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
