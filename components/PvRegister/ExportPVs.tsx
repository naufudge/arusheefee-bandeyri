import React from 'react'
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface ExportPVsProps {
    year: number | string;
}

const ExportPVs: React.FC<ExportPVsProps> = ({ year }) => {
    const handleExportClick = async () => {
        try {
            const url = `http://10.12.29.68:8000/pv/export/${year}`
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "pv_register.xlsx");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error: unknown) {
            let errorMessage = "";
            if (error instanceof Error) {
                errorMessage = error.message;
            } else { errorMessage = "An unknown error occurred!" }
            console.log(errorMessage)
        }
    }
  return (
    <>
        <Button
        onClick={handleExportClick}
        className='bg-green-600 hover:bg-green-700 text-white px-2 transition-all duration-200'>
            <Image src={"/icons/excel.svg"} alt='excel' width={25} height={0} className='invert' />
            Export PV Register
        </Button>
    </>
  )
}

export default ExportPVs