import React, { Dispatch, SetStateAction } from 'react'
import { CircleX } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from '@/components/ui/label'
import { capitalizeFirstLetter } from '@/lib/helpers';

interface FilterOptionProps {
    label: string;
    placeholder: string;
    selectItems?: string[];
    setSelect: Dispatch<SetStateAction<string>>;
    selectedValue: string;
}

const FilterOption: React.FC<FilterOptionProps> = ({ label, placeholder, setSelect, selectedValue, selectItems }) => {
    const xCircleSize = 25;
    return (
        <div className='gap-1'>
            <Label>{label}</Label>
            <div className='flex gap-2 place-items-center'>
                <Select onValueChange={setSelect}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={selectedValue ? selectedValue : placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                        {selectItems?.map((item, index) => (
                            <SelectItem key={index} value={item} className='hover:cursor-pointer'>{capitalizeFirstLetter(item)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Clear selection button */}
                { selectedValue &&
                <CircleX 
                onClick={() => setSelect("")}
                color='white' 
                width={xCircleSize} 
                height={xCircleSize} 
                className='hover:cursor-pointer hover:fill-red-600 fill-red-700 transition-all' />
                }
            </div>
        </div>
    )
}

export default FilterOption