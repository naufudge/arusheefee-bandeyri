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
import { Control, UseFormRegister, UseFormSetValue } from "react-hook-form";
import {
  PettyCashSchema,
  PettyCashValues,
  PettyCashRoleName,
} from "@/schemas/PettyCashSchema";
import { Staff } from "@/types";
import { z } from "zod";

interface PettyCashInputFieldProps {
  control: Control<PettyCashValues>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  name: any;
  label: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  register?: UseFormRegister<PettyCashValues>;
  description?: string;
  type?: "text" | "number";
}

export const PettyCashInputField: React.FC<PettyCashInputFieldProps> = ({
  control,
  name,
  label,
  disabled,
  className,
  required,
  register,
  description,
  type,
}) => {
  // Date picker — triggered by any field whose name includes "date".
  if (typeof name === "string" && name.toLowerCase().includes("date")) {
    return (
      <FormField
        control={control}
        name={name as never}
        render={({ field }) => {
          const dateValue = field.value as Date | null | undefined;
          return (
            <FormItem className={className}>
              <FormLabel>{label}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      disabled={disabled}
                      className={cn(
                        "w-full pl-3 text-left font-normal justify-between",
                        !dateValue && "text-muted-foreground",
                      )}
                    >
                      {dateValue ? (
                        format(dateValue, "PPP")
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
                    selected={dateValue ?? undefined}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date("1900-01-01")}
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
          );
        }}
      />
    );
  }

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {register ? (
              <Input
                {...register(name, { required })}
                {...field}
                type={type ?? "text"}
                placeholder={label}
                disabled={!!disabled}
              />
            ) : (
              <Input
                {...field}
                value={field.value ?? ""}
                type={type ?? "text"}
                placeholder={label}
                disabled={!!disabled}
              />
            )}
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

type StaffDropDownProps = Omit<PettyCashInputFieldProps, "name"> & {
  name: PettyCashRoleName;
  staffs: Staff[];
  formSetValue: UseFormSetValue<z.infer<typeof PettyCashSchema>>;
};

export const PettyCashStaffDropDownField: React.FC<StaffDropDownProps> = ({
  control,
  name,
  label,
  className,
  description,
  staffs,
  formSetValue,
}) => {
  // Hide partially-synced tenant users (Azure entries with no jobTitle
  // come through with designation = ""). The Settings → Staff page still
  // shows them so an admin can fill in a designation; here they're noise.
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
          <FormLabel>{label}</FormLabel>
          <Select
            onValueChange={handleStaffSelection}
            defaultValue={field.value}
            value={field.value}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a staff member" />
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
          {description && (
            <FormDescription className="text-xs">{description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
