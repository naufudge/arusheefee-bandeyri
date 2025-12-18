"use client";

import {
  getChartConfig,
  getFormattedDataset,
} from "@/utils/ChartHelper";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import { CircleDollarSign, ReceiptText, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { formatNumberWithCommas } from "@/utils/helpers";
import RecentPvs from "@/components/dashboard/RecentPvs";
import { useTRPC } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const year = "2025";
  const [expenditure, setExpenditure] = useState(0);
  const [uniqueVendors, setUniqueVendors] = useState(0);

  const [chartConfig, setChartConfig] = useState<ChartConfig>();
  const [chartData, setChartData] = useState<{ code: string; value: number }[]>(
    []
  );

  const trpc = useTRPC();

  // Fetch PVs by year
  const { data: pvs } = useQuery(trpc.pv.byYear.queryOptions({ year }));

  // Fetch GL totals by year
  const { data: glData } = useQuery(
    trpc.pv.glTotalsByYear.queryOptions({ year })
  );

  // Calculate unique vendors when PVs change
  useEffect(() => {
    if (pvs) {
      const vendors = new Set(pvs.map((entry) => entry.vendor));
      setUniqueVendors(vendors.size);
    }
  }, [pvs]);

  // Process GL data for chart when it changes
  useEffect(() => {
    if (glData) {
      const config = getChartConfig(glData);
      const data = getFormattedDataset(glData);
      setChartConfig(config);
      setChartData(data);

      // Calculate the total expenditure
      const total = Object.values(glData).reduce(
        (accumulator, currentValue) => accumulator + currentValue,
        0
      );
      setExpenditure(total);
    }
  }, [glData]);

  return (
    <div className="h-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Arusheefee Bandeyri</h1>
        <div className="text-sm text-stone-400 mt-1 italic">
          One step at a time.
        </div>
      </div>

      {pvs ? (
        <div className="grid grid-cols-12 gap-6 h-fit mb-8">
          {/* Stat Cards */}
          <div className="grid grid-cols-3 col-span-7 gap-6 h-fit">
            <div className="home-stats-card border-l-purple-500">
              <div className="flex justify-between place-items-center">
                <span>Total PVs</span>
                <ReceiptText className="text-purple-500" />
              </div>
              <div className="font-semibold text-xl">{pvs.length}</div>
            </div>

            <div className="home-stats-card border-l-red-500">
              <div className="flex justify-between place-items-center">
                <span>Total Vendors</span>
                <Store className="text-red-500" />
              </div>
              <div className="font-semibold text-xl">{uniqueVendors}</div>
            </div>

            <div className="home-stats-card border-l-[#4CBB17]">
              <div className="flex justify-between place-items-center">
                <span>Total Expenditure</span>
                <CircleDollarSign className="text-[#4CBB17]" />
              </div>
              <div className="font-semibold text-xl">
                MVR {formatNumberWithCommas(expenditure)}
              </div>
            </div>

            {/* Charts */}
            <div className="col-span-full 2xl:col-span-2 lg:col-span-full p-7 rounded-lg shadow border h-full">
              <h2 className="font-semibold mb-7">
                Total Expenditure by GL Account
              </h2>

              <div>
                {chartConfig ? (
                  <ChartContainer
                    config={chartConfig}
                    className="h-[300px] w-full"
                  >
                    <BarChart accessibilityLayer data={chartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="code"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent className="bg-white" />}
                      />

                      <Bar dataKey="value" fill="#a855f7" radius={4} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div></div>
                )}
              </div>
            </div>

            <div></div>
          </div>

          <div className="col-span-5 p-5 rounded-lg shadow border h-full">
            <RecentPvs pvs={pvs} />
          </div>
        </div>
      ) : (
        <></>
      )}
    </div>
  );
}
