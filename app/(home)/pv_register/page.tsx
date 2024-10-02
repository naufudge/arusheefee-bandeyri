'use client';

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation';
import { PvValues } from '@/lib/PvSchema';
import { Eye, Printer, SquarePen, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import PvForm from '@/components/PvForm';


const page = () => {
  const router = useRouter()
  const [pvs, setPvs] = useState<PvValues[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function get_pvs() {
      try {
        const response = await fetch("http://10.12.29.68:8000/pvs")
        const data = await response.json()
        setPvs(data.result)
        setLoading(false)
      } catch (error: any) {
        setLoading(true)
        console.log(error)
      }
    }

    if (pvs.length <= 0) get_pvs()
  }, [pvs, loading])
    
  const handlePrintClick = (pv: PvValues) => {
    localStorage.setItem("pvNum", pv.pvNum)
    router.push("/print")
  }

  return (
    <div className='font-poppins w-full'>
      <div>
        <h1 className='font-bold text-xl'>PV Register</h1>
      </div>

      <br />
      <div className='grid gap-8'>
        { loading ? <div className='italic'>Loading...</div>
        :
        // ${pv.transferNum === "" ? 'bg-slate-50' : "bg-green-50"}
        <>
          {pvs.map((pv, index) => (
            <div key={index} className={`flex border rounded-lg p-5 w-full drop-shadow-sm`}>
              
              <div className='flex gap-8 w-full'>
                {/* PV Number */}
                <div className='flex place-items-center justify-center font-bold'>{pv.pvNum}</div>
                
                <div className='flex flex-col'>
                  <div>{pv.notes}</div>
                  <div className='italic opacity-60 text-sm'>{pv.vendor}</div>
                </div>
                
              </div>

              <div className='flex gap-8 place-items-center child:transition-all child:duration-200'>
                {/* Status of the PV */}
                <div className='flex gap-2 place-items-center justify-start'>
                  <div className={`w-[15px] h-[15px] ${pv.transferNum != "" ? "bg-green-700" : "bg-gray-700"} rounded-full`}></div>
                  <div className='opacity-60 text-sm'>{pv.transferNum != "" ? "Processed" : "Pending"}</div>
                </div>
                
                <Eye className='hover:text-green-600 hover:cursor-pointer' />

                {/* Edit Popup */}
                <Dialog>
                    <DialogTrigger><SquarePen className='hover:text-blue-600 hover:cursor-pointer' /></DialogTrigger>
                    <DialogContent className='bg-white overflow-y-scroll h-[650px] max-w-[750px]'>
                        <DialogHeader>
                        <DialogTitle className='text-center mb-4'>Edit PV</DialogTitle>
                        <DialogDescription>
                            You can edit the PV below. Be sure to press "Save" after bringing necessary changes.
                        </DialogDescription>
                        </DialogHeader>
                        <PvForm pv={pv} />
                    </DialogContent>
                </Dialog>

                <Printer className='hover:text-purple-600 hover:cursor-pointer' onClick={() => handlePrintClick(pv)} />
                <Trash2 className='hover:text-red-600 hover:cursor-pointer' />
              </div>
              </div>
          ))}
          {pvs.length === 0 && 
            <div>No PVs</div>
          }
        </>
        }
      </div>
    </div>
  )
}

export default page