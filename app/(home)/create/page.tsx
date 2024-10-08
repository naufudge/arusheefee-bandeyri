import React from 'react'
import PvForm from '@/components/PvForm'

const CreatePV = () => {
  return (
    <div className='max-w-[700px] mx-auto'>
      <h1 className='text-center text-2xl font-bold mt-4 mb-12'>Create Payment Voucher</h1>
        <PvForm />
    </div>
  )
}

export default CreatePV