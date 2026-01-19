"use client";

import React from "react";
import { useRouter } from "next/navigation";
import PvForm from "@/components/pv/PvForm";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

const PvEditPage = ({ params }: { params: { pvNum: string } }) => {
  const { pvNum } = params;
  const router = useRouter();
  const trpc = useTRPC();

  // Fetch PV by number
  const {
    data: pvDetails,
    isLoading,
    error,
  } = useQuery(trpc.pv.getByNum.queryOptions({ pvNum }));

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

      <div className="mx-auto max-w-[700px]">
        {isLoading ? (
          <div className="flex justify-center">
            <Loader2 className="animate-spin size-14" />
          </div>
        ) : pvDetails ? (
          <PvForm pv={pvDetails} />
        ) : (
          <div className="text-center text-red-500">
            {error?.message || "Failed to load PV"}
          </div>
        )}
      </div>
    </div>
  )
}

export default PvEditPage;