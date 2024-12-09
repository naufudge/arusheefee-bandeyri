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
import FilterOption from './FilterOption'
  

interface FilterProps {
    vendors?: string[];
    selectedVendor: string;
    setVendor: Dispatch<SetStateAction<string>>;
    selectedStatus: string;
    setSelectedStatus: Dispatch<SetStateAction<string>>;
}

const Filter: React.FC<FilterProps> = ({ vendors, selectedVendor, setVendor, selectedStatus, setSelectedStatus }) => {
    const xCircleSize = 25;

    const handleVendorSelect = (value: string) => {
        setVendor(value)
        // handleFilter()
    }

    const handleStatusSelect = (value: string) => {
        
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
                <div className='grid grid-cols-3 gap-8'>
                    {/* Vendor Filter */}
                    <FilterOption label='Vendor' placeholder="Select a Vendor" selectItems={vendors} selectedValue={selectedVendor} setSelect={setVendor}  />
                    
                    {/* Pending or Proccessed Filter */}
                    <FilterOption label='Status' placeholder="Select Status" selectItems={["pending", "processed"]} selectedValue={selectedStatus} setSelect={setSelectedStatus}  />

                </div>
            </PopoverContent>
        </Popover>

    </div>
  )
}

export default Filter