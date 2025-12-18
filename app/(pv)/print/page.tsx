"use client";

import React, { useState, useEffect } from "react";
import PrintView from "@/components/pv/PrintView";
import { Loader2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

const PrintPage = () => {
  const [pvNum, setPvNum] = useState<string | null>(null);
  const trpc = useTRPC();

  // Get pvNum from localStorage on mount
  useEffect(() => {
    const storedPvNum = localStorage.getItem("pvNum");
    setPvNum(storedPvNum);
  }, []);

  // Fetch PV by number (only when pvNum is available)
  const {
    data: pv,
    isLoading,
    error,
  } = useQuery({
    ...trpc.pv.getByNum.queryOptions({ pvNum: pvNum ?? "" }),
    enabled: !!pvNum,
  });

  if (!pvNum) {
    return (
      <div className="text-center my-10">
        Please use the PV register to view printable version of the PV.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center my-10">
        <Loader2 className="animate-spin size-14" />
      </div>
    );
  }

  if (error || !pv) {
    return (
      <div className="text-center my-10 text-red-500">
        {error?.message || "Failed to load PV"}
      </div>
    );
  }

  return (
    <div>
      <PrintView pv={pv} />
    </div>
  );
};

export default PrintPage;