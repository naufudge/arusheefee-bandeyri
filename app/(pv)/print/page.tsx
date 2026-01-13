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

  // Transform Prisma data to match PvValues schema
  const transformedPv = {
    pvNum: pv.pvNum,
    businessArea: pv.businessArea,
    agency: pv.agency,
    vendor: pv.vendor,
    date: new Date(pv.date),
    notes: pv.notes,
    currency: pv.currency,
    exchangeRate: pv.exchangeRate,
    paymentMethod: pv.paymentMethod,
    preparedBy: {
      name: pv.preparedBy?.name,
      designation: pv.preparedBy?.designation,
    },
    verifiedBy: {
      name: pv.verifiedBy?.name,
      designation: pv.verifiedBy?.designation,
    },
    authorisedByOne: {
      name: pv.authorisedByOne?.name,
      designation: pv.authorisedByOne?.designation,
    },
    authorisedByTwo: {
      name: pv.authorisedByTwo?.name,
      designation: pv.authorisedByTwo?.designation,
    },
    invoiceDetails: pv.invoices.map((invoice) => ({
      comments: invoice.comments,
      invoiceNumber: invoice.invoiceNumber ?? undefined,
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate) : null,
      invoiceTotal: invoice.invoiceTotal,
      glDetails: invoice.glDetails.map((gl) => ({
        code: gl.code,
        fund: gl.fund,
        amount: gl.amount,
      })),
    })),
    poNum: pv.poNum ?? undefined,
    parkedDate: pv.parkedDate ? new Date(pv.parkedDate) : null,
    postingDate: pv.postingDate ? new Date(pv.postingDate) : null,
    clearingDoc: {
      num: pv.clearingDocNum ?? undefined,
      date: pv.clearingDocDate ? new Date(pv.clearingDocDate) : undefined,
    },
    transferNum: pv.transferNum ?? undefined,
  };

  return (
    <div>
      <PrintView pv={transformedPv} />
    </div>
  );
};

export default PrintPage;