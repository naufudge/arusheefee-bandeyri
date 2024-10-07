import React, { Dispatch, SetStateAction } from 'react'
import { CircleX, FilterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Popover, 
    PopoverTrigger, 
    PopoverContent
} from '@/components/ui/popover'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from './ui/label'
  

interface FilterProps {
    vendors?: string[];
    selectedVendor: string;
    setVendor: Dispatch<SetStateAction<string>>;
}

const Filter: React.FC<FilterProps> = ({ vendors, selectedVendor, setVendor }) => {
    const handleVendorSelect = (value: string) => {
        console.log(value)
        setVendor(value)
        // handleFilter()
    }

  return (
    <div className='mt-5'>
        <Popover>
            <PopoverTrigger asChild>
                <Button className='gap-3' variant={'outline'}>
                    <FilterIcon width={20} height={20} /> Filter
                </Button>
            </PopoverTrigger>
            <PopoverContent align='start' className='w-[700px]'>
                <div className='grid grid-cols-3'>
                    <div className='gap-1'>
                        <Label>Vendor</Label>
                        <div className='flex gap-2 place-items-center'>
                            <Select onValueChange={handleVendorSelect}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder={selectedVendor ? selectedVendor : "Select a Vendor"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {vendors?.map((item, index) => (
                                        <SelectItem key={index} value={item} className='hover:cursor-pointer'>{item}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Clear selection button */}
                            { selectedVendor &&
                            <CircleX 
                            onClick={() => setVendor("")}
                            color='white' 
                            width={30} 
                            height={30} 
                            className='hover:cursor-pointer hover:fill-red-600 fill-red-700 transition-all' />
                            }
                        </div>
                    </div>


                </div>
            </PopoverContent>
        </Popover>
        
    </div>
  )
}

export default Filter