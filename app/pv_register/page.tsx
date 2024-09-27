'use client';

import { PvValues } from '@/lib/PvSchema';
import axios from 'axios';
import React, { useEffect, useState } from 'react'

const page = () => {
    const [pvs, setPvs] = useState([])

    useEffect(() => {
        async function get_pvs() {
          try {
            const response = await fetch("http://10.12.29.68:8000/pvs")
            const data = await response.json()
            setPvs(data.result)
            console.log(data.result)
          } catch (error: any) {
            console.log(error)
          }
    
          if (pvs.length <= 0) get_pvs()
        }
    }, [pvs])
      

    return (
        <div>
            PV Register
        </div>
    )
}

export default page