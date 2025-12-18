"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FilterType } from "@/lib/MyTypes";
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
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const PvRegisterPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState<string>("");

  const [filters, setFilters] = useState<FilterType>({
    year: new Date().getFullYear(),
    vendor: "",
    status: "",
    gl: 0,
  });

  // Fetch all PVs
  const { data: pvs, isLoading: loading } = useQuery(
    trpc.pv.list.queryOptions()
  );

  // Delete PV mutation
  const deleteMutation = useMutation(
    trpc.pv.delete.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Successfully deleted the PV.",
        });
        queryClient.invalidateQueries({ queryKey: trpc.pv.list.queryKey() });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unknown error occurred.",
        });
      },
    })
  );

  // Compute vendors from PVs
  const vendors = pvs
    ? removeDuplicates(pvs.map((item) => item.vendor).sort())
    : [];

  // Filter PVs based on filters and search query
  const filteredPvs = React.useMemo(() => {
    if (!pvs) return [];

    let result = [...pvs];

    // Apply vendor filter
    if (filters.vendor) {
      result = result.filter((item) => item.vendor === filters.vendor);
    }

    // Apply status filter
    if (filters.status) {
      result = result.filter((item) =>
        filters.status === "pending"
          ? !item.transferNum || item.transferNum === ""
          : item.transferNum && item.transferNum !== ""
      );
    }

    // Apply search query
    if (query) {
      const updatedQuery = query.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.pvNum.toLowerCase().includes(updatedQuery) ||
          item.notes.toLowerCase().includes(updatedQuery) ||
          item.vendor.toLowerCase().includes(updatedQuery)
      );
    }

    return result;
  }, [pvs, filters, query]);

  const handleFilter = () => {
    // Filters are applied reactively via useMemo
  };

  const handleSearch = () => {
    // Search is applied reactively via useMemo
  };

  const handlePrintClick = (pvNum: string) => {
    localStorage.setItem("pvNum", pvNum);
    router.push("/print");
  };

  const handleDeleteClick = (pvNum: string) => {
    deleteMutation.mutate({ pvNum });
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
                    onClick={() => handlePrintClick(pv.pvNum)}
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
