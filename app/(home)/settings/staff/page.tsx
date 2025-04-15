"use client";

import React, { useEffect, useState } from "react";
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
import { Staff } from "@/lib/MyTypes";
import axios from "axios";
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


const StaffPage = () => {
  const [staffs, setStaff] = useState<Staff[] | null>([]);

  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Get all staff available in the DB
  async function getStaff() {
    try {
      const response = await axios.get("http://10.12.29.68:8000/staff");
      if (response.data.success) {
        const data: Staff[] = response.data.result;
        const sortedStaffs = data.sort((a, b) => a.name.localeCompare(b.name));
        setStaff(sortedStaffs);

        console.log(sortedStaffs);
      } else {
        console.log("Error fetching exchange rates.");
        setStaff(null);
      }
    } catch (error: unknown) {
      let errorMessage = "";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = "An unknown error occurred.";
      }
      console.log(errorMessage);
      setStaff(null);
    }
  }

  useEffect(() => {
    if (staffs && staffs.length === 0 && staffs !== null) getStaff();
  }, [staffs]);
  
  const handleDeleteClick = async (staffId : string) => {
    try {
      const response = await axios.delete(`http://10.12.29.68:8000/staff/${staffId}`)
      if (response.data) {
        toast({
          title: "Success",
          description: "Successfully deleted the staff."
        })
      }
    } catch (error) {
      let errorMessage = "";
      if (error instanceof Error) {
          errorMessage = error.message
      } else {
          errorMessage = "An unknown error occurred."
      }
      toast({
          title: "Error",
          description: errorMessage,
      })
      console.log(errorMessage)
    } finally {
      getStaff();
    }
  }

  return (
    <div className="flex justify-center w-full">
      <div className="xl:w-full 2xl:w-[1080px] ">
        <div className="flex justify-between place-items-center mb-10">
          <div>
            <h1 className="font-bold text-[1.5rem]">Manage Staff</h1>
            <div className="text-sm text-stone-400 mt-1 italic">
              Add new staff or edit existing staff, which you can then select when
              creating PVs.
            </div>
          </div>

          <AddStaff 
            button={
              <Button className="ml-10">
                <Plus />
                {isMobile ? "" : `Add Staff`}
              </Button>
            }
            refetchStaffs={getStaff}
          />
        </div>

        <div>
          {staffs && staffs.length > 0 ? (
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
                  <TableRow key={staff._id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{staff.name}</TableCell>
                    <TableCell>{staff.designation}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-8 place-items-center justify-end child:transition-all child:duration-200">
                        {/* Edit Popup */}
                        <SquarePen
                          // onClick={() => router.push(`/edit/${pv.pvNum}`)}
                          className="hover:text-blue-600 hover:cursor-pointer"
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
                                permanently delete the PV from the register.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-4">
                              <AlertDialogCancel className="">
                                Cancel
                              </AlertDialogCancel>

                              <AlertDialogAction
                                onClick={() => handleDeleteClick(staff._id)}
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
