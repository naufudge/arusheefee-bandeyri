import React from 'react'
import { CalendarIcon, Plus, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Control, FieldArrayWithId, useFieldArray } from 'react-hook-form'
import { PvValues } from "@/lib/PvSchema";

interface GLFormProps {
    nestIndex: number;
    control: Control<PvValues>;
    className?: string
}

const GLForm: React.FC<GLFormProps> = ({ nestIndex, control, className }) => {
    const {fields: glFields, append: appendGL, remove: removeGL} = useFieldArray({
        control,
        name: `invoiceDetails.${nestIndex}.glDetails`
    })

    return (
    <div className={className}>
        <hr className="mt-2" />
        <div className="font-bold my-3">GL Section</div>
        {glFields.map((GL, GLIndex) => (
            <div key={GL.id} className={`grid gap-4 mb-6 w-full ${GLIndex != 0 ? 'grid-cols-7' : 'grid-cols-3'}`}>
                {/* GL Code */}
                <FormField
                    control={control}
                    name={`invoiceDetails.${nestIndex}.glDetails.${GLIndex}.code`}
                    render={({ field }) => (
                        <FormItem className={GLIndex != 0 ? "col-span-2" : ""}>
                            <FormLabel>Code</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="Code" {...field} />
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
                        <FormItem className={GLIndex != 0 ? "col-span-2" : ""}>
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
                        <FormItem className={GLIndex != 0 ? "col-span-2" : ""}>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="Amount" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {/* Show delete GL code item button starting from the second one */}
                {GLIndex != 0 &&
                    <div className='flex justify-center place-items-center mt-8'>
                        <Button
                        type="button"
                        variant="destructive"
                        onClick={() => removeGL(GLIndex)}>
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