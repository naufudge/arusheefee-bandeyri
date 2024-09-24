"use client";

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import { z } from 'zod'
import { CalendarIcon, Plus, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { PvSchema, PvValues } from "@/lib/PvSchema";
import GLForm from "./GLForm";


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


const PvForm = () => {
  const form = useForm<z.infer<typeof PvSchema>>({
    resolver: zodResolver(PvSchema),
    defaultValues: {
      pvNum: 0,
      businessArea: 1506,
      agency: "National Archives of Maldives",
      vendor: "",
      date: new Date(),
      notes: "",
      currency: "MVR",
      exchangeRate: 1,
      numOfInvoice: 1,

      invoiceDetails: [{
        comments: "",
        invoiceNumber: "",
        invoiceTotal: 0,
        glDetails: [{
          code: 0,
          fund: "C-GOM",
          amount: 0
        }]
      }],

      preparedBy: {name: "", designation: ""},
      verifiedBy: {name: "", designation: ""},
      authorisedByOne: {name: "", designation: ""},
      authorisedByTwo: {name: "", designation: ""},
    }
  })

  const control = form.control

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'invoiceDetails',
  });

  const onSubmit = (values: z.infer<typeof PvSchema>) => {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7">

        <div className="grid grid-cols-3 gap-4">
          {/* Business Area */}
          <FormField
            control={form.control}
            name="businessArea"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{FieldNames[field.name]}</FormLabel>
                <FormControl>
                  <Input placeholder={FieldNames[field.name]} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Vendor */}
          <FormField
            control={form.control}
            name="vendor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{FieldNames[field.name]}</FormLabel>
                <FormControl>
                  <Input placeholder={FieldNames[field.name]} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* PV Number */}
          <FormField
            disabled
            control={form.control}
            name="pvNum"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{FieldNames[field.name]}</FormLabel>
                <FormControl>
                  <Input placeholder={FieldNames[field.name]} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Agency */}
            <FormField
              control={form.control}
              name="agency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{FieldNames[field.name]}</FormLabel>
                  <FormControl>
                    <Input placeholder={FieldNames[field.name]} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          {/* PV Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col justify-center mt-2">
                <FormLabel>{FieldNames[field.name]}</FormLabel>
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
        </div>
        
        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{FieldNames[field.name]}</FormLabel>
              <FormControl>
                <Input placeholder={FieldNames[field.name]} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          {/* Currency */}
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{FieldNames[field.name]}</FormLabel>
                <FormControl>
                  <Input type="text" placeholder={FieldNames[field.name]} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Exchange Rate */}
          <FormField
            control={form.control}
            name="exchangeRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{FieldNames[field.name]}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder={FieldNames[field.name]} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numOfInvoice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{FieldNames[field.name]}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder={FieldNames[field.name]} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Invoice Section */}
        <div className="transition-all duration-150">
          {fields.map((item, index) => (
            <div key={item.id} className="grid grid-cols-2 gap-4 mb-7 bg-slate-50 p-5 pb-8 rounded-xl drop-shadow-md">
              <div className="flex col-span-3 font-bold text-xl justify-between w-full">
                <div>Invoice #{index + 1}</div>
                {/* Show delete button starting from Invoice #2 */}
                {index != 0 && 
                  <Button 
                  type="button"
                  variant="destructive"
                  onClick={() => remove(index)}>
                      <Trash2 width={20} height={20}/>
                  </Button>
                }
              </div>
              <FormField
                control={control}
                name={`invoiceDetails.${index}.comments`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2 col-span-3">
                    <FormLabel>Comments</FormLabel>
                    <FormControl>
                      <Input placeholder="Comments" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`invoiceDetails.${index}.invoiceNumber`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Invoice Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Invoice Number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`invoiceDetails.${index}.invoiceDate`}
                render={({ field }) => (
                  <FormItem className="flex flex-col justify-center gap-2">
                    <FormLabel>Invoice Date</FormLabel>
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

              <FormField
                control={control}
                name={`invoiceDetails.${index}.invoiceTotal`}
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>Invoice Total</FormLabel>
                    <FormControl>
                      <Input placeholder="Invoice Total" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* GL Section */}
              <GLForm className="col-span-3" nestIndex={index} control={control} />
            </div>
          ))}
          {/* Add invoice button */}
          <Button type="button" variant="outline" className="flex gap-2" 
            onClick={() => {append(
              { comments: "",
                invoiceNumber: "",
                invoiceDate: new Date(),
                invoiceTotal: 0,
                glDetails: [{
                  code: 0,
                  fund: "C-GOM",
                  amount: 0
                }]
              })}
            }>
            <Plus width={20} height={20} />Invoice
          </Button>
        </div>

        <div>
            
        </div>

        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}


export default PvForm