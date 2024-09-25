import React from 'react'
import { cn } from "@/lib/utils"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { Control } from 'react-hook-form'
import { PvValues } from "@/lib/PvSchema";


const FieldNames = {
    pvNum: "PV Number",
    businessArea: "Business Area",
    agency: "Agency",
    vendor: "Vendor",
    date: "Date",
    notes: "Note(s)",
    currency: "Currency",
    exchangeRate: "Exchange Rate",

    numOfInvoice: "Number of Invoices",
    invoiceNumber: "Invoice Number",
    invoiceDate: "Invoice Date",
    invoiceTotal: "Invoice Total",

    comments: "Comment(s)"
}

interface PvInputFieldProps {
    control: Control<PvValues>;
    name: any;
    label: string;
    disabled?: boolean;
    className?: string;
}

const PvInputField: React.FC<PvInputFieldProps> = ({ control, name, label, disabled, className }) => {
    if (name.toLowerCase().includes("date")) {
        return (
            <FormField
                control={control}
                name="date"
                render={({ field }) => (
                <FormItem className={className}>
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
        )
    }

    return (
        <FormField
            disabled={disabled ? true : false}
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem className={className}>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                    <Input placeholder={label} {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
        />
    )
}

export default PvInputField