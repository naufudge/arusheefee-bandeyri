"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, SquarePen, Trash2 } from "lucide-react";
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
import AddStaff from "@/components/Settings/Staff/AddStaff";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useTRPC } from "@/lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const StaffPage = () => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get all staff available in the DB
  const { data: staffs, isLoading } = useQuery(trpc.staff.list.queryOptions());

  // Delete staff mutation
  const deleteMutation = useMutation(
    trpc.staff.delete.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Successfully deleted the staff.",
        });
        queryClient.invalidateQueries({ queryKey: trpc.staff.list.queryKey() });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "An unknown error occurred.",
        });
      },
    })
  );

  const handleDeleteClick = (staffId: string) => {
    deleteMutation.mutate({ id: staffId });
  };

  const refetchStaffs = () => {
    queryClient.invalidateQueries({ queryKey: trpc.staff.list.queryKey() });
  };

  return (
    <div className="flex justify-center w-full">
      <div className="xl:w-full 2xl:w-[1080px] ">
        <div className="flex justify-between place-items-center mb-10">
          <div>
            <h1 className="font-bold text-[1.5rem]">Manage Staff</h1>
            <div className="text-sm text-stone-400 mt-1 italic">
              Add new staff or edit existing staff, which you can then select
              when creating PVs.
            </div>
          </div>

          <AddStaff
            button={
              <Button className="ml-10">
                <Plus />
                {isMobile ? "" : `Add Staff`}
              </Button>
            }
            refetchStaffs={refetchStaffs}
          />
        </div>

        <div>
          {!isLoading && staffs && staffs.length > 0 ? (
            <Table>
              {/* <TableCaption>A list of your recent invoices.</TableCaption> */}
              <TableHeader>
                <TableRow className="hover:bg-gray-100 bg-gray-100 rounded-tr rounded-tl">
                  <TableHead className="w-[70px]">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {staffs?.map((staff, index) => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{staff.name}</TableCell>
                    <TableCell>{staff.designation}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-8 place-items-center justify-end child:transition-all child:duration-200">
                        {/* Edit Popup */}
                        <AddStaff
                          button={
                            <SquarePen className="hover:text-blue-600 hover:cursor-pointer" />
                          }
                          refetchStaffs={refetchStaffs}
                          staff={{ _id: staff.id, name: staff.name, designation: staff.designation }}
                        />

                        {/* Delete Popup */}
                        <AlertDialog>
                          <AlertDialogTrigger>
                            <Trash2 className="hover:text-red-400 text-red-600 hover:cursor-pointer" />
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Are you absolutely sure?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will
                                permanently delete the staff from the register.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-4">
                              <AlertDialogCancel className="">
                                Cancel
                              </AlertDialogCancel>

                              <AlertDialogAction
                                onClick={() => handleDeleteClick(staff.id)}
                                className="bg-red-600 hover:bg-red-500"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="w-full mt-20 place-items-center justify-center">
              <Loader2 className="animate-spin size-8" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffPage;
