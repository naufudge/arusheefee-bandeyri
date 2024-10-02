'use client';

import React, { useState, useEffect } from 'react'
import PrintView from '@/components/PrintView'
import axios from 'axios';
import { PvValues } from '@/lib/PvSchema';

const page = () => {
  const [pv, setPv] = useState<PvValues>()

  useEffect(() => {
    async function getPV() {
      const pvNum = localStorage.getItem("pvNum")
      if (pvNum) {
        try {
          const response = await axios.get(`http://10.12.29.68:8000/pvs/${pvNum}`)
          let tempPv = response.data.result
          tempPv.date = new Date(response.data.result.date)
          setPv(tempPv)
        } catch (error: any) {
          console.log(error.message)
        }
      }
    }
    if (!pv) getPV()
  }, [pv])

  return (
    <div>
      {pv ? <PrintView pv={pv} /> : <div className='text-center my-10'>Please use the PV register to view print.</div>}
    </div>
  )
}

export default page