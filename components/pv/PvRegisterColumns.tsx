"use client"

import { PvValues } from "@/schemas/PvSchema"
import { ColumnDef } from "@tanstack/react-table"

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Payment = {
  id: string
  amount: number
  status: "pending" | "processing" | "success" | "failed"
  email: string
}

export const columns: ColumnDef<PvValues>[] = [
  {
    accessorKey: "pvNum",
    header: "PV No.",
  },
  {
    accessorKey: "notes",
    header: "Description",
  },
  {
    accessorKey: "vendor",
    header: "Vendor",
  },
  {
    accessorKey: "vendor",
    header: "Vendor",
  },
]
