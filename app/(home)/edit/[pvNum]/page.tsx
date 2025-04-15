'use client';

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation';
import { PvValues } from '@/lib/PvSchema'
import axios from 'axios';
import { SinglePVServerResponseType } from '@/lib/MyTypes';
import PvForm from '@/components/PvForm';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';

const PvEditPage = ({ params }: {
  params: {pvNum: string}
}) => {
  const router = useRouter()
  const [requestState, setRequestState] = useState(false)
  const [pvDetails, setPvDetails] = useState<PvValues | null>()

  useEffect(() => {
    async function getPv() {
      try {
        const response = await axios.get(`http://10.12.29.68:8000/pvs/${params.pvNum}`)
        const data: SinglePVServerResponseType = response.data
        console.log(data)
        setPvDetails(data.result)

      } catch (error: unknown) {
        // let errorMessage = "";
        if (error instanceof Error) {
          console.log(error.message)
        } else { console.log("An unknown error occurred") }

        setPvDetails(null)
      } finally {
        setRequestState(true)
      }
    }

    if (!requestState) getPv();

  }, [requestState, pvDetails, params.pvNum])

  return (
    <div className='w-full'>
      <div>
        <Button onClick={router.back} variant={"outline"} className='justify-evenly flex gap-1'>
          <ChevronLeft />
          Back
        </Button>
      </div>
      <div className='text-center mt-4 mb-12 flex flex-col gap-3'>
        <h1 className='text-2xl font-bold'>Edit Payment Voucher</h1>
        <p className='text-sm italic opacity-50'>You can edit the PV below. Be sure to press &quot;Save&quot; after bringing necessary changes.</p>
      </div>

      <div className='mx-auto max-w-[700px]'>
        {pvDetails ? 
          <PvForm pv={pvDetails} />
        :
          <div><Loader2 className='animate-spin size-14' /></div>
        }
      </div>
    </div>
  )
}

export default PvEditPage;