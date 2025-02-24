import React from 'react'
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
    setSelect: (value: string) => void;
    selectedValue: string;
}

const FilterOption: React.FC<FilterOptionProps> = ({ label, placeholder, setSelect, selectedValue, selectItems }) => {
    return (
        <div className='gap-1'>
            <Label htmlFor={label}>{label}</Label>
            <div className='flex gap-2 place-items-center'>
                <Select onValueChange={setSelect} value={selectedValue}>
                    <SelectTrigger id={label} className={`w-[180px] ${selectedValue && 'border-black border-2'}`} onClick={(e) => e.stopPropagation()}>
                        <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent id={label} onClick={(e) => e.stopPropagation()}>
                        {selectItems?.map((item, index) => (
                            <SelectItem key={index} value={item} className='hover:cursor-pointer'>{capitalizeFirstLetter(item)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

            </div>
        </div>
    )
}

export default FilterOption