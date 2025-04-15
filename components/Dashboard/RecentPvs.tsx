"use client";

import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumberWithCommas } from "@/lib/helpers";
import { PvValues } from "@/lib/PvSchema";

interface RecentPvsProps {
    pvs: PvValues[];
}

const RecentPvs: React.FC<RecentPvsProps> = ({ pvs }) => {
  const [recentPvsData, setRecentPvsData] = useState<PvValues[]>([]);
  // const [loading, setLoading] = useState(true);
  // const year = new Date().getFullYear();

  useEffect(() => {
    if (recentPvsData.length <= 0) {
      setRecentPvsData(pvs.toSpliced(7, pvs.length))
    }
  }, [pvs, recentPvsData]);

  const getInvoiceTotal = (pv: PvValues) => {
    const invoiceTotal = pv.invoiceDetails.reduce(
      (sum, invoice) => sum + invoice.invoiceTotal,
      0
    );
    return formatNumberWithCommas(invoiceTotal);
  };

  return (
    <div className="p-2">
      <h2 className="font-semibold">Recent PVs</h2>
      <br />
      <Table>
        <TableCaption>A list of the recent PVs.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">PV #</TableHead>
            <TableHead>Description</TableHead>
            {/* <TableHead>Vendor</TableHead> */}
            <TableHead className="text-right">MVR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recentPvsData.map((pv) => (
            <TableRow key={pv.pvNum}>
              <TableCell className="font-medium">{pv.pvNum}</TableCell>
              <TableCell className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[190px]">
                <span title={pv.notes}>{pv.notes}</span>
              </TableCell>
              {/* <TableCell>{pv.vendor}</TableCell> */}
              <TableCell className="text-right">
                {getInvoiceTotal(pv)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {/* <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right">$2,500.00</TableCell>
          </TableRow>
        </TableFooter> */}
      </Table>
    </div>
  );
};

export default RecentPvs;
