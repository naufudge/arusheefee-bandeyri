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
import { Input } from "@/components/ui/input";
import { Control } from "react-hook-form";
import { GsrValues } from "@/schemas/GsrSchema";

// RTL Thaana (Dhivehi) form field. Renders right-to-left with the Faruma
// font (loaded globally as `--font-faruma` on the (home) layout body), used
// for the GSR `section` and per-item `remarks` which are written in Dhivehi.
// No bidi shaping is needed — Thaana is a simple RTL script.
interface RtlDhivehiInputProps {
  control: Control<GsrValues>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  name: any;
  label?: string;
  placeholder?: string;
  className?: string;
  description?: string;
  multiline?: boolean;
  hideLabel?: boolean;
}

const RTL_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-faruma), sans-serif",
  direction: "rtl",
  textAlign: "left",
};

export const RtlDhivehiInput: React.FC<RtlDhivehiInputProps> = ({
  control,
  name,
  label,
  placeholder,
  className,
  description,
  multiline,
  hideLabel,
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {!hideLabel && label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            {multiline ? (
              <textarea
                {...field}
                value={field.value ?? ""}
                placeholder={placeholder}
                lang="dv"
                dir="rtl"
                rows={2}
                style={RTL_STYLE}
                className={cn(
                  "flex min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              />
            ) : (
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder={placeholder}
                lang="dv"
                dir="rtl"
                style={RTL_STYLE}
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
