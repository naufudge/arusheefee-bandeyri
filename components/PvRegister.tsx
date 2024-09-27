'use client';

import { PvValues } from '@/lib/PvSchema';
import axios from 'axios';
import React, { useEffect, useState } from 'react'

const PvRegister = () => {
  const [pvs, setPvs] = useState<PvValues[]>([])

  useEffect(() => {
    const get_pvs = async () => {
      try {
        const response = await axios.get("http://10.12.29.68:8000/pvs/")
        setPvs(response.data.result)
        console.log(response.data.result)
      } catch (error: any) {
        console.log(error.message)
      }

      if (pvs.length <= 0) get_pvs()
      console.log("test")
    }
  }, [])

  return (
    <div>
      Test
    </div>
  )
}

export default PvRegister