'use client';

import React, { useState, useEffect } from 'react'
import PrintView from '@/components/PrintView'
import axios from 'axios';
import { PvValues } from '@/lib/PvSchema';

const PrintPage = () => {
  const [pv, setPv] = useState<PvValues>()

  useEffect(() => {
    async function getPV() {
      const pvNum = localStorage.getItem("pvNum")
      if (pvNum) {
        try {
          const response = await axios.get(`${process.env.NEXT_PUBLIC_ARCHIVA_API}/pvs/${pvNum}`)
          const tempPv = response.data.result
          tempPv.date = new Date(response.data.result.date)
          setPv(tempPv)
        } catch (error: unknown) {
          // let errorMessage = "";
          if (error instanceof Error) {
            console.log(error.message)
          } else { console.log("An unknown error occurred") }
        }
      }
    }
    if (!pv) getPV()
  }, [pv])

  return (
    <div>
      {pv ? <PrintView pv={pv} /> : <div className='text-center my-10'>Please use the PV register to view printable version of the PV.</div>}
    </div>
  )
}

export default PrintPage