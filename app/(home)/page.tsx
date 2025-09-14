"use client";

import {
  getChartConfig,
  getFormattedDataset,
} from "@/components/charts/ChartHelper";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import axios from "axios";
import { CircleDollarSign, ReceiptText, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { MultiplePVServerResponseType } from "@/lib/MyTypes";
import { PvValues } from "@/lib/PvSchema";
import { formatNumberWithCommas } from "@/lib/helpers";
import RecentPvs from "@/components/Dashboard/RecentPvs";

export default function Home() {
  // const [year, setYear] = useState(2025);
  const year = 2025;
  const [pvs, setPvs] = useState<PvValues[]>();
  const [expenditure, setExpenditure] = useState(0);
  const [uniqueVendors, setUniqueVendors] = useState(0);

  const [glData, setGlData] = useState<{ [key: string]: number }>();
  const [chartConfig, setChartConfig] = useState<ChartConfig>();
  const [chartData, setChartData] = useState<{ code: string; value: number }[]>(
    []
  );

  async function getPvs() {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_ARCHIVA_API}pv/year/${year}`);
      const data: MultiplePVServerResponseType = await response.json();
      const pvData = data.result.reverse();
      setPvs(pvData);

      // Find the number of unique vendors
      const uniqueVendors = new Set(pvData.map((entry) => entry.vendor));
      setUniqueVendors(uniqueVendors.size);
    } catch (error: unknown) {
      // let errorMessage = "";
      if (error instanceof Error) {
        console.log(error.message);
      } else {
        console.log("An unknown error occurred");
      }
    }
  }

  async function getGlData() {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_ARCHIVA_API}/pv/gl/${year}`);
      if (response.data.success) setGlData(response.data.result);
      console.log("Got GL Data!");
    } catch (error: unknown) {
      let errorMessage = "";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = "An unknown error occurred.";
      };
      console.log(errorMessage);
    }
  }

  useEffect(() => {
    getGlData();
    getPvs();
  }, [year]);

  useEffect(() => {
    if (glData) {
      const config = getChartConfig(glData);
      const data = getFormattedDataset(glData);
      setChartConfig(config);
      setChartData(data);

      // Calculate the total expenditure
      const amounts = Object.keys(glData).map((code) => glData[code]);
      const total = amounts.reduce(
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
