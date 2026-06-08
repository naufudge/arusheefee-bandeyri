"use client";

import React from "react";
import type { UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AssetValues } from "@/schemas/AssetSchema";

interface AssetDateFieldProps {
  form: UseFormReturn<AssetValues>;
}

/**
 * "Acquired" date input with a Year ⇄ Full date toggle. Most register rows
 * record only a year (e.g. 2015), so YEAR is the default; FULL switches to a
 * calendar. The chosen mode drives `datePrecision` and either `year` or
 * `date`; AssetForm derives the stored DateTime on submit.
 */
export const AssetDateField: React.FC<AssetDateFieldProps> = ({ form }) => {
  const precision = form.watch("datePrecision");
  const year = form.watch("year");
  const date = form.watch("date");
  const errors = form.formState.errors;

  const setMode = (mode: "YEAR" | "FULL") => {
    form.setValue("datePrecision", mode, { shouldValidate: true });
  };

  return (
    <div className="space-y-2">
      <div className="flex min-h-5 items-center justify-between">
        <Label>Acquired</Label>
        {/* Mode toggle */}
        <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setMode("YEAR")}
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-xs font-medium transition",
              precision === "YEAR"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Year
          </button>
          <button
            type="button"
            onClick={() => setMode("FULL")}
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-xs font-medium transition",
              precision === "FULL"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Full date
          </button>
        </div>
      </div>

      {precision === "YEAR" ? (
        <Input
          inputMode="numeric"
          maxLength={4}
          placeholder="e.g. 2015"
          value={year ?? ""}
          onChange={(e) =>
            form.setValue("year", e.target.value.replace(/[^\d]/g, ""), {
              shouldValidate: true,
            })
          }
          className="font-mono tabular-nums"
        />
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-between pl-3 text-left font-normal",
                !date && "text-muted-foreground",
              )}
            >
              {date ? format(date, "PPP") : <span>Pick a date</span>}
              <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date ?? undefined}
              onSelect={(d) =>
                form.setValue("date", d ?? null, { shouldValidate: true })
              }
              disabled={(d) =>
                d > new Date() || d < new Date("1900-01-01")
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}

      <p className="text-[11px] text-muted-foreground">
        {precision === "YEAR"
          ? "Recording the year only — leave blank if unknown."
          : "Recording an exact acquisition date."}
      </p>
      {errors.year && (
        <p className="text-[0.8rem] font-medium text-destructive">
          {errors.year.message}
        </p>
      )}
    </div>
  );
};

export default AssetDateField;
