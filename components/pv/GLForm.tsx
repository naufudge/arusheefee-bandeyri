import React, { useMemo } from 'react'
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Control, useFieldArray, UseFormGetValues, UseFormSetValue } from 'react-hook-form'
import { PvSchema, PvValues } from "@/schemas/PvSchema";
import { glAccountOptions, useGlAccounts } from "@/hooks/use-gl-accounts";
import { z } from 'zod'

interface GLFormProps {
    nestIndex: number;
    control: Control<PvValues>;
    setValue: UseFormSetValue<z.infer<typeof PvSchema>>;
    formValues: UseFormGetValues<z.infer<typeof PvSchema>>;
    className?: string
}

const GLForm: React.FC<GLFormProps> = ({ nestIndex, control, setValue, formValues, className }) => {
    const {fields: glFields, append: appendGL, remove: removeGL} = useFieldArray({
        control,
        name: `invoiceDetails.${nestIndex}.glDetails`
    })

    // Every account in the chart; PVs may be charged to any of them.
    const { data: glAccounts, isLoading: glLoading } = useGlAccounts()
    const glOptions = useMemo(() => glAccountOptions(glAccounts ?? []), [glAccounts])

    // Updates the invoice total by adding up all the GL amounts
    const updateInvoiceTotal = () => {
        const values = formValues()
        const invoices = values.invoiceDetails
        const currentInvoiceTotal = invoices[nestIndex].glDetails.reduce(
            (sum, GlDetail) => sum + (GlDetail.amount || 0),
            0
        );
        setValue(`invoiceDetails.${nestIndex}.invoiceTotal`, Number(currentInvoiceTotal.toFixed(2)))
    }

    const handleGlAmountChange = (GlAmount: number, GLIndex: number) => {
        setValue(`invoiceDetails.${nestIndex}.glDetails.${GLIndex}.amount`, GlAmount)
        updateInvoiceTotal();
    }

    return (
    <div className={className}>
        <hr className="mt-2" />
        <div className="font-bold my-3">GL Section</div>
        {glFields.map((GL, GLIndex) => (
            <div key={GL.id} className="grid w-full grid-cols-1 gap-4 mb-6 sm:grid-cols-12">
                {/* GL Code — picked from the chart of accounts */}
                <FormField
                    control={control}
                    name={`invoiceDetails.${nestIndex}.glDetails.${GLIndex}.code`}
                    render={({ field }) => (
                        <FormItem className="sm:col-span-6">
                            <FormLabel>GL Code</FormLabel>
                            <FormControl>
                                <SearchableSelect
                                    // 0 is the "no code yet" default.
                                    value={field.value ? String(field.value) : ""}
                                    onValueChange={(v) => field.onChange(Number(v))}
                                    options={glOptions}
                                    disabled={glLoading}
                                    placeholder={glLoading ? "Loading GL accounts…" : "Select a GL code"}
                                    searchPlaceholder="Search code or name…"
                                    emptyMessage="No GL accounts yet — add them in Settings → GL Accounts."
                                    contentClassName="w-[min(32rem,90vw)]"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Fund */}
                <FormField
                    control={control}
                    name={`invoiceDetails.${nestIndex}.glDetails.${GLIndex}.fund`}
                    render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                            <FormLabel>Fund</FormLabel>
                            <FormControl>
                                <Input type="text" placeholder="Fund" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Amount */}
                <FormField
                    control={control}
                    name={`invoiceDetails.${nestIndex}.glDetails.${GLIndex}.amount`}
                    render={({ field }) => (
                        <FormItem className={GLIndex != 0 ? "sm:col-span-3" : "sm:col-span-4"}>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                                <Input {...field} type="number" placeholder="Amount" onChange={(e) => handleGlAmountChange(Number(e.target.value), GLIndex)} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {/* Show delete GL code item button starting from the second one */}
                {GLIndex != 0 &&
                    <div className='flex justify-start sm:col-span-1 sm:mt-8'>
                        <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                            removeGL(GLIndex)
                            updateInvoiceTotal()
                        }}>
                            <Trash2 width={20} height={20}/>
                        </Button>
                    </div>
                }
            </div>
        ))}
        <Button 
            type='button'
            variant='outline'
            className='flex gap-2'
            onClick={() => appendGL({code: 0, fund: "C-GOM", amount: 0})}
        >
            <Plus width={20} height={20} />GL Code
        </Button>
    </div>
  )
}

export default GLForm