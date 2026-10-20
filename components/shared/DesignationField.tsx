"use client";

import React, { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The picked staff member's designation, read-only under a name-only staff
 * picker. Every signatory picker shows it this way (as the PV form does).
 */
export function DesignationField({ value, className }: { value: string | null | undefined; className?: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>Designation</Label>
      <Input id={id} value={value ?? ""} placeholder="Designation" disabled />
    </div>
  );
}
