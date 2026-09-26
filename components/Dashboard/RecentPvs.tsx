"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumberWithCommas } from "@/utils/helpers";
import { pvTotal } from "@/utils/currency";

interface PvData {
  pvNum: string;
  notes: string;
  vendor: string;
  transferNum?: string | null;
  exchangeRate: number;
  invoices: { invoiceTotal: number }[];
}

interface RecentPvsProps {
  pvs: PvData[];
}

const RecentPvs: React.FC<RecentPvsProps> = ({ pvs }) => {
  const recent = useMemo(() => pvs.slice(0, 7), [pvs]);

  // The column is headed MVR, so convert from the PV's document currency.
  const totalFor = (pv: PvData) => pvTotal(pv).mvr;

  return (
    <div>
      <div className="flex items-baseline justify-between border-b px-6 py-5">
        <div>
          <h2 className="text-base font-semibold">Recent Vouchers</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Latest {recent.length} entries
          </p>
        </div>
        <Link
          href="/pv-register"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          Register
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 pl-6 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              PV #
            </TableHead>
            <TableHead className="h-9 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Description
            </TableHead>
            <TableHead className="h-9 pr-6 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              MVR
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recent.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={3}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No vouchers yet.
              </TableCell>
            </TableRow>
          ) : (
            recent.map((pv) => {
              const processed = !!(pv.transferNum && pv.transferNum !== "");
              return (
                <TableRow
                  key={pv.pvNum}
                  className="cursor-pointer transition hover:bg-muted/40"
                >
                  <TableCell className="pl-6">
                    <Link
                      href={`/pv/${pv.pvNum}`}
                      className="block font-mono text-xs"
                    >
                      {pv.pvNum}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/pv/${pv.pvNum}`}
                      className="flex max-w-[180px] flex-col"
                    >
                      <span className="truncate text-sm" title={pv.notes}>
                        {pv.notes}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`size-1.5 rounded-full ${
                            processed ? "bg-emerald-600" : "bg-amber-500"
                          }`}
                        />
                        <span className="truncate text-[11px] text-muted-foreground">
                          {pv.vendor}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Link
                      href={`/pv/${pv.pvNum}`}
                      className="block font-mono text-sm tabular-nums"
                    >
                      {formatNumberWithCommas(totalFor(pv))}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default RecentPvs;
