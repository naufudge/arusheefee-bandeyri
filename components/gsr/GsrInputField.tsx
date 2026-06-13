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
import { GsrSchema, GsrValues } from "@/schemas/GsrSchema";
import { Staff } from "@/types";
import { z } from "zod";

interface GsrInputFieldProps {
  control: Control<GsrValues>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  name: any;
  label?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  register?: UseFormRegister<GsrValues>;
  description?: string;
  hideLabel?: boolean;
}

export const GsrInputField: React.FC<GsrInputFieldProps> = ({
  control,
  name,
  label,
  placeholder,
  type,
  disabled,
  className,
  description,
  hideLabel,
}) => {
  // Treat any field whose name contains "date" as a date picker (matches
  // the form's `date` and per-item `rqdDate`). `name` is intentionally `any`
  // (RHF path strings) so it isn't narrowed to a literal-string union here.
  if (String(name).toLowerCase().includes("date")) {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className={className}>
            {!hideLabel && label && <FormLabel>{label}</FormLabel>}
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
          {!hideLabel && label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input
              {...field}
              value={field.value ?? ""}
              type={type}
              placeholder={placeholder ?? label}
              disabled={disabled}
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

type GsrStaffDropDownProps = {
  control: Control<GsrValues>;
  name: "requestedBy" | "authorizedBy" | "receivedBy";
  label?: string;
  className?: string;
  description?: string;
  staffs: Staff[];
  formSetValue: UseFormSetValue<z.infer<typeof GsrSchema>>;
};

export const GsrStaffDropDownField: React.FC<GsrStaffDropDownProps> = ({
  control,
  name,
  label,
  className,
  description,
  staffs,
  formSetValue,
}) => {
  // Hide partially-synced tenant users (Azure entries with no jobTitle come
  // through with designation = "").
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
          {description && (
            <FormDescription className="text-xs">{description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
