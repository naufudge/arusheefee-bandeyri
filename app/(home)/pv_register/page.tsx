'use client';

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PvValues } from '@/lib/PvSchema';
import { MultiplePVServerResponseType } from '@/lib/MyTypes';
import { Eye, Printer, SquarePen, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import PvForm from '@/components/PvForm';
import Popup from '@/components/Popup';
import Filter from '@/components/Filter';
import { removeDuplicates } from '@/lib/helpers';


const page = () => {
  const router = useRouter()
  const [pvs, setPvs] = useState<PvValues[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const [vendors, setVendors] = useState<string[]>([])
  const [selectedVendor, setSelectedVendor] = useState<string>("")

  const [popup, setPopup] = useState(false)
  const [popupInfo, setPopupInfo] = useState({
    title: "",
    detail: ""
  })

  async function get_pvs() {
    try {
      const response = await fetch("http://10.12.29.68:8000/pvs")
      const data: MultiplePVServerResponseType = await response.json()
      setPvs(data.result.reverse())

      // Sort the vendors and remove the duplicates
      let tempVendors = data.result.map(item => item.vendor).sort();
      const finalvendors: string[] = removeDuplicates(tempVendors)
      setVendors(finalvendors);

      // let tempDates = data.result.map(item => new Date(item.date).getFullYear() === 2026 ? item.pvNum : null)
      // const pvYears = removeDuplicates(tempDates)
      // console.log(tempDates)

      setLoading(false)
    } catch (error: any) {
      setLoading(true)
      console.log(error)
    }
  }

  useEffect(() => {
    if (pvs.length <= 0) get_pvs()
  }, [pvs, loading, vendors])

  const filteredPvs = selectedVendor ? pvs.filter((item) => item.vendor === selectedVendor) : pvs

  const handlePrintClick = (pv: PvValues) => {
    localStorage.setItem("pvNum", pv.pvNum)
    router.push("/print")
  }

  const handleDeleteClick = async (pvNum: string) => {
    try {
      await axios.delete(`http://10.12.29.68:8000/pvs/${pvNum}`)
      await get_pvs()
    } catch (error: any) {
      console.log(error.message)
    }
  }

  return (
    <div className='font-poppins w-full'>
      <div>
        <h1 className='font-bold text-2xl'>PV Register</h1>
      </div>

      {/* Search & Filtering */}
      <Filter vendors={vendors} selectedVendor={selectedVendor} setVendor={setSelectedVendor} />

      <br />
      <div className='grid gap-8'>
        { loading ? <div className='italic'>Loading...</div>
        :
        <>
          <Popup open={popup} setOpen={setPopup} info={popupInfo} />
          {filteredPvs.map((pv, index) => (
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
                          <PvForm pv={pv} showPopup={setPopup} setPopupInfo={setPopupInfo} />
                      </DialogContent>
                  </Dialog>

                  <Printer className='hover:text-purple-600 hover:cursor-pointer' onClick={() => handlePrintClick(pv)} />
                  
                  {/* Delete Popup */}
                  <AlertDialog>
                    <AlertDialogTrigger><Trash2 className='hover:text-red-600 hover:cursor-pointer' /></AlertDialogTrigger>
                    <AlertDialogContent className='bg-white'>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the PV from the register.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className='gap-4'>
                        <AlertDialogCancel className=''>
                          Cancel
                        </AlertDialogCancel>

                        <AlertDialogAction onClick={() => handleDeleteClick(pv.pvNum)} className='bg-red-800 hover:bg-red-700'>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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