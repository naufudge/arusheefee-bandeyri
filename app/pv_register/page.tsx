'use client';

import React, { useEffect, useState } from 'react'
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
    

  return (
    <div className='font-poppins w-full'>
      <div>
        <h1 className='font-bold text-xl'>PV Register</h1>
      </div>

      <br />
      <div className='grid gap-8'>
        { loading ? <div className='italic'>Loading...</div>
        :
        <>
          {pvs.map((pv, index) => (
            <div key={index} className={`flex ${pv.transferNum === "" ? 'bg-slate-50' : "bg-green-50"}  rounded-lg p-5 w-full drop-shadow`}>
              
              <div className='flex gap-8 w-full'>
                <div className='flex place-items-center justify-center font-bold'>{pv.pvNum}</div>
                
                <div className='flex flex-col'>
                  <div>{pv.notes}</div>
                  <div className='italic opacity-60 text-sm'>{pv.vendor}</div>
                </div>
              </div>

              <div className='flex gap-8 place-items-center child:transition-all child:duration-200 child:hover:cursor-pointer'>
                <Eye className='hover:text-green-600' />

                {/* Edit Popup */}
                <Dialog>
                    <DialogTrigger><SquarePen className='hover:text-blue-600' /></DialogTrigger>
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

                <Printer className='hover:text-purple-600' />
                <Trash2 className='hover:text-red-600' />
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