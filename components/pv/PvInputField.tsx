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
import { PvSchema, PvValues } from "@/schemas/PvSchema";
import { Staff } from "@/types";
import { z } from "zod";

interface PvInputFieldProps {
  control: Control<PvValues>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  name: any;
  label: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  register?: UseFormRegister<PvValues>;
  description?: string;
}

export const PvInputField: React.FC<PvInputFieldProps> = ({
  control,
  name,
  label,
  disabled,
  className,
  required,
  register,
  description,
}) => {
  if (name.toLowerCase().includes("date")) {
    // If it's a date field
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className={`${className}`}>
            <FormLabel>{label}</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full pl-3 text-left font-normal justify-between",
                      !field.value && "text-muted-foreground"
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
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
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
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {register ? (
              <Input
                {...register(name, { required: required })}
                {...field}
                placeholder={label}
                disabled={disabled ? true : false}
                // required={required}
              />
            ) : (
              <Input
                {...field}
                placeholder={label}
                disabled={disabled ? true : false}
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

type DropDownFieldProps = Partial<PvInputFieldProps> & {
  options: string[];
  placeholder: string;
  customHandler?: (value: string) => void;
};

export const PVDropDownField: React.FC<DropDownFieldProps> = ({
  control,
  name,
  label,
  className,
  description,
  options,
  placeholder,
  customHandler,
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <Select
            onValueChange={customHandler ? customHandler : field.onChange}
            defaultValue={field.value}
            value={field.value}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
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

type StaffDropDownProps = Omit<PvInputFieldProps, "name"> & {
    name: "preparedBy" | "verifiedBy" | "authorisedByOne" | "authorisedByTwo"
    staffs: Staff[];
    formSetValue: UseFormSetValue<z.infer<typeof PvSchema>>;
};

export const StaffDropDownField: React.FC<StaffDropDownProps> = ({
  control,
  name,
  label,
  className,
  description,
  staffs,
  formSetValue
}) => {
  // Handle Staff Selection
  const hanelStaffSelection = (staffName: string) => {
    const staff = staffs.find((staff) => staff.name === staffName)
    if (staff) {
        formSetValue(`${name}.name`, staff.name)
        formSetValue(`${name}.designation`, staff.designation)
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
            onValueChange={hanelStaffSelection}
            defaultValue={field.value}
            value={field.value}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={"Select a Staff"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {staffs.map((staff, index) => (
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
