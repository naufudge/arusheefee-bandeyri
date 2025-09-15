"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { PvValues } from "@/lib/PvSchema";
import { FilterType, MultiplePVServerResponseType } from "@/lib/MyTypes";
import { Eye, Loader2, Printer, SquarePen, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import Filter from "@/components/Filter";
import { removeDuplicates } from "@/lib/helpers";
import Search from "@/components/PvRegister/Search";
import ExportPVs from "@/components/PvRegister/ExportPVs";
import { useToast } from "@/hooks/use-toast";

const PvRegisterPage = () => {
  const router = useRouter();
  
  const { toast } = useToast();

  const [pvs, setPvs] = useState<PvValues[]>([]);
  const [filteredPvs, setFilteredPvs] = useState<PvValues[]>([]);

  const [loading, setLoading] = useState<boolean>(true);

  const [query, setQuery] = useState<string>("");

  const [filters, setFilters] = useState<FilterType>({
    year: new Date().getFullYear(),
    vendor: "",
    status: "",
    gl: 0,
  });

  const [vendors, setVendors] = useState<string[]>([]);

  async function get_pvs() {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_ARCHIVA_API}/pvs/`
      );
      const data: MultiplePVServerResponseType = await response.json();
      data.result.reverse()

      setPvs(data.result);
      setFilteredPvs(data.result);

      // Sort the vendors and remove the duplicates
      const tempVendors = data.result.map((item) => item.vendor).sort();
      const finalvendors: string[] = removeDuplicates(tempVendors);
      setVendors(finalvendors);

      // let tempDates = data.result.map(item => new Date(item.date).getFullYear() === 2026 ? item.pvNum : null)
      // const pvYears = removeDuplicates(tempDates)
      // console.log(tempDates)

      setLoading(false);
    } catch (error: unknown) {
      // let errorMessage = "";
      if (error instanceof Error) {
        console.log(error.message)
      } else { console.log("An unknown error occurred") }

      toast({
        title: "Error",
        description: "There was an error when trying to fetch PVs.",
      });
    }
  }

  useEffect(() => {
    if (pvs.length <= 0) get_pvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pvs, loading, filters]);

  // useEffect(() => {
  //   get_pvs()
  // }, [filters])

  // const filteredPvs = filters.vendor ? pvs.filter((item) => item.vendor === filters.vendor)
  //   : filters.status ? pvs.filter((item) => filters.status === "pending" ? item.transferNum === "" : item.transferNum != "")
  //   : pvs

  const handleFilter = () => {
    if (filters.year) {
      get_pvs();
    }

    const result = filters.vendor
      ? pvs.filter((item) => item.vendor === filters.vendor)
      : filters.status
      ? pvs.filter((item) =>
          filters.status === "pending"
            ? item.transferNum === ""
            : item.transferNum != ""
        )
      : pvs;

    setFilteredPvs(result);
  };

  const handleSearch = () => {
    if (query) {
      const updatedQuery = query.trim().toLocaleLowerCase();
      const result = pvs.filter(
        (item) =>
          item.pvNum.includes(updatedQuery) ||
          item.notes.toLocaleLowerCase().includes(updatedQuery) ||
          item.vendor.toLocaleLowerCase().includes(updatedQuery)
      );
      setFilteredPvs(result);
    } else {
      setFilteredPvs(pvs);
    }
  };

  const handlePrintClick = (pv: PvValues) => {
    localStorage.setItem("pvNum", pv.pvNum);
    router.push("/print");
  };

  const handleDeleteClick = async (pvNum: string) => {
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_ARCHIVA_API}/pvs/${pvNum}`);
      await get_pvs();
    } catch (error: unknown) {
      // let errorMessage = "";
      if (error instanceof Error) {
        console.log(error.message)
      } else { console.log("An unknown error occurred") }
    }
  };

  return (
    <div className="font-poppins w-full">
      <div className="flex justify-between place-items-center">
        <div className="flex flex-col gap-1">
          <h1 className="font-bold text-2xl">PV Register</h1>
          <div className="text-sm text-stone-400 mt-1 italic">
            Track and manage all payment vouchers (PVs) in one place with
            detailed records and statuses.
          </div>
        </div>

        {/* Export button */}
        <ExportPVs year={filters.year} />
      </div>

      <div className="mt-4 flex place-items-center gap-4">
        <Search query={query} setQuery={setQuery} handleSearch={handleSearch} />

        {/* Filtering */}
        <Filter
          vendors={vendors}
          filters={filters}
          setFilters={setFilters}
          handleFilter={handleFilter}
        />
      </div>

      <br />
      <div className="grid gap-8 h-full">
        {loading ? (
          <div className="w-full h-full flex place-items-center justify-center my-10">
            <Loader2 className="animate-spin size-14" />
          </div>
        ) : (
          <>
            {filteredPvs.map((pv, index) => (
              <div
                key={index}
                className={`flex border rounded-lg p-5 w-full drop-shadow-sm`}
              >
                <div className="flex gap-8 w-full">
                  {/* PV Number */}
                  <div className="flex place-items-center justify-center font-bold">
                    {pv.pvNum}
                  </div>

                  <div className="flex flex-col">
                    <div>{pv.notes}</div>
                    <div className="italic opacity-60 text-sm">{pv.vendor}</div>
                  </div>
                </div>

                <div className="flex gap-8 place-items-center child:transition-all child:duration-200">
                  {/* Status of the PV */}
                  <Badge
                    variant={"default"}
                    className={`rounded-md ${pv.transferNum != "" ? "bg-green-700 hover:bg-green-800" : "bg-gray-700/75 hover:bg-gray-800/75"}`}
                  >
                      {pv.transferNum != "" ? "Processed" : "Pending"}
                  </Badge>

                  {/* View Button */}
                  <Eye className="hover:text-green-600 hover:cursor-pointer" />

                  {/* Edit Popup */}
                  <SquarePen
                    onClick={() => router.push(`/edit/${pv.pvNum}`)}
                    className="hover:text-blue-600 hover:cursor-pointer"
                  />

                  <Printer
                    className="hover:text-purple-600 hover:cursor-pointer"
                    onClick={() => handlePrintClick(pv)}
                  />

                  {/* Delete Popup */}
                  <AlertDialog>
                    <AlertDialogTrigger>
                      <Trash2 className="hover:text-red-600 hover:cursor-pointer" />
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete the PV from the register.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-4">
                        <AlertDialogCancel className="">
                          Cancel
                        </AlertDialogCancel>

                        <AlertDialogAction
                          onClick={() => handleDeleteClick(pv.pvNum)}
                          className="bg-red-800 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}

            {filteredPvs.length === 0 && <div className="italic text-center text-slate-400 mt-10">Sorry, No PVs found.</div>}
          </>
        )}
      </div>
    </div>
  );
};

export default PvRegisterPage;
