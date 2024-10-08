'use client';

import React, { useEffect, useState } from 'react'
import { PvValues } from '@/lib/PvSchema'
import axios from 'axios';
import { SinglePVServerResponseType } from '@/lib/MyTypes';
import PvForm from '@/components/PvForm';
import Popup from '@/components/Popup';

interface EditPageProps {
  pvNum: string
}

const PvEditPage = ({params}: {
  params: {pvNum: string}
}) => {
  const [requestState, setRequestState] = useState(false)
  const [pvDetails, setPvDetails] = useState<PvValues | null>()

  const [popup, setPopup] = useState(false)
  const [popupInfo, setPopupInfo] = useState({
    title: "",
    detail: ""
  })

  useEffect(() => {
    async function getPv() {
      console.log(params.pvNum)
      try {
        const response = await axios.get(`http://10.12.29.68:8000/pvs/${params.pvNum}`)
        const data: SinglePVServerResponseType = response.data
        console.log(data)
        setPvDetails(data.result)

      } catch (error: any) {
        console.log(error.message)
        setPvDetails(null)
      } finally {
        setRequestState(true)
      }
    }

    if (!requestState) getPv();

  }, [requestState, pvDetails])

  return (
    <div className='w-full'>
      <div className='text-center mt-4 mb-12 flex flex-col gap-3'>
        <h1 className='text-2xl font-bold'>Edit Payment Voucher</h1>
        <p className='text-sm italic opacity-50'>You can edit the PV below. Be sure to press "Save" after bringing necessary changes.</p>
      </div>

      <Popup open={popup} setOpen={setPopup} info={popupInfo} />
      <div className='mx-auto max-w-[700px]'>
        <PvForm pv={pvDetails} showPopup={setPopup} setPopupInfo={setPopupInfo} />
      </div>
    </div>
  )
}

export default PvEditPage