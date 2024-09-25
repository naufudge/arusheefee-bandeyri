"use client";

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useFieldArray } from "react-hook-form"
import { z } from 'zod'
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import { PvSchema } from "@/lib/PvSchema";
import GLForm from "@/components/GLForm";
import PvInputField from "@/components/PvInputField";

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

      preparedBy: {name: "Sharumeela Abdul Fatah", designation: "Accounts Officer"},
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
          <PvInputField control={control} name={"businessArea"} label="Business Area" />

          {/* Vendor */}
          <PvInputField control={control} name={"vendor"} label="Vendor" />
          

          {/* PV Number */}
          <PvInputField control={control} name={"pvNum"} label="PV Number" disabled={true} />
          
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Agency */}
          <PvInputField control={control} name={"agency"} label="Agency" />
            

          {/* PV Date */}
          <PvInputField control={control} name={"date"} label="Date" />

        </div>
        
        {/* Notes */}
        <PvInputField control={control} name={"notes"} label="Note(s)" />

        <div className="grid grid-cols-3 gap-4">
          {/* Currency */}
          <PvInputField control={control} name={"currency"} label="Currency" />

          {/* Exchange Rate */}
          <PvInputField control={control} name={"exchangeRate"} label="Exchange Rate" />

          {/* Number of Invoice(s) */}
          <PvInputField control={control} name={"numOfInvoice"} label="No. of Invoices" />
        </div>

        {/* Invoice Section */}
        <div className="transition-all duration-150">
          {fields.map((item, index) => (
            <div key={item.id} className="grid grid-cols-4 gap-4 mb-7 bg-slate-50 p-5 pb-8 rounded-xl drop-shadow-md">
              <div className="flex col-span-4 font-bold text-xl justify-between w-full">
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
              {/* Comment(s) */}
              <PvInputField control={control} name={`invoiceDetails.${index}.comments`} label="Comments" className="flex flex-col gap-2 col-span-4" />
              
              {/* Invoice Date */}
              <PvInputField control={control} name={`invoiceDetails.${index}.invoiceDate`} label="Invoice Date" className="flex flex-col justify-start gap-2 col-span-2" />
              
              {/* Invoice Number */}
              <PvInputField control={control} name={`invoiceDetails.${index}.invoiceNumber`} label="Invoice Number" className="flex flex-col gap-2" />

              {/* Invoice Total */}
              <PvInputField control={control} name={`invoiceDetails.${index}.invoiceTotal`} label="Invoice Total" className="flex flex-col gap-2" />

              {/* GL Section */}
              <GLForm className="col-span-4" nestIndex={index} control={control} />
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

        <div className="grid grid-cols-2 gap-6">
          {/* Prepared By Section */}
          <div className="flex flex-col gap-4 p-5 pb-8 bg-slate-50 rounded-xl drop-shadow-md">
            <div className="font-bold">Prepared By:</div>
            <PvInputField control={control} name={"preparedBy.name"} label="Name" />
            <PvInputField control={control} name={"preparedBy.designation"} label="Designation" />
          </div>
          
          {/* Verified By Section */}
          <div className="flex flex-col gap-4 p-5 pb-8 bg-slate-50 rounded-xl drop-shadow-md">
            <div className="font-bold">Verified By:</div>
            <PvInputField control={control} name={"verifiedBy.name"} label="Name" />
            <PvInputField control={control} name={"verifiedBy.designation"} label="Designation" />
          </div>

          {/* Authorised By Section One */}
          <div className="flex flex-col gap-4 p-5 pb-8 bg-slate-50 rounded-xl drop-shadow-md">
            <div className="font-bold">Authorised By:</div>
            <PvInputField control={control} name={"authorisedByOne.name"} label="Name" />
            <PvInputField control={control} name={"authorisedByOne.designation"} label="Designation" />
          </div>

          {/* Authorised By Section Two */}
          <div className="flex flex-col gap-4 p-5 pb-8 bg-slate-50 rounded-xl drop-shadow-md">
            <div className="font-bold">Authorised By 2:</div>
            <PvInputField control={control} name={"authorisedByTwo.name"} label="Name" />
            <PvInputField control={control} name={"authorisedByTwo.designation"} label="Designation" />
          </div>
            
        </div>

        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}


export default PvForm